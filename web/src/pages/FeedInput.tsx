import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthError, getSession, logout } from '../api.ts';
import type { SessionInfo } from '../types.ts';

export default function FeedInput() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedUrl, setFeedUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession()
      .then((s) => setSession(s))
      .catch((err) => {
        if (err instanceof AuthError) navigate('/login', { replace: true });
        else setError(err instanceof Error ? err.message : 'Failed to load session.');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = feedUrl.trim();
    if (!looksLikeFeed(value)) {
      setError('Enter a bsky.app feed/profile URL or an at:// feed URI.');
      return;
    }
    navigate(`/watch?url=${encodeURIComponent(value)}`);
  }

  async function onLogout() {
    await logout().catch(() => undefined);
    navigate('/login', { replace: true });
  }

  if (loading) {
    return <div className="status-screen">Loading…</div>;
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={onSubmit}>
        <h1>Pick a feed</h1>
        <p>
          Signed in as <strong>@{session?.handle}</strong>. Paste a Bluesky feed
          URL, a profile URL, or an <code>at://</code> feed URI.
        </p>
        <div className="field">
          <label htmlFor="feedUrl">Feed URL</label>
          <input
            id="feedUrl"
            type="text"
            placeholder="https://bsky.app/profile/…/feed/…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            required
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn" type="submit" disabled={!feedUrl.trim()}>
          Watch
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => navigate(`/watch?url=${encodeURIComponent('following')}`)}
        >
          Watch my Following feed
        </button>
        <button className="btn btn-ghost" type="button" onClick={onLogout}>
          Log out
        </button>
      </form>
    </div>
  );
}

function looksLikeFeed(value: string): boolean {
  if (value.startsWith('at://')) return true;
  try {
    const url = new URL(value);
    return url.hostname === 'bsky.app' || url.hostname.endsWith('.bsky.app');
  } catch {
    return false;
  }
}
