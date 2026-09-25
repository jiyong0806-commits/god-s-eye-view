# Whole-Project Cloudflare Deployment

This folder includes the frontend and API backend. Do not drag the entire source
folder into a static-site upload dialog: that does not build or deploy the Worker.

## Git-Connected Workers Build

- Connect your own `jiyong0806-commits/god-s-eye-view` repository.
- Project root: repository root (`.`).
- Dependency installation: `npm ci` (Node.js 22 or newer).
- Build command: `npm run build`.
- Deploy command: `npx wrangler@4.136.3 deploy --config wrangler.jsonc`.
- Configuration: `wrangler.jsonc`.
- Worker entry: `worker/index.js`.
- Generated static assets: `dist/client`.

Use the same build/deploy commands from this folder for CLI deployment after signing
into the intended Cloudflare account. `--dry-run` builds without publishing.
No existing local development server needs to be stopped.

## Server Configuration

Actual `.env` files are deliberately absent. Use Cloudflare Worker Secrets for API
credentials; do not upload credentials as assets or put them into `VITE_` variables.
The existing `.env.example` lists development variable names. Common backend names:

- `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET`: only enable OpenSky after permission.
- `FIRMS_MAP_KEY`: NASA FIRMS.
- `TOMTOM_API_KEY`: requires the configured durable quota store as well.
- `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`: TTS remains disabled by default.

Create and bind a D1 database as `PROVIDER_DB` only in the chosen account after checking
its plan. Apply `migrations/0001_provider_usage.sql` before enabling quota-controlled
services. No database ID is fabricated in the shared configuration.
AISStream still needs a persistent backend; adding a key alone does not implement it.
Local Ollama on a private PC is not directly available to a deployed Worker.

## Domain And Verification

Choose the actual Workers hostname or an owned custom domain in Cloudflare. Neither
a domain nor AdSense approval is created by the source bundle. Do not configure a
custom-domain route for a domain that you do not own.

After deployment, check `/map/`, `/home/`, `/api/flow/status` and the enabled provider
routes on the actual public hostname. Confirm failure codes and retry state as well
as successful data. The current standalone configuration has passed a dry-run only.

The current app wrappers still point to the previous public backend. After a real
Cloudflare URL is verified, update `apps/desktop/policy.cjs` and `apps/mobile/App.jsx`
to that exact hostname and rebuild. Do not label the current wrappers migrated yet.

## Included Integrations

`packages/god-mcp` and `tools` are project-owned integration code. Native wrappers
live in `apps/desktop` and `apps/mobile`. Third-party Codex plugins are not copied
into the application. See `skills/plasma-source-delivery` for the reusable delivery skill.
