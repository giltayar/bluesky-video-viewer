import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startLogin } from '../api.ts';

export default function Login() {
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error') === 'auth';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { redirectUrl } = await startLogin(handle.trim());
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card" onSubmit={onSubmit}>
        <h1>Bluesky Video Viewer</h1>
        <p>
          Sign in with your Bluesky account to watch feeds as a full-screen video
          stream. You&apos;ll approve access on your own Bluesky server — your
          password is never entered here.
        </p>
        <div className="field">
          <label htmlFor="handle">Bluesky handle</label>
          <input
            id="handle"
            type="text"
            placeholder="alice.bsky.social"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            required
          />
        </div>
        {(error || authError) && (
          <div className="error">
            {error ?? 'Sign-in was cancelled or failed. Please try again.'}
          </div>
        )}
        <button className="btn" type="submit" disabled={busy || !handle.trim()}>
          {busy ? 'Redirecting…' : 'Sign in with Bluesky'}
        </button>
      </form>
    </div>
  );
}
