const HTML_TAG_PATTERN = /<[^>]+>/g;
const WHITESPACE_PATTERN = /\s+/g;

const VERIFICATION_PATTERNS = [
  {
    name: 'marriott-en',
    regex:
      /(?:marriott|bonvoy|marriott bonvoy)[\s\S]{0,80}?(?:verification code|security code|sign-in code|passcode|one-time passcode|otp)[^\n]{0,40}?((?=[A-Z0-9]*\d)[A-Z0-9]{4,8})/gi
  },
  {
    name: 'marriott-zh',
    regex:
      /(?:万豪|万豪旅享家)[\s\S]{0,80}?(?:验证码|校验码|动态码|安全码|一次性密码)[^\n]{0,24}?((?=[A-Z0-9]*\d)[A-Z0-9]{4,8})/gi
  },
  {
    name: 'keyword-before-code-en',
    regex:
      /(?:verification code|security code|sign-in code|passcode|one-time passcode|one-time code|authentication code|otp)[^\n]{0,40}?((?=[A-Z0-9]*\d)[A-Z0-9]{4,8})/gi
  },
  {
    name: 'keyword-before-code-zh',
    regex: /(?:验证码|校验码|动态码|安全码|一次性密码)[^\n]{0,24}?((?=[A-Z0-9]*\d)[A-Z0-9]{4,8})/gi
  },
  {
    name: 'code-before-keyword-en',
    regex:
      /\b((?=[A-Z0-9]*\d)[A-Z0-9]{4,8})\b(?=[^\n]{0,40}(?:verification code|security code|passcode|otp|one-time code|authentication code))/gi
  },
  {
    name: 'code-before-keyword-zh',
    regex: /\b((?=[A-Z0-9]*\d)[A-Z0-9]{4,8})\b(?=[^\n]{0,24}(?:验证码|校验码|动态码|安全码|一次性密码))/gi
  }
];

/**
 * @typedef {Object} VerificationCodeMatch
 * @property {string} code Extracted verification code.
 * @property {string} matchedBy Pattern identifier.
 * @property {number} score Pattern ranking score.
 */

/**
 * Normalizes email text so code extraction can work across plain text and HTML.
 *
 * @param {string} content Raw email body.
 * @returns {string}
 */
function normalizeEmailContent(content) {
  return String(content || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(HTML_TAG_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}

/**
 * Scores candidate codes so the most likely verification code is returned first.
 *
 * Numeric 6-digit codes are ranked highest because they are the most common
 * format in Marriott verification emails.
 *
 * @param {string} code Candidate verification code.
 * @param {number} patternPriority Lower is better.
 * @param {number[]} preferredLengths Preferred code lengths.
 * @returns {number}
 */
function scoreCode(code, patternPriority, preferredLengths) {
  const normalized = String(code).toUpperCase();
  let score = Math.max(0, 100 - patternPriority * 10);

  if (/^\d+$/.test(normalized)) {
    score += 30;
  }

  const preferredIndex = preferredLengths.indexOf(normalized.length);
  if (preferredIndex >= 0) {
    score += Math.max(0, 20 - preferredIndex * 5);
  }

  return score;
}

/**
 * Extracts all verification-code candidates from email content.
 *
 * @param {string} content Email subject/body content.
 * @param {{ preferredLengths?: number[] }} [options={}] Parser options.
 * @returns {VerificationCodeMatch[]}
 */
function extractVerificationCodes(content, options = {}) {
  const normalizedContent = normalizeEmailContent(content);
  const preferredLengths = Array.isArray(options.preferredLengths) && options.preferredLengths.length > 0
    ? options.preferredLengths
    : [6, 8, 4];
  const seenCodes = new Set();
  const matches = [];

  VERIFICATION_PATTERNS.forEach((pattern, index) => {
    pattern.regex.lastIndex = 0;

    for (const match of normalizedContent.matchAll(pattern.regex)) {
      const code = String(match[1] || '').toUpperCase();

      if (!code || seenCodes.has(code)) {
        continue;
      }

      seenCodes.add(code);
      matches.push({
        code,
        matchedBy: pattern.name,
        score: scoreCode(code, index, preferredLengths)
      });
    }
  });

  return matches.sort((left, right) => right.score - left.score);
}

/**
 * Extracts the most likely verification code from email content.
 *
 * @param {string} content Email subject/body content.
 * @param {{ preferredLengths?: number[] }} [options={}] Parser options.
 * @returns {VerificationCodeMatch|null}
 */
function extractVerificationCode(content, options = {}) {
  const [bestMatch] = extractVerificationCodes(content, options);
  return bestMatch || null;
}

module.exports = {
  extractVerificationCode,
  extractVerificationCodes,
  normalizeEmailContent
};
