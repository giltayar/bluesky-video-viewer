# Bluesky Video Viewer — Design

A web app that lets a user log into Bluesky, paste a feed URL, and watch every
video in that feed as a full‑screen, vertically‑scrolling, TikTok‑style player.

---

## 1. Product overview

### User flow

1. **Login** — The user enters their Bluesky handle (e.g. `alice.bsky.social`).
   The app runs the **AT Protocol OAuth** flow: it redirects the user to their
   own PDS/entryway to sign in and approve access, then receives them back on a
   callback. No password ever touches this app.
2. **Choose a feed** — The user pastes a feed URL. Supported inputs:
   - A custom feed: `https://bsky.app/profile/<handle>/feed/<rkey>`
   - An author's posts: `https://bsky.app/profile/<handle>`
   - A raw AT URI: `at://<did>/app.bsky.feed.generator/<rkey>`
3. **Watch** — The app fetches the feed, keeps only posts that contain a video
   embed, and shows them one at a time in a full‑screen vertical player. Swiping
   / scrolling down advances to the next video. Infinite scroll loads more pages
   via the feed cursor.

### Core interactions (TikTok-style)

- One video fills the viewport at a time (CSS scroll‑snap, vertical).
- Autoplay the in‑view video (muted by default to satisfy browser autoplay
  policies); pause videos that scroll out of view.
- Tap to toggle mute/play; overlay shows author, post text, like/repost counts,
  and a link back to the original post on Bluesky.
- Prefetch the next 1–2 videos for smooth transitions.

---

## 2. Bluesky / AT Protocol background

The app is a standard AT Protocol client. Relevant facts that drive the design:

- **Auth (OAuth)**: The app authenticates with **AT Protocol OAuth** (OAuth 2.1
  profile: PKCE, PAR, and DPoP are all mandatory). We use the
  `@atproto/oauth-client-node` package, which implements the full flow and
  transparently refreshes tokens. The app is a **confidential client** using a
  backend‑for‑frontend (BFF) architecture:
  - The backend publishes a **client metadata document** at a public HTTPS URL
    (`client_id`) and a **JWKS** of public keys; it holds the matching private
    signing keys (`keyset`). Confidential clients get longer session lifetimes.
  - Flow: `client.authorize(handle)` → redirect to the user's Authorization
    Server → user approves → callback → `client.callback(params)` yields an
    OAuth session bound to the account **DID**. Later requests call
    `client.restore(did)` to get a session and wrap it in an `Agent`.
  - Requested scopes: `atproto transition:generic` (identity + the ability to
    proxy the `app.bsky.*` read endpoints we need through the PDS/AppView).
  - Tokens (access/refresh) and DPoP keys live only in the backend's OAuth
    session store; the browser never sees them.
- **Feeds**:
  - Custom feed generators are fetched with `app.bsky.feed.getFeed({ feed, cursor, limit })` where `feed` is an `at://…/app.bsky.feed.generator/…` URI.
  - An author's posts are fetched with `app.bsky.feed.getAuthorFeed({ actor, filter: 'posts_with_media', cursor, limit })`.
  - Both return `{ feed: FeedViewPost[], cursor }`, paginated (max `limit` 100).
- **Handle → DID**: A `bsky.app` URL contains a handle; feed URIs require the
  DID. Resolve with `com.atproto.identity.resolveHandle`.
- **Video embeds**: A post with a video has an embed view of type
  `app.bsky.embed.video#view` on `post.embed`, containing:
  - `playlist` — an **HLS** (`.m3u8`) URL served from Bluesky's video CDN.
  - `thumbnail` — a poster image URL.
  - `aspectRatio` — `{ width, height }` for layout.
  - `alt` — optional description.
  A video can also appear nested inside `app.bsky.embed.recordWithMedia#view`
  (a quote post with media). We extract from both shapes.
- **Playback**: Because the source is HLS, the frontend uses
  [`hls.js`](https://github.com/video-dev/hls.js) for browsers without native
  HLS, and the native `<video>` element on Safari (which supports HLS directly).

---

## 3. Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│         Frontend            │  HTTP   │           Backend            │
│  React + Vite + TypeScript  │◄───────►│   Node.js + Fastify + TS     │
│                             │  (JSON) │      @atproto/api Agent      │
│  • Login screen             │         │                              │
│  • Feed URL screen          │         │  • /api/login                │
│  • Vertical video player    │         │  • /api/feed                 │
│    (hls.js)                 │         │  • /api/logout               │
└─────────────────────────────┘         │  • session store (cookie)    │
                                        └──────────────┬───────────────┘
                                                       │ AT Protocol (XRPC)
                                                       ▼
                                             ┌───────────────────┐
                                             │  Bluesky PDS /     │
                                             │  AppView + Video   │
                                             │  CDN (HLS .m3u8)   │
                                             └───────────────────┘
```

### Why a backend at all?

- **Confidential OAuth client (BFF).** A server‑side component lets us run a
  confidential OAuth client with a private signing keyset — better security and
  longer sessions than a browser‑only public client. It also hosts the public
  `client-metadata.json` and `jwks.json` that the OAuth flow requires.
- **Keep tokens off the client boundary.** OAuth access/refresh tokens and DPoP
  keys live only on the server, in the OAuth session store. The browser holds
  only an `httpOnly`, `Secure`, `SameSite` app‑session cookie that maps to the
  authenticated DID.
- **Normalize data.** The backend resolves handles, converts `bsky.app` URLs to
  AT URIs, filters non‑video posts, and returns a small, video‑focused DTO so
  the frontend stays simple.
- **Automatic token refresh** happens server‑side via `@atproto/oauth-client-node`.

> Note: The video `playlist` and `thumbnail` URLs are public CDN URLs, so the
> `<video>` element loads media directly from Bluesky's CDN — media bytes do
> **not** proxy through our backend.

---

## 4. Backend design

**Stack:** Node.js (LTS) running **TypeScript directly** — modern Node executes
`.ts` files natively (type stripping), so there is **no build/transpile step**
for the backend; run `node src/index.ts`. Framework: Fastify, with
`@atproto/oauth-client-node` + `@atproto/api` for Bluesky, `@fastify/cookie` for
the app session cookie, and `zod` for input validation.

### OAuth client setup

At startup the backend constructs a `NodeOAuthClient`:

- **`clientMetadata`** — served at `GET /client-metadata.json`. Key fields:
  `client_id` (the public URL of that document), `redirect_uris`
  (`[<PUBLIC_URL>/api/oauth/callback]`), `scope: 'atproto transition:generic'`,
  `grant_types: ['authorization_code','refresh_token']`,
  `token_endpoint_auth_method: 'private_key_jwt'`, `dpop_bound_access_tokens: true`,
  and `jwks_uri` (`<PUBLIC_URL>/jwks.json`).
- **`keyset`** — private ES256 keys loaded from env/secrets (via
  `@atproto/jwk-jose`). Public halves are exposed at `GET /jwks.json`
  (`client.jwks`).
- **`stateStore`** — short‑lived key/value store for in‑flight authorize
  requests (CSRF/PKCE state).
- **`sessionStore`** — durable key/value store (keyed by DID) for OAuth session
  data (tokens, DPoP key). In‑memory `Map` for dev; Redis/DB for production.
- **`requestLock`** — per‑DID lock to serialize token refreshes when running
  more than one instance.

> **Local dev:** hosting public client metadata + JWKS is awkward on localhost.
> Two options: (a) use the AT Protocol `http://localhost` **development client**
> exception (a public client, shorter sessions, no keyset), or (b) expose the
> dev server through an HTTPS tunnel and point `client_id` at it. Production
> always uses the confidential client with hosted metadata and keyset.

### App session (browser ↔ backend)

The OAuth session lives server‑side keyed by DID. To tie a browser to it:

- After a successful `client.callback(...)`, mint a random **app‑session id**,
  store `{ sessionId → did }` in the app session store, and set it as an
  `httpOnly`, `Secure`, signed cookie.
- On each authenticated request, read the cookie → look up the DID →
  `const oauthSession = await client.restore(did)` → `new Agent(oauthSession)`.
  Token refresh happens transparently and updated tokens are persisted by the
  OAuth client's `sessionStore`.
- Logout clears the app cookie and calls `client.revoke(did)`.

### Endpoints

| Method & path              | Body / query                             | Returns                                              |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| `GET  /client-metadata.json` | —                                      | OAuth client metadata document                       |
| `GET  /jwks.json`          | —                                        | Public JWKS (`client.jwks`)                          |
| `POST /api/oauth/login`    | `{ handle }`                             | `{ redirectUrl }` (from `client.authorize`)          |
| `GET  /api/oauth/callback` | `?code&state&iss` (from Auth Server)     | Redirects to the web app, sets app‑session cookie    |
| `POST /api/logout`         | —                                        | `204`, clears cookie + revokes OAuth session         |
| `GET  /api/session`        | —                                        | `{ did, handle }` or `401` (for UI bootstrapping)    |
| `GET  /api/feed`           | `?url=<feed url or at-uri>&cursor=<opt>` | `{ videos: VideoItem[], cursor?: string }`           |

### Feed resolution logic (`/api/feed`)

1. Parse the `url` query param:
   - `at://…/app.bsky.feed.generator/…` → use directly as a generator feed.
   - `https://bsky.app/profile/<h>/feed/<rkey>` → resolve `<h>` to a DID, build
     `at://<did>/app.bsky.feed.generator/<rkey>`, call `getFeed`.
   - `https://bsky.app/profile/<h>` (no `/feed/`) → resolve DID, call
     `getAuthorFeed` with `filter: 'posts_with_media'`.
   - Anything else → `400` with a helpful message.
2. Call the appropriate XRPC method with `{ cursor, limit: 30 }`.
3. Map each `FeedViewPost` → `VideoItem`, dropping posts with no video embed.
4. If a page yields zero videos but a `cursor` exists, optionally fetch the next
   page server‑side (bounded, e.g. up to 3 pages) so the client isn't handed an
   empty result while videos still exist deeper in the feed.
5. Return `{ videos, cursor }`.

### `VideoItem` DTO

```ts
interface VideoItem {
  postUri: string;          // at:// URI of the post
  postUrl: string;          // https://bsky.app/... deep link
  cid: string;
  playlistUrl: string;      // HLS .m3u8
  thumbnailUrl: string;
  aspectRatio?: { width: number; height: number };
  alt?: string;
  text: string;             // post text
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  likeCount: number;
  repostCount: number;
  replyCount: number;
  indexedAt: string;
}
```

### Video extraction helper

Given a hydrated `post.embed`, return the video view if present:

- `app.bsky.embed.video#view` → the embed itself.
- `app.bsky.embed.recordWithMedia#view` → check `embed.media` for a video view.
- Otherwise → `null` (post is skipped).

### Security & robustness

- Validate all inputs with `zod`; reject malformed URLs.
- Cookies: `httpOnly`, `Secure`, `SameSite=Lax`, signed.
- Rate‑limit `/api/feed` and `/api/oauth/login` (`@fastify/rate-limit`).
- CORS locked to the frontend origin; credentials enabled for the cookie.
- Never log tokens, DPoP keys, or private signing keys; load the keyset from
  secrets, not source control.
- OAuth `state` protects the authorize→callback round trip against CSRF; the
  `stateStore` entries are short‑lived (≤ 1 hour).
- Return normalized error shapes (`{ error: string }`) with correct status codes
  (`401` unauthenticated, `400` bad feed URL, `502` upstream Bluesky error).

---

## 5. Frontend design

**Stack:** React + TypeScript + Vite, `hls.js`, minimal CSS (no heavy UI kit).
State kept local with hooks; a small fetch wrapper that sends `credentials: 'include'`.

### Screens

1. **Login** (`/login`)
   - Single field: Bluesky handle (or DID / PDS host).
   - "Sign in with Bluesky" button → `POST /api/oauth/login` → redirect the
     browser to the returned `redirectUrl` (the user's Authorization Server).
   - After approval the user lands back on `/api/oauth/callback`, which sets the
     app cookie and redirects to the feed‑input screen. A short note explains
     that sign‑in and the password happen on their own Bluesky server.
2. **Feed input** (`/`)
   - Single text field for the feed URL + "Watch" button.
   - Client‑side sanity check that it looks like a bsky URL or AT URI.
3. **Player** (`/watch?url=…`)
   - Full‑screen vertical, scroll‑snap container of `<VideoCard>`s.
   - Infinite scroll: when nearing the end, fetch the next page with the cursor
     and append.

### Player mechanics

- **Container**: `height: 100dvh; overflow-y: scroll; scroll-snap-type: y mandatory;`
  each card `height: 100dvh; scroll-snap-align: start;`.
- **Which video is active**: an `IntersectionObserver` marks the card that is
  ≥ ~60% visible as active. Only the active card plays; others pause and reset.
- **Autoplay policy**: start muted with `playsInline`; a tap unmutes. Show a
  mute indicator.
- **HLS loading**: if `video.canPlayType('application/vnd.apple.mpegurl')` is
  truthy (Safari), set `video.src = playlistUrl`. Otherwise attach `hls.js`.
  Lazy‑attach HLS only for the active card and its immediate neighbors to limit
  network/CPU; detach when far off‑screen.
- **Poster**: use `thumbnailUrl` as the `<video poster>` for instant paint.
- **Overlay UI**: author avatar + handle, truncated post text, like/repost/reply
  counts, and a "View on Bluesky" link (`postUrl`).
- **Aspect ratio**: `object-fit: contain` (letterbox) or `cover` based on
  `aspectRatio`; portrait videos fill, landscape letterbox.

### Data flow

```
Feed input ──► GET /api/feed?url=… ──► { videos, cursor }
                                   │
                         append to in-memory list
                                   │
   scroll near end ──► GET /api/feed?url=…&cursor=… ──► more videos
```

### Empty / error states

- No videos in feed → friendly "No videos found in this feed" with a back button.
- Auth expired (`401`) → redirect to `/login`.
- Bad feed URL (`400`) → inline error on the feed‑input screen.

---

## 6. Project structure

```
bluesky-video-viewer/
├── DESIGN.md
├── package.json                 # workspaces: server + web
├── server/
│   ├── src/
│   │   ├── index.ts             # Fastify bootstrap, plugins, CORS; runs via `node src/index.ts`
│   │   ├── oauth/
│   │   │   ├── client.ts        # NodeOAuthClient (metadata, keyset, stores)
│   │   │   └── stores.ts        # stateStore + sessionStore (memory → Redis)
│   │   ├── routes/
│   │   │   ├── auth.ts          # /client-metadata.json, /jwks.json, /api/oauth/*, /api/logout, /api/session
│   │   │   └── feed.ts          # /api/feed
│   │   ├── bsky/
│   │   │   ├── resolveFeed.ts   # URL/AT-URI parsing + handle→DID
│   │   │   └── extractVideo.ts  # embed → VideoItem mapping
│   │   ├── session/store.ts     # app-session cookie store (sessionId → DID)
│   │   └── types.ts             # VideoItem, DTOs
│   └── package.json             # "start": "node src/index.ts" (no build step)
└── web/
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── api.ts               # fetch wrapper (credentials: include)
    │   ├── pages/
    │   │   ├── Login.tsx
    │   │   ├── FeedInput.tsx
    │   │   └── Watch.tsx
    │   ├── components/
    │   │   ├── VideoFeed.tsx    # scroll-snap container + infinite scroll
    │   │   └── VideoCard.tsx    # single video + hls.js + overlay
    │   └── hooks/
    │       ├── useActiveVideo.ts   # IntersectionObserver
    │       └── useHlsVideo.ts      # attach/detach hls.js
    └── package.json
```

---

## 7. Tech stack summary

| Concern            | Choice                                             |
| ------------------ | -------------------------------------------------- |
| Language           | TypeScript (both tiers)                            |
| Backend runtime    | Node.js (LTS), running `.ts` natively (no transpile) |
| Backend framework  | Fastify                                            |
| Auth               | AT Protocol OAuth via `@atproto/oauth-client-node` (confidential BFF client) |
| Bluesky client     | `@atproto/api` (`Agent`)                           |
| Sessions           | `httpOnly` signed app cookie → DID; OAuth session store (memory→Redis) |
| Validation         | `zod`                                              |
| Frontend           | React + Vite                                       |
| Video playback     | `hls.js` (+ native HLS on Safari)                  |
| Feed layout        | CSS scroll‑snap + `IntersectionObserver`           |

---

## 8. Future enhancements (out of scope for v1)

- Like / repost actions from within the player (write endpoints).
- Save / share a feed URL; recently viewed feeds.
- Keyboard navigation (↑/↓) and volume memory.
- Quality selection and data‑saver mode via HLS levels.
- Server‑side caching of resolved DIDs and feed pages.
```

