import Hls from 'hls.js';
import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Attach an HLS source to a <video> when `enabled`. Uses native HLS on Safari,
 * otherwise hls.js. Detaches (freeing the network/decoder) when disabled or on
 * unmount, so off-screen cards don't keep buffering.
 */
export function useHlsVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
  enabled: boolean,
): void {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 20 });
      hls.loadSource(src);
      hls.attachMedia(video);
      return () => {
        hls.destroy();
      };
    }

    // Last-resort fallback.
    video.src = src;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, [videoRef, src, enabled]);
}
