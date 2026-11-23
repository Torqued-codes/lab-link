import DOMPurify from "isomorphic-dompurify";

/**
 * Neutralizes indirect prompt injection & XML delimiter breakouts before passing user input to Gemini.
 */
export function sanitizeForPrompt(input: string, maxLen = 1500): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/<\/?untrusted_[^>]*>/gi, "[STRIPPED_TAG]")
    .replace(/<\/?system[^>]*>/gi, "[STRIPPED_TAG]")
    .trim()
    .slice(0, maxLen);
}

/**
 * Strips unsafe HTML/scripts to prevent Stored, Reflected, and DOM-based XSS.
 */
export function sanitizeText(dirty: string, maxLen = 600): string {
  const clean = DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return clean.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLen);
}

/**
 * Validates PDF uploads via magic-byte inspection (%PDF-) rather than spoofable MIME headers.
 */
export function validatePdfBuffer(buffer: Buffer, maxBytes = 5 * 1024 * 1024): boolean {
  if (buffer.length === 0 || buffer.length > maxBytes) return false;
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}