import { Agent } from '@atproto/api';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fetchVideoPage } from '../bsky/fetchFeed.ts';
import { BadFeedError, parseFeedInput } from '../bsky/resolveFeed.ts';
import { getSession } from '../session/cookie.ts';
import type { AppSessionStore } from '../session/store.ts';

const feedQuerySchema = z.object({
  url: z.string().trim().min(1),
  cursor: z.string().optional(),
});

export function registerFeedRoutes(
  app: FastifyInstance,
  oauth: NodeOAuthClient,
  appSessions: AppSessionStore,
): void {
  app.get('/api/feed', async (req, reply) => {
    const session = getSession(app, req, appSessions);
    if (!session) return reply.code(401).send({ error: 'unauthenticated' });

    const parsed = feedQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'A feed url query parameter is required.' });
    }

    let target;
    try {
      target = parseFeedInput(parsed.data.url);
    } catch (err) {
      if (err instanceof BadFeedError) {
        return reply.code(400).send({ error: err.message });
      }
      throw err;
    }

    let oauthSession;
    try {
      oauthSession = await oauth.restore(session.did);
    } catch (err) {
      req.log.warn({ err }, 'oauth restore failed');
      return reply.code(401).send({ error: 'Session expired. Please log in again.' });
    }

    const agent = new Agent(oauthSession);

    try {
      const result = await fetchVideoPage(agent, target, parsed.data.cursor);
      return result;
    } catch (err) {
      req.log.error({ err }, 'feed fetch failed');
      return reply.code(502).send({ error: 'Failed to fetch feed from Bluesky.' });
    }
  });
}
