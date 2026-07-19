import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppSession, AppSessionStore } from './store.ts';

export const SESSION_COOKIE = 'bvv_session';

/** Resolve the current app session from the signed cookie, or null. */
export function getSession(
  app: FastifyInstance,
  req: FastifyRequest,
  appSessions: AppSessionStore,
): AppSession | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;

  const unsigned = app.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) return null;

  return appSessions.get(unsigned.value) ?? null;
}

/** Read the raw (unsigned) session id, e.g. for logout cleanup. */
export function getSessionId(
  app: FastifyInstance,
  req: FastifyRequest,
): string | null {
  const raw = req.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const unsigned = app.unsignCookie(raw);
  return unsigned.valid ? unsigned.value : null;
}
