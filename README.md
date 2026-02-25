# edocteel – Developer README

Developer‑oriented notes for working on the codebase (Next.js 16 / React 19 / TypeScript / Tailwind 4).

## Stack & Architecture
- Next.js App Router, server actions disabled; mostly serverless API routes under `app/api/*`.
- UI: Tailwind CSS 4, Radix UI, shadcn-style primitives, Monaco editor for the IDE experience.
- Auth: Firebase client SDK + session cookies exchanged via `/api/session/*` using Firebase Admin.
- Judge: Judge0 (RapidAPI) proxied through `/api/run` (public sample cases) and `/api/submit` (auth‑gated hidden tests).
- Data: Firestore collections (`generated_problems` primary; `problem` legacy ingest target).

## Getting Started
1) Install deps: `npm install`
2) Create `./.env.local` with:
```
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx

FIREBASE_PROJECT_ID=xxx
FIREBASE_CLIENT_EMAIL=service-account@xxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"

RAPIDAPI_BASE_URL=https://judge0-ce.p.rapidapi.com
RAPIDAPI_KEY=<YOUR_RAPIDAPI_KEY>
RAPIDAPI_HOST=judge0-ce.p.rapidapi.com
```
NOTE: Firebase generates the Private Key, Metadata (Project ID, Client Email, etc) and creates a download called `edoc-blahblahblah-firebase.json`. Copy-paste those lines into the env file. There's a way of just using the json file, but here it's just copypaste for now.

3) Run dev server: `npm run dev` (Node 20.19+ recommended for vitest and vite dependencies). Open http://localhost:3000.
4) Lint: `npm run lint` (ESLint 9 / Next config).

## Key Flows
- **Auth flow**: Client signs in with Firebase → `SessionCookieSync` posts ID token to `/api/session/login` → server sets `__session` HttpOnly cookie used by protected routes (`/api/submit`).
- **Solve a problem**:
  1. Page `app/problems/[slug]/page.tsx` loads problem via `/api/problems/[slug]`.
  2. Running sample tests posts user code to `/api/run` (Judge0 with harness built in `lib/judge0.ts`).
  3. Submitting requires auth; `/api/submit` runs hidden tests (needs `tests` + `paramOrder` in Firestore).
- **Problem data**:
  - List: `/api/problems` reads `generated_problems`.
  - CRUD: `/api/problems/[slug]` on `generated_problems`.
  - Ingest (legacy/LeetCode fallback): `/api/ingest/problem` writes to `problem`.

## Adding Problems (Firestore)
- Minimum fields: `title`, `content` (HTML/MD string), `difficulty`, `starterCode` (per language), `metaData` (JSON string, often includes `params`), `exampleTestcases` (newline‑delimited), optional `paramOrder` (array of param names), optional `tests` (hidden).
- Create/update via `PUT /api/problems/{slug}` with JSON body; `POST` creates only if missing.
- Hidden tests shape: `{ n: number; args: Record<string, any>; solutionOutput?: any }[]`
- Starter code helper types live in `lib/starter-code.ts`.

## API Surface (quick)
- `GET /api/problems` – list problems (Firestore `generated_problems`).
- `GET/PUT/PATCH/DELETE /api/problems/{slug}` – CRUD on a single problem.
- `POST /api/problems/{slug}` – create if not exists (validates title/content).
- `POST /api/ingest/problem` – upsert into `problem` (legacy path).
- `POST /api/run` – run sample tests (no auth).
- `POST /api/submit` – run hidden tests (requires `__session`).
- `GET /api/languages` – Judge0 languages passthrough.
- `POST /api/session/login|logout` – session cookie exchange.
- `POST /api/leetcode/problemset` – GraphQL proxy for LeetCode search (developer aid).

## Project Layout (select)
- `app/` – routes; `app/problems/[slug]/page.tsx` is the IDE screen; `app/page.tsx` landing.
- `app/api/*` – serverless endpoints (problem CRUD, Judge0 proxy, session).
- `components/ui` – shared UI primitives (shadcn‑style).
- `lib/` – Firebase client/admin init, Judge0 harness helpers, starter code utilities.
- `public/` – static assets.

## Development Notes
- Tailwind 4 (postcss plugin) is already configured; styles live mostly in `app/globals.css`.
- `react-resizable-panels` used for split panes; see `components/ui/resizable.tsx`.
- The app runs in the browser only (`"use client"` in most screens); server routes handle data fetching.
- Firestore is required even in dev; mock/stub not provided. Use a secondary Firebase project if needed.
- Judge0 requests are async; polling handled in `/api/run` and `/api/submit` via GET with `token`.

## Deployment Tips
- Target Vercel or any Node 18+ host. Ensure env vars are set in the platform.
- Set `FIREBASE_PRIVATE_KEY` with literal `\n` sequences (Vercel secrets format).
- If using a custom Judge0 instance, update `RAPIDAPI_BASE_URL`/`HOST` accordingly.

## Troubleshooting
- 401 on submit: missing/expired `__session`; sign in again (Firebase session cookie 5 days).
- Missing problems in UI: verify documents exist in `generated_problems` and `titleSlug` matches URL.
- Judge0 errors: check RapidAPI quota and that `RAPIDAPI_*` env vars are present server‑side.
