import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { config } from './config.ts';
import { createOAuthClient } from './oauth/client.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerFeedRoutes } from './routes/feed.ts';
import { AppSessionStore } from './session/store.ts';

const app = Fastify({ logger: true });

await app.register(cookie, { secret: config.cookieSecret });
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

const oauth = await createOAuthClient();
const appSessions = new AppSessionStore();

registerAuthRoutes(app, oauth, appSessions);
registerFeedRoutes(app, oauth, appSessions);

// Serve the built SPA (single-service deployment). In dev the frontend is
// served by Vite instead, so this is skipped when web/dist is absent.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });

  // SPA fallback: serve index.html for client-side routes (e.g. /login, /watch)
  // while leaving API and OAuth discovery routes to 404 as JSON.
  app.setNotFoundHandler((req, reply) => {
    if (
      req.method === 'GET' &&
      !req.url.startsWith('/api/') &&
      req.url !== '/client-metadata.json' &&
      req.url !== '/jwks.json'
    ) {
      return reply.sendFile('index.html');
    }
    return reply.code(404).send({ error: 'not found' });
  });
}

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`OAuth client_id: ${oauth.clientMetadata.client_id}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
