import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
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

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`OAuth client_id: ${oauth.clientMetadata.client_id}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
