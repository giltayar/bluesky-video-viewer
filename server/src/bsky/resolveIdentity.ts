const APPVIEW_URL = 'https://public.api.bsky.app';
const DID_RE = /^did:[a-z]+:/;

export class HandleResolutionError extends Error {}

/**
 * Resolve a user-supplied identifier (handle or DID) to a DID.
 *
 * We resolve handles ourselves via the public AppView instead of relying on the
 * OAuth client's built-in Node handle resolver: that resolver wraps fetch with
 * an SSRF-protected undici interceptor that is incompatible with the undici
 * bundled in current Node.js, breaking HTTP (.well-known) handle resolution.
 * Passing a DID to `authorize()` avoids that code path entirely.
 */
export async function resolveToDid(identifier: string): Promise<string> {
  const id = identifier.trim().replace(/^@/, '');
  if (DID_RE.test(id)) return id;

  const url = `${APPVIEW_URL}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(id)}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { accept: 'application/json' } });
  } catch {
    throw new HandleResolutionError('Could not reach Bluesky to resolve that handle.');
  }

  if (!res.ok) {
    throw new HandleResolutionError(`Could not resolve handle "${id}".`);
  }

  const data = (await res.json()) as { did?: string };
  if (!data.did) {
    throw new HandleResolutionError(`Could not resolve handle "${id}".`);
  }
  return data.did;
}
