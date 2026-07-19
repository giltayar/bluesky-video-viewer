# Bluesky Video Viewer

Log into Bluesky, paste a feed URL, and watch every video in that feed as a
full-screen, TikTok-style vertical player.

See [DESIGN.md](DESIGN.md) for the architecture.

## Requirements

- Node.js 24+ (the backend runs TypeScript directly — no build step)

## Setup

```sh
npm install
cp server/.env.example server/.env   # then edit COOKIE_SECRET
```

## Run (development)

In two terminals:

```sh
npm run dev:server   # backend on http://127.0.0.1:3000
npm run dev:web      # frontend on http://127.0.0.1:5173
```

Open http://127.0.0.1:5173 and sign in with your Bluesky handle.

> Dev uses the AT Protocol "localhost" development OAuth client (a public
> client), so no hosted client metadata or signing keys are needed. Use the
> loopback IP `127.0.0.1`, not `localhost`.

## Feed URLs you can paste

- Custom feed: `https://bsky.app/profile/<handle>/feed/<rkey>`
- A user's posts: `https://bsky.app/profile/<handle>`
- Raw AT URI: `at://<did>/app.bsky.feed.generator/<rkey>`

## Production (Railway)

Deployed as a **single service**: Fastify serves the JSON API *and* the built
SPA from `web/dist` on one origin.

- Build command: `npm run build` (builds `web/dist`)
- Start command: `npm start` (runs the server, serving the SPA)
- Node: `>=24` (native TypeScript, no build step for the backend)

Generate a signing key locally and set it as a Railway variable:

```sh
npm run generate-key   # prints an ES256 PKCS#8 PEM
```

Set these variables on the Railway service:

- `NODE_ENV=production`
- `COOKIE_SECRET` — a long random string
- `PRIVATE_KEY_1` — the generated PEM (add `PRIVATE_KEY_2/3` for key rotation)

`PUBLIC_URL` defaults to `https://$RAILWAY_PUBLIC_DOMAIN`, and `CLIENT_ID`
defaults to `PUBLIC_URL/client-metadata.json`, so you normally don't need to set
either. See `server/.env.example` for all options.

> Sessions are stored in memory, so they reset on redeploy/restart and won't
> scale past one instance. Move the OAuth + app-session stores to Redis before
> running multiple instances.
