import { Agent } from '@atproto/api';
import type { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getSession } from '../session/cookie.ts';
import type { AppSessionStore } from '../session/store.ts';

const likeSchema = z.object({
  uri: z.string().trim().min(1),
  cid: z.string().trim().min(1),
});

const unlikeSchema = z.object({
  likeUri: z.string().trim().min(1),
});

export function registerLikeRoutes(
  app: FastifyInstance,
  oauth: NodeOAuthClient,
  appSessions: AppSessionStore,
): void {
  async function agentFor(req: FastifyRequest): Promise<Agent | null> {
    const session = getSession(app, req, appSessions);
    if (!session) return null;
    const oauthSession = await oauth.restore(session.did);
    return new Agent(oauthSession);
  }

  // Like a post; returns the created like record URI.
  app.post('/api/like', async (req, reply) => {
    const parsed = likeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'uri and cid are required.' });
    }

    let agent: Agent | null;
    try {
      agent = await agentFor(req);
    } catch (err) {
      req.log.warn({ err }, 'oauth restore failed');
      return reply.code(401).send({ error: 'Session expired. Please log in again.' });
    }
    if (!agent) return reply.code(401).send({ error: 'unauthenticated' });

    try {
      const res = await agent.like(parsed.data.uri, parsed.data.cid);
      return { likeUri: res.uri };
    } catch (err) {
      req.log.error({ err }, 'like failed');
      return reply.code(502).send({ error: 'Failed to like the post.' });
    }
  });

  // Remove a like given its record URI.
  app.post('/api/unlike', async (req, reply) => {
    const parsed = unlikeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'likeUri is required.' });
    }

    let agent: Agent | null;
    try {
      agent = await agentFor(req);
    } catch (err) {
      req.log.warn({ err }, 'oauth restore failed');
      return reply.code(401).send({ error: 'Session expired. Please log in again.' });
    }
    if (!agent) return reply.code(401).send({ error: 'unauthenticated' });

    try {
      await agent.deleteLike(parsed.data.likeUri);
      return reply.code(204).send();
    } catch (err) {
      req.log.error({ err }, 'unlike failed');
      return reply.code(502).send({ error: 'Failed to remove the like.' });
    }
  });
}
