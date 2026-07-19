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

## Production notes

Set `NODE_ENV=production` and configure a confidential OAuth client in
`server/.env`: a public `CLIENT_ID` (URL serving `/client-metadata.json`) and
one or more ES256 `PRIVATE_KEY_*` values. See `server/.env.example`.
