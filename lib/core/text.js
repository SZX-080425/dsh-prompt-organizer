/**
 * Small text helpers shared by the deterministic analyzers.
 * Presented text is model-facing markdown, so these helpers stay lossless
 * enough to keep the user's own words recognizable.
 * @module prompt-organizer/text
 */

/** Leading list markers in either language: "-", "*", "1.", "2)", "（一）". */
const BULLET_PREFIX = /^\s*(?:[-*•‣·>]|\d{1,3}[.)、]|[(（][0-9a-zA-Z一二三四五六七八九十]{1,3}[)）])\s*/u

/** Punctuation that carries no meaning at a fragment edge. */
const EDGE_PUNCTUATION = /^[\s,，、.。:：;；\-–—>》»"“'‘]+|[\s,，、.。:：;；\-–—<《«"”'’]+$/gu

/** Sentence-ish separators. ASCII "." is excluded so "React.js" survives. */
const SENTENCE_BREAK = /[\n\r。！？!?；;]+/u

/** CJK ideographs, used for language and locale detection. */
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u

/**
 * Whether a value contains CJK ideographs.
 * @param {unknown} value - any candidate.
 * @returns {boolean} true when CJK text is present.
 */
export function isCjkText(value) {
  return CJK.test(String(value ?? ''))
}

/**
 * Split raw notes into ordered, de-duplicated fragments.
 * @param {string} text - the user's raw text.
 * @param {{limit?: number, maxLength?: number}} [options] - bounds.
 * @returns {string[]} fragments in original order.
 */
export function splitFragments(text, options = {}) {
  const limit = options.limit ?? 240
  const maxLength = options.maxLength ?? 400
  if (typeof text !== 'string' || text.trim() === '') return []
  const fragments = []
  const seen = new Set()
  for (const chunk of text.split(SENTENCE_BREAK)) {
    let fragment = chunk.replace(BULLET_PREFIX, '').replace(EDGE_PUNCTUATION, '').trim()
    if (fragment === '') continue
    if (fragment.length > maxLength) fragment = `${fragment.slice(0, maxLength)}…`
    const key = fragment.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    fragments.push(fragment)
    if (fragments.length >= limit) break
  }
  return fragments
}

/**
 * Collapse whitespace and bound a value for inline display.
 * @param {unknown} value - any candidate.
 * @param {number} [limit] - maximum characters.
 * @returns {string} display text.
 */
export function shorten(value, limit = 80) {
  const text = String(value ?? '').replace(/\s+/gu, ' ').trim()
  if (limit <= 0) return ''
  return text.length <= limit ? text : `${text.slice(0, Math.max(1, limit - 1))}…`
}

/**
 * Build a filesystem-safe slug from a human title.
 * @param {unknown} value - title or name.
 * @param {string} [fallback] - used when nothing survives filtering.
 * @returns {string} lowercase slug.
 */
export function slugify(value, fallback = 'prompt') {
  const slug = String(value ?? '')
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLocaleLowerCase()
  return (slug === '' ? fallback : slug).slice(0, 48)
}

/**
 * Trim, drop empties, and remove case-insensitive duplicates while keeping order.
 * @param {unknown} values - candidate list.
 * @returns {string[]} cleaned strings.
 */
export function uniqueStrings(values) {
  const output = []
  const seen = new Set()
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value ?? '').trim()
    if (text === '') continue
    const key = text.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(text)
  }
  return output
}

/**
 * Whether a value is a plain object record.
 * @param {unknown} value - any candidate.
 * @returns {boolean} true for a non-array object.
 */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
