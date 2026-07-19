import { useEffect, useRef, useState } from 'react';
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

  const cover =
    video.aspectRatio && video.aspectRatio.height >= video.aspectRatio.width;

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
        style={{ objectFit: cover ? 'cover' : 'contain' }}
      />
      <div className={`mute-indicator${showMute ? ' show' : ''}`}>
        {muted ? 'Muted' : 'Sound on'}
      </div>
      <div className="video-overlay">
        <div className="author-row">
          {video.author.avatar && (
            <img src={video.author.avatar} alt="" />
          )}
          <div>
            <div className="author-name">
              {video.author.displayName ?? video.author.handle}
            </div>
            <div className="author-handle">@{video.author.handle}</div>
          </div>
        </div>
        {video.text && <p className="post-text">{video.text}</p>}
        <div className="stats">
          <span>♥ {video.likeCount}</span>
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
