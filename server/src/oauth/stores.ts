import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from '@atproto/oauth-client-node';

/**
 * In-memory OAuth state store (short-lived authorize->callback state).
 * Swap for Redis/DB in production. Entries are removed by the OAuth client
 * once the flow completes.
 */
export class StateStore implements NodeSavedStateStore {
  private store = new Map<string, NodeSavedState>();

  async get(key: string): Promise<NodeSavedState | undefined> {
    return this.store.get(key);
  }

  async set(key: string, state: NodeSavedState): Promise<void> {
    this.store.set(key, state);
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * In-memory OAuth session store, keyed by account DID. Holds tokens and the
 * DPoP key. Swap for Redis/DB in production so sessions survive restarts.
 */
export class SessionStore implements NodeSavedSessionStore {
  private store = new Map<string, NodeSavedSession>();

  async get(sub: string): Promise<NodeSavedSession | undefined> {
    return this.store.get(sub);
  }

  async set(sub: string, session: NodeSavedSession): Promise<void> {
    this.store.set(sub, session);
  }

  async del(sub: string): Promise<void> {
    this.store.delete(sub);
  }
}
