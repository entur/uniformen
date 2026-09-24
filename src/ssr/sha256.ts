/**
 * Returns the SHA-256 hash of an inline script or style as a CSP source, for
 * example `'sha256-…'`. Pass the EXACT text between the tag's `>` and `</…>`, or
 * the browser will block it.
 */
export async function sha256Source(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return `'sha256-${Buffer.from(digest).toString("base64")}'`;
}
