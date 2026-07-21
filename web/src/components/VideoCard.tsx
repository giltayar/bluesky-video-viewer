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
  const [paused, setPaused] = useState(false);
  const navigate = useNavigate();

  const [liked, setLiked] = useState(Boolean(video.viewerLikeUri));
  const [likeCount, setLikeCount] = useState(video.likeCount);
  const likeUriRef = useRef<string | undefined>(video.viewerLikeUri);
  const likeBusyRef = useRef(false);

  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  useHlsVideo(videoRef, video.playlistUrl, isActive || preload);

  // Track playback progress / remaining time for the scrubber and readout.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    function update() {
      const dur = el!.duration;
      if (Number.isFinite(dur) && dur > 0) {
        setProgress(el!.currentTime / dur);
        setRemaining(Math.max(0, dur - el!.currentTime));
      } else {
        setProgress(0);
        setRemaining(null);
      }
    }
    el.addEventListener('timeupdate', update);
    el.addEventListener('loadedmetadata', update);
    el.addEventListener('durationchange', update);
    return () => {
      el.removeEventListener('timeupdate', update);
      el.removeEventListener('loadedmetadata', update);
      el.removeEventListener('durationchange', update);
    };
  }, []);

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
      setPaused(false);
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isActive]);

  function togglePlay() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => undefined);
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
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
        onClick={togglePlay}
        style={{objectFit: 'contain'}}
      />
      {isActive && paused && (
        <div className="play-indicator" aria-hidden="true">
          ▶
        </div>
      )}
      <button
        type="button"
        className="sound-toggle"
        onClick={onToggleMute}
        aria-pressed={!muted}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
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
          {remaining != null && (
            <span className="time-remaining">{formatRemaining(remaining)}</span>
          )}
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
      {isActive && (
        <div className="scrubber">
          <div
            className="scrubber-fill"
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatRemaining(seconds: number): string {
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `-${mins}:${String(secs).padStart(2, '0')}`;
}
