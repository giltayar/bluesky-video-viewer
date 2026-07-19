import { Agent } from '@atproto/api';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HandleResolutionError, resolveToDid } from '../bsky/resolveIdentity.ts';
import { config } from '../config.ts';
import { getSession, getSessionId, SESSION_COOKIE } from '../session/cookie.ts';
import type { AppSessionStore } from '../session/store.ts';

const loginSchema = z.object({ handle: z.string().trim().min(1).max(256) });

export function registerAuthRoutes(
  app: FastifyInstance,
  oauth: NodeOAuthClient,
  appSessions: AppSessionStore,
): void {
  // Public OAuth discovery documents.
  app.get('/client-metadata.json', async () => oauth.clientMetadata);
  app.get('/jwks.json', async () => oauth.jwks);

  // Start the OAuth flow: returns the URL to redirect the browser to.
  app.post('/api/oauth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'A Bluesky handle is required.' });
    }

    // Resolve the handle to a DID ourselves (see resolveToDid for why), then
    // authorize by DID so the OAuth client skips handle resolution.
    let did: string;
    try {
      did = await resolveToDid(parsed.data.handle);
    } catch (err) {
      const message =
        err instanceof HandleResolutionError
          ? err.message
          : 'Could not resolve that handle.';
      return reply.code(400).send({ error: message });
    }

    try {
      const url = await oauth.authorize(did, {
        scope: config.scope,
      });
      return { redirectUrl: url.toString() };
    } catch (err) {
      req.log.error({ err }, 'oauth authorize failed');
      return reply
        .code(400)
        .send({ error: 'Could not start login. Please try again.' });
    }
  });

  // OAuth callback: exchange the code, create an app session, redirect to the app.
  app.get('/api/oauth/callback', async (req, reply) => {
    const params = new URLSearchParams(
      (req.raw.url ?? '').split('?')[1] ?? '',
    );

    try {
      const { session } = await oauth.callback(params);
      const agent = new Agent(session);
      const profile = await agent.getProfile({ actor: session.did });

      const sid = appSessions.create({
        did: session.did,
        handle: profile.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar,
      });

      reply.setCookie(SESSION_COOKIE, sid, {
        httpOnly: true,
        secure: config.isProd,
        sameSite: 'lax',
        path: '/',
        signed: true,
        maxAge: 60 * 60 * 24 * 7,
      });

      return reply.redirect(config.frontendUrl);
    } catch (err) {
      req.log.error({ err }, 'oauth callback failed');
      return reply.redirect(`${config.frontendUrl}/login?error=auth`);
    }
  });

  // Current session info for UI bootstrapping.
  app.get('/api/session', async (req, reply) => {
    const session = getSession(app, req, appSessions);
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });
    return {
      did: session.did,
      handle: session.handle,
      displayName: session.displayName,
      avatar: session.avatar,
    };
  });

  // Log out: clear the cookie and revoke the OAuth session.
  app.post('/api/logout', async (req, reply) => {
    const session = getSession(app, req, appSessions);
    const sid = getSessionId(app, req);
    if (sid) appSessions.del(sid);
    if (session) {
      try {
        await oauth.revoke(session.did);
      } catch (err) {
        req.log.warn({ err }, 'oauth revoke failed');
      }
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });
}
