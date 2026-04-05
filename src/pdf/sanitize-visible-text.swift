import AppKit
import Foundation
import PDFKit

struct Config: Decodable {
    let sourcePdfPath: String
    let destinationPdfPath: String
    let exactTexts: [String]
    let lineContains: [String]
    let minPipeCountForLineRedaction: Int
}

let configPath = CommandLine.arguments[1]
let configData = try Data(contentsOf: URL(fileURLWithPath: configPath))
let config = try JSONDecoder().decode(Config.self, from: configData)

guard let document = PDFDocument(url: URL(fileURLWithPath: config.sourcePdfPath)) else {
    throw NSError(domain: "SanitizeVisibleText", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Unable to open source PDF."
    ])
}

guard let context = CGContext(URL(fileURLWithPath: config.destinationPdfPath) as CFURL, mediaBox: nil, nil) else {
    throw NSError(domain: "SanitizeVisibleText", code: 2, userInfo: [
        NSLocalizedDescriptionKey: "Unable to create destination PDF."
    ])
}

for pageIndex in 0..<document.pageCount {
    guard let page = document.page(at: pageIndex) else {
        continue
    }

    let bounds = page.bounds(for: .mediaBox)
    var mediaBox = bounds
    context.beginPDFPage([
        kCGPDFContextMediaBox as String: CGRect(x: mediaBox.origin.x, y: mediaBox.origin.y, width: mediaBox.width, height: mediaBox.height)
    ] as CFDictionary)

    let image = renderPageImage(page: page, bounds: bounds)
    if let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) {
        context.draw(cgImage, in: bounds)
    }

    context.saveGState()
    context.setFillColor(NSColor.white.cgColor)
    for rect in redactionRects(for: page, config: config) {
        context.fill(rect.insetBy(dx: -2, dy: -1))
    }
    context.restoreGState()

    context.endPDFPage()
}

context.closePDF()

func renderPageImage(page: PDFPage, bounds: CGRect) -> NSImage {
    let scale: CGFloat = 2.0
    let targetSize = NSSize(width: bounds.width * scale, height: bounds.height * scale)
    return page.thumbnail(of: targetSize, for: .mediaBox)
}

func redactionRects(for page: PDFPage, config: Config) -> [CGRect] {
    guard let text = page.string, !text.isEmpty else {
        return []
    }

    let nsText = text as NSString
    var ranges: [NSRange] = []

    for exactText in config.exactTexts where !exactText.isEmpty {
        ranges.append(contentsOf: rangesOfSubstring(exactText, in: nsText))
    }

    let lineRanges = rangesForSensitiveLines(
        in: nsText,
        lineContains: config.lineContains,
        minPipeCount: config.minPipeCountForLineRedaction
    )
    ranges.append(contentsOf: lineRanges)

    var rects: [CGRect] = []
    for range in ranges where range.length > 0 {
        if let selection = page.selection(for: range) {
            let rect = selection.bounds(for: page)
            if !rect.isEmpty {
                rects.append(rect)
            }
        }
    }

    return rects
}

func rangesOfSubstring(_ substring: String, in text: NSString) -> [NSRange] {
    var ranges: [NSRange] = []
    var searchRange = NSRange(location: 0, length: text.length)

    while true {
      let found = text.range(of: substring, options: [], range: searchRange)
      if found.location == NSNotFound {
          break
      }

      ranges.append(found)
      let nextLocation = found.location + found.length
      if nextLocation >= text.length {
          break
      }

      searchRange = NSRange(location: nextLocation, length: text.length - nextLocation)
    }

    return ranges
}

func rangesForSensitiveLines(in text: NSString, lineContains: [String], minPipeCount: Int) -> [NSRange] {
    var ranges: [NSRange] = []
    let fullText = text as String
    let lines = fullText.split(separator: "\n", omittingEmptySubsequences: false)
    var location = 0

    for line in lines {
        let lineString = String(line)
        let lineLength = (lineString as NSString).length

        if shouldRedactLine(lineString, lineContains: lineContains, minPipeCount: minPipeCount) {
            ranges.append(NSRange(location: location, length: lineLength))
        }

        location += lineLength + 1
    }

    return ranges
}

func shouldRedactLine(_ line: String, lineContains: [String], minPipeCount: Int) -> Bool {
    let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
        return false
    }

    if lineContains.contains(where: { trimmed.contains($0) }) {
        return true
    }

    let pipeCount = trimmed.filter { $0 == "|" }.count
    return pipeCount >= minPipeCount
}
