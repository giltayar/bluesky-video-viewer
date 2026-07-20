import {
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedPost,
} from '@atproto/api';
import type { AppBskyFeedDefs } from '@atproto/api';
import type { VideoItem } from '../types.ts';

type VideoView = AppBskyEmbedVideo.View;

/** Return the video embed view from a hydrated post embed, if present. */
function getVideoView(embed: unknown): VideoView | null {
  if (AppBskyEmbedVideo.isView(embed)) {
    return embed;
  }
  if (AppBskyEmbedRecordWithMedia.isView(embed) && AppBskyEmbedVideo.isView(embed.media)) {
    return embed.media;
  }
  return null;
}

/** Extract the record key (last path segment) from an at:// URI. */
function rkeyFromUri(uri: string): string {
  return uri.split('/').pop() ?? '';
}

/**
 * Map a feed item to a VideoItem, or null if the post has no video embed.
 */
export function extractVideo(item: AppBskyFeedDefs.FeedViewPost): VideoItem | null {
  const post = item.post;
  const video = getVideoView(post.embed);
  if (!video) return null;

  const author = post.author;
  const text = AppBskyFeedPost.isRecord(post.record) ? post.record.text : '';

  return {
    postUri: post.uri,
    postUrl: `https://bsky.app/profile/${author.handle}/post/${rkeyFromUri(post.uri)}`,
    cid: post.cid,
    playlistUrl: video.playlist,
    thumbnailUrl: video.thumbnail,
    aspectRatio: video.aspectRatio,
    alt: video.alt,
    text,
    author: {
      did: author.did,
      handle: author.handle,
      displayName: author.displayName,
      avatar: author.avatar,
    },
    likeCount: post.likeCount ?? 0,
    repostCount: post.repostCount ?? 0,
    replyCount: post.replyCount ?? 0,
    indexedAt: post.indexedAt,
    viewerLikeUri: post.viewer?.like,
  };
}
