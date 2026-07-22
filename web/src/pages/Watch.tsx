import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthError, getFeed } from '../api.ts';
import VideoFeed from '../components/VideoFeed.tsx';
import { getLastVideo, setLastVideo } from '../storage.ts';
import type { VideoItem } from '../types.ts';

export default function Watch() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const feedUrl = params.get('url') ?? '';

  useEffect(() => {
    if (!feedUrl) navigate('/', { replace: true });
  }, [feedUrl, navigate]);

  if (!feedUrl) return null;

  // Keyed by feedUrl so navigating to another feed (e.g. an author's profile)
  // fully remounts and reloads instead of keeping the previous feed's state.
  return <FeedViewer key={feedUrl} feedUrl={feedUrl} />;
}

function FeedViewer({ feedUrl }: { feedUrl: string }) {
  const navigate = useNavigate();

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Captured once at mount, before scrolling overwrites it: the last video the
  // user viewed in this feed during a previous visit.
  const [resumeTarget] = useState<string | undefined>(() => getLastVideo(feedUrl) || undefined);
  // The video we're actively jumping to (set when the user taps "resume").
  const [resumeToUri, setResumeToUri] = useState<string | null>(null);
  const [jumping, setJumping] = useState(false);

  // Guards against overlapping fetches and React StrictMode double-invoke.
  const fetchingRef = useRef(false);
  const seenRef = useRef(new Set<string>());
  const cursorRef = useRef<string | undefined>(undefined);
  const initializedRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const res = await getFeed(feedUrl, cursorRef.current);
      const fresh = res.videos.filter((v) => !seenRef.current.has(v.postUri));
      for (const v of fresh) seenRef.current.add(v.postUri);
      setVideos((prev) => [...prev, ...fresh]);
      cursorRef.current = res.cursor;
      setCursor(res.cursor);
      setHasMore(Boolean(res.cursor));
    } catch (err) {
      if (err instanceof AuthError) {
        navigate('/login', { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to load feed.');
      setHasMore(false);
    } finally {
      fetchingRef.current = false;
      setLoadingMore(false);
      setLoading(false);
    }
  }, [feedUrl, hasMore, navigate]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    void loadMore();
  }, [loadMore]);

  // Persist the last-viewed video per feed so it can be resumed later.
  const onActiveChange = useCallback(
    (video: VideoItem) => setLastVideo(feedUrl, video.postUri),
    [feedUrl],
  );

  // While jumping to the resume target, keep loading pages until it appears
  // (unbounded — it may be deep in the feed) or the feed is exhausted.
  useEffect(() => {
    if (!resumeToUri) return;
    if (videos.some((v) => v.postUri === resumeToUri)) {
      setJumping(false);
      return;
    }
    if (!hasMore) {
      setJumping(false);
      setResumeToUri(null);
      return;
    }
    if (!loadingMore && !fetchingRef.current) {
      void loadMore();
    }
  }, [resumeToUri, videos, hasMore, loadingMore, loadMore]);

  function goToLastVideo() {
    if (!resumeTarget) return;
    setResumeToUri(resumeTarget);
    setJumping(true);
  }

  if (loading) {
    return <div className="status-screen">Loading videos…</div>;
  }

  if (error && videos.length === 0) {
    return (
      <div className="status-screen">
        <p className="error">{error}</p>
        <Link className="btn btn-ghost" to="/">
          Back
        </Link>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="status-screen">
        <p>No videos found in this feed.</p>
        <Link className="btn btn-ghost" to="/">
          Try another feed
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <Link className="btn btn-ghost" to="/">
          ← Feeds
        </Link>
        {resumeTarget && !resumeToUri && (
          <button className="btn btn-ghost" type="button" onClick={goToLastVideo}>
            Go to last video seen
          </button>
        )}
      </div>
      {jumping && <div className="jump-indicator">Finding where you left off…</div>}
      <VideoFeed
        videos={videos}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onActiveChange={onActiveChange}
        scrollToPostUri={resumeToUri ?? undefined}
      />
    </>
  );
}
