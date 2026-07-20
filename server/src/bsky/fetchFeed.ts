import type { Agent, AppBskyFeedDefs } from '@atproto/api';
import type { FeedResponse } from '../types.ts';
import { extractVideo } from './extractVideo.ts';
import type { FeedTarget } from './resolveFeed.ts';

const PAGE_LIMIT = 30;
const MAX_PAGES = 3;

interface RawPage {
  feed: AppBskyFeedDefs.FeedViewPost[];
  cursor?: string;
}

async function getPage(
  agent: Agent,
  target: FeedTarget,
  cursor: string | undefined,
): Promise<RawPage> {
  if (target.kind === 'timeline') {
    const res = await agent.getTimeline({ limit: PAGE_LIMIT, cursor });
    return { feed: res.data.feed, cursor: res.data.cursor };
  }

  if (target.kind === 'author') {
    const res = await agent.getAuthorFeed({
      actor: target.actor,
      filter: 'posts_with_media',
      limit: PAGE_LIMIT,
      cursor,
    });
    return { feed: res.data.feed, cursor: res.data.cursor };
  }

  let uri = target.uri;
  if (!uri) {
    let did = target.did;
    if (!did) {
      const handle = target.handle!;
      did = handle.startsWith('did:')
        ? handle
        : (await agent.resolveHandle({ handle })).data.did;
    }
    uri = `at://${did}/app.bsky.feed.generator/${target.rkey}`;
  }

  const res = await agent.app.bsky.feed.getFeed({
    feed: uri,
    limit: PAGE_LIMIT,
    cursor,
  });
  return { feed: res.data.feed, cursor: res.data.cursor };
}

/**
 * Fetch a page of the feed and return only video posts. If a page contains no
 * videos but more pages exist, keep paging (bounded) so callers aren't handed
 * an empty result while videos remain deeper in the feed.
 */
export async function fetchVideoPage(
  agent: Agent,
  target: FeedTarget,
  cursor: string | undefined,
): Promise<FeedResponse> {
  const videos: FeedResponse['videos'] = [];
  let nextCursor = cursor;
  let pages = 0;

  do {
    const page = await getPage(agent, target, nextCursor);
    nextCursor = page.cursor;
    for (const item of page.feed) {
      const video = extractVideo(item);
      if (video) videos.push(video);
    }
    pages += 1;
  } while (videos.length === 0 && nextCursor && pages < MAX_PAGES);

  return { videos, cursor: nextCursor };
}
