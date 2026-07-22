import { useEffect, useRef, useState } from 'react';
import type { VideoItem } from '../types.ts';
import VideoCard from './VideoCard.tsx';

interface Props {
  videos: VideoItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Called when the active (in-view) video changes. */
  onActiveChange?: (video: VideoItem) => void;
  /** If set, scroll to this post once it is present in the list. */
  scrollToPostUri?: string;
}

export default function VideoFeed({
  videos,
  hasMore,
  loadingMore,
  onLoadMore,
  onActiveChange,
  scrollToPostUri,
}: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  // Feed-wide mute state: turning sound on/off persists across videos.
  const [muted, setMuted] = useState(true);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrolledToRef = useRef<string | undefined>(undefined);

  // Track which card is centered in the viewport via IntersectionObserver.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Number(
              (entry.target as HTMLElement).dataset.index ?? '0',
            );
            setActiveIndex(index);
          }
        }
      },
      { threshold: [0.6] },
    );

    for (const el of cardRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [videos.length]);

  // Scroll to a requested video (e.g. "resume") once it is loaded.
  useEffect(() => {
    if (!scrollToPostUri || scrolledToRef.current === scrollToPostUri) return;
    const index = videos.findIndex((v) => v.postUri === scrollToPostUri);
    if (index < 0) return;
    scrolledToRef.current = scrollToPostUri;
    if (index > 0) {
      cardRefs.current[index]?.scrollIntoView();
      setActiveIndex(index);
    }
  }, [scrollToPostUri, videos]);

  // Report the currently active video to the parent (for "resume" tracking).
  useEffect(() => {
    const video = videos[activeIndex];
    if (video) onActiveChange?.(video);
  }, [activeIndex, videos, onActiveChange]);

  // Prefetch next page when nearing the end.
  useEffect(() => {
    if (hasMore && !loadingMore && activeIndex >= videos.length - 2) {
      onLoadMore();
    }
  }, [activeIndex, hasMore, loadingMore, videos.length, onLoadMore]);

  return (
    <div className="feed">
      {videos.map((video, index) => (
        <div
          key={video.postUri}
          data-index={index}
          ref={(el) => {
            cardRefs.current[index] = el;
          }}
        >
          <VideoCard
            video={video}
            isActive={index === activeIndex}
            preload={index === activeIndex + 1}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
          />
        </div>
      ))}
      {loadingMore && <div className="status-screen">Loading more…</div>}
    </div>
  );
}
