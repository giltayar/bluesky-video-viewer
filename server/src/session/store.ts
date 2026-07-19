import { randomBytes } from 'node:crypto';

export interface AppSession {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

/**
 * Maps an opaque app-session id (stored in an httpOnly cookie) to the
 * authenticated account. The OAuth tokens themselves live in the OAuth
 * SessionStore, keyed by DID. In-memory for dev; use Redis/DB in production.
 */
export class AppSessionStore {
  private store = new Map<string, AppSession>();

  create(session: AppSession): string {
    const id = randomBytes(24).toString('hex');
    this.store.set(id, session);
    return id;
  }

  get(id: string): AppSession | undefined {
    return this.store.get(id);
  }

  del(id: string): void {
    this.store.delete(id);
  }
}
