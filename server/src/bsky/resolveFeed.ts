export class BadFeedError extends Error {}

export type FeedTarget =
  | { kind: 'generator'; uri?: string; did?: string; handle?: string; rkey?: string }
  | { kind: 'author'; actor: string };

const AT_GENERATOR_RE = /^at:\/\/([^/]+)\/app\.bsky\.feed\.generator\/([^/]+)$/;

/**
 * Parse a user-supplied feed reference into a target we can fetch.
 *
 * Accepts:
 *  - at://<did>/app.bsky.feed.generator/<rkey>
 *  - https://bsky.app/profile/<handle-or-did>/feed/<rkey>   (custom feed)
 *  - https://bsky.app/profile/<handle-or-did>               (author's posts)
 */
export function parseFeedInput(input: string): FeedTarget {
  const trimmed = input.trim();
  if (!trimmed) throw new BadFeedError('No feed URL provided.');

  if (trimmed.startsWith('at://')) {
    const m = AT_GENERATOR_RE.exec(trimmed);
    if (m) return { kind: 'generator', uri: trimmed, did: m[1], rkey: m[2] };
    throw new BadFeedError(
      'Only feed generator AT URIs (app.bsky.feed.generator) are supported.',
    );
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new BadFeedError('That does not look like a valid URL or AT URI.');
  }

  const isBsky = url.hostname === 'bsky.app' || url.hostname.endsWith('.bsky.app');
  if (!isBsky) {
    throw new BadFeedError('Please provide a bsky.app feed URL or an AT URI.');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'profile' && parts[1]) {
    const actor = decodeURIComponent(parts[1]);
    if (parts[2] === 'feed' && parts[3]) {
      return { kind: 'generator', handle: actor, rkey: decodeURIComponent(parts[3]) };
    }
    if (!parts[2]) {
      return { kind: 'author', actor };
    }
  }

  throw new BadFeedError(
    'Unrecognized bsky.app URL. Use a feed URL (…/feed/…) or a profile URL.',
  );
}
