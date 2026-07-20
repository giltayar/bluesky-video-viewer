import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { likePost, unlikePost } from '../api.ts';
import { useHlsVideo } from '../hooks/useHlsVideo.ts';
import type { VideoItem } from '../types.ts';

interface Props {
  video: VideoItem;
  isActive: boolean;
  /** Load media for the active card and its immediate neighbors only. */
  preload: boolean;
  /** Shared, feed-wide mute state so sound persists across videos. */
  muted: boolean;
  onToggleMute: () => void;
}

export default function VideoCard({
  video,
  isActive,
  preload,
  muted,
  onToggleMute,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showMute, setShowMute] = useState(false);
  const navigate = useNavigate();

  const [liked, setLiked] = useState(Boolean(video.viewerLikeUri));
  const [likeCount, setLikeCount] = useState(video.likeCount);
  const likeUriRef = useRef<string | undefined>(video.viewerLikeUri);
  const likeBusyRef = useRef(false);

  useHlsVideo(videoRef, video.playlistUrl, isActive || preload);

  // Keep the element in sync with the shared mute state.
  useEffect(() => {
    const el = videoRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  // Play only the active card; pause and rewind the rest.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      el.play().catch(() => undefined);
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isActive]);

  function toggleMute() {
    onToggleMute();
    setShowMute(true);
    window.setTimeout(() => setShowMute(false), 700);
  }

  function openAuthorFeed() {
    const profileUrl = `https://bsky.app/profile/${video.author.did}`;
    navigate(`/watch?url=${encodeURIComponent(profileUrl)}`);
  }

  // Toggle like with an optimistic UI update; revert on failure.
  const toggleLike = useCallback(async () => {
    if (likeBusyRef.current) return;
    likeBusyRef.current = true;

    if (liked) {
      const uri = likeUriRef.current;
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      try {
        if (uri) await unlikePost(uri);
        likeUriRef.current = undefined;
      } catch {
        setLiked(true);
        setLikeCount((c) => c + 1);
      } finally {
        likeBusyRef.current = false;
      }
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      try {
        const { likeUri } = await likePost(video.postUri, video.cid);
        likeUriRef.current = likeUri;
      } catch {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } finally {
        likeBusyRef.current = false;
      }
    }
  }, [liked, video.postUri, video.cid]);

  // Pressing "L" likes/unlikes the currently active video.
  useEffect(() => {
    if (!isActive) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'l' && e.key !== 'L') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      void toggleLike();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, toggleLike]);

  return (
    <div className="video-card">
      <video
        ref={videoRef}
        poster={video.thumbnailUrl}
        muted={muted}
        loop
        playsInline
        preload="none"
        onClick={toggleMute}
        style={{objectFit: 'contain'}}
      />
      <div className={`mute-indicator${showMute ? ' show' : ''}`}>
        {muted ? 'Muted' : 'Sound on'}
      </div>
      <div className="video-overlay">
        <button
          type="button"
          className="author-link"
          onClick={openAuthorFeed}
          title={`View @${video.author.handle}'s videos`}
        >
          {video.author.avatar && <img src={video.author.avatar} alt="" />}
          <div>
            <div className="author-name">
              {video.author.displayName ?? video.author.handle}
            </div>
            <div className="author-handle">@{video.author.handle}</div>
          </div>
        </button>
        {video.text && <p className="post-text">{video.text}</p>}
        <div className="stats">
          <button
            type="button"
            className={`like-btn${liked ? ' liked' : ''}`}
            onClick={toggleLike}
            aria-pressed={liked}
            title="Like (L)"
          >
            <span className="like-heart">{liked ? '♥' : '♡'}</span> {likeCount}
          </button>
          <span>⇄ {video.repostCount}</span>
          <span>💬 {video.replyCount}</span>
          <a href={video.postUrl} target="_blank" rel="noreferrer">
            View on Bluesky
          </a>
        </div>
      </div>
    </div>
  );
}
