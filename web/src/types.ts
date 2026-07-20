export interface VideoAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface VideoItem {
  postUri: string;
  postUrl: string;
  cid: string;
  playlistUrl: string;
  thumbnailUrl?: string;
  aspectRatio?: { width: number; height: number };
  alt?: string;
  text: string;
  author: VideoAuthor;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  indexedAt: string;
  /** The viewer's like record URI, if they have already liked this post. */
  viewerLikeUri?: string;
}

export interface FeedResponse {
  videos: VideoItem[];
  cursor?: string;
}

export interface SessionInfo {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}
