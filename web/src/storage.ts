// Small, safe wrappers around localStorage (which can throw in private mode or
// when storage is disabled). Used to remember the last-entered handle / feed URL.

const HANDLE_KEY = 'bvv.handle';
const FEED_URL_KEY = 'bvv.feedUrl';

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

export const getStoredHandle = (): string => read(HANDLE_KEY);
export const setStoredHandle = (value: string): void => write(HANDLE_KEY, value);

export const getStoredFeedUrl = (): string => read(FEED_URL_KEY);
export const setStoredFeedUrl = (value: string): void => write(FEED_URL_KEY, value);
