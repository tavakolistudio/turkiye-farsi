/** Minimal XML helpers for hand-built sitemap / RSS documents. */

// XML 1.0 forbids most control characters; strip the illegal ones.
const ILLEGAL_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** Escape a string for safe inclusion in XML text/attribute content. */
export function xmlEscape(value: string): string {
  return value
    .replace(ILLEGAL_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Wrap CDATA safely (splitting any literal `]]>`). */
export function cdata(value: string): string {
  return `<![CDATA[${value.replace(ILLEGAL_XML_CHARS, "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

/** Build an XML Response with the declaration and sensible cache headers. */
export function xmlResponse(body: string, cacheSeconds = 3600): Response {
  return new Response(`${XML_HEADER}\n${body}`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    },
  });
}
