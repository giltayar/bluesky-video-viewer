const port = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

// Railway (and similar hosts) expose the service's public domain. Use it as the
// default public origin so the OAuth redirect_uri / metadata URLs are correct
// without extra configuration.
const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
const publicUrl =
  process.env.PUBLIC_URL ??
  (railwayDomain ? `https://${railwayDomain}` : `http://127.0.0.1:${port}`);

export const config = {
  port,
  // Bind all interfaces in production so the platform can route to the service.
  host: process.env.HOST ?? (isProd ? '0.0.0.0' : '127.0.0.1'),
  publicUrl,
  // In a single-service deployment the SPA is served from the same origin.
  frontendUrl: process.env.FRONTEND_URL ?? (isProd ? publicUrl : 'http://127.0.0.1:5173'),
  cookieSecret: process.env.COOKIE_SECRET ?? 'dev-insecure-cookie-secret-change-me',
  isProd,
  // Requested OAuth scopes: identity + generic PDS/AppView proxying (needed to read feeds).
  scope: 'atproto transition:generic',
  clientId: process.env.CLIENT_ID,
} as const;
