/**
 * SHA-256 of an inline block's body as a CSP source token, e.g. `'sha256-…'`.
 * Hash the EXACT bytes that appear between the tag's `>` and `</…>`.
 */
export async function sha256Source(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return `'sha256-${Buffer.from(digest).toString("base64")}'`;
}
