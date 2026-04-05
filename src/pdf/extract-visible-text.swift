import Foundation
import PDFKit

let pdfPath = CommandLine.arguments[1]

guard let document = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    throw NSError(domain: "ExtractVisibleText", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Unable to open PDF."
    ])
}

struct PagePayload: Encodable {
    let pageNumber: Int
    let text: String
}

struct OutputPayload: Encodable {
    let fullText: String
    let pages: [PagePayload]
}

var pages: [PagePayload] = []
var fullTextParts: [String] = []

for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else {
        continue
    }

    let text = (page.string ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    pages.append(PagePayload(pageNumber: index + 1, text: text))

    if !text.isEmpty {
        fullTextParts.append(text)
    }
}

let payload = OutputPayload(
    fullText: fullTextParts.joined(separator: "\n\n"),
    pages: pages
)

let data = try JSONEncoder().encode(payload)
if let json = String(data: data, encoding: .utf8) {
    FileHandle.standardOutput.write(Data(json.utf8))
}
