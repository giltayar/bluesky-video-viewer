const port = Number(process.env.PORT ?? 3000);

export const config = {
  port,
  host: process.env.HOST ?? '127.0.0.1',
  publicUrl: process.env.PUBLIC_URL ?? `http://127.0.0.1:${port}`,
  frontendUrl: process.env.FRONTEND_URL ?? 'http://127.0.0.1:5173',
  cookieSecret: process.env.COOKIE_SECRET ?? 'dev-insecure-cookie-secret-change-me',
  isProd: process.env.NODE_ENV === 'production',
  // Requested OAuth scopes: identity + generic PDS/AppView proxying (needed to read feeds).
  scope: 'atproto transition:generic',
  clientId: process.env.CLIENT_ID,
} as const;
