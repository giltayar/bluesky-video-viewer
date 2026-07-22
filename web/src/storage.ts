// Small, safe wrappers around localStorage (which can throw in private mode or
// when storage is disabled). Used to remember the last-entered handle / feed URL.

const HANDLE_KEY = 'bvv.handle';
const FEED_URL_KEY = 'bvv.feedUrl';
const LAST_VIDEO_KEY = 'bvv.lastVideo';

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

function readMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export const getStoredHandle = (): string => read(HANDLE_KEY);
export const setStoredHandle = (value: string): void => write(HANDLE_KEY, value);

export const getStoredFeedUrl = (): string => read(FEED_URL_KEY);
export const setStoredFeedUrl = (value: string): void => write(FEED_URL_KEY, value);

/** The post URI of the last video the user viewed in a given feed. */
export const getLastVideo = (feedUrl: string): string | undefined =>
  readMap(LAST_VIDEO_KEY)[feedUrl];

export const setLastVideo = (feedUrl: string, postUri: string): void => {
  const map = readMap(LAST_VIDEO_KEY);
  map[feedUrl] = postUri;
  write(LAST_VIDEO_KEY, JSON.stringify(map));
};

