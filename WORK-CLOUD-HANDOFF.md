# GOD'S EYE VIEW: ChatGPT Work Cloud Handoff

## Source and Scope

- User requested ChatGPT Work cloud execution, not a local-only workflow.
- User repository: https://github.com/jiyong0806-commits/god-s-eye-view
- Public site: https://godseyeview-c6q.pages.dev
- Production baseline verified before transfer: `85755a109465e80e18d5c10d7cbc8e78c6cf08a1`.
- This working snapshot includes unfinished changes. Do not merge or deploy it until verification passes. Preserve unrelated user changes and upstream licenses.
- Do not use the original upstream author's repository as the push destination.
- No local filesystem, local Ollama daemon, user media folders, or local `.env` is automatically available in Work cloud.
- Real credentials are deliberately excluded. Obtain approved credentials through environment secret settings, never chat, source files, or frontend build variables.

## Priority Queue

1. Review current changes and fix voice feedback loops, serialized command execution, and truncated Ollama instructions. Browser recognition must pause while processing and speaking, and resume only after output ends.
2. Compile and test new account, news, alerts, roads, and radar modules. Finish the loading footer logo and limit manual layer refresh concurrency to two.
3. Verify public API responses and map rendering together: aircraft, military aircraft, AIS vessels, satellites, FIRMS, CCTV, search, traffic, and weather. Never describe synthetic markers as live observations.
4. Finish Korean/global search, bookmarks with fly-to, OSM 2D selection, account settings, voluntary personalization, and economic news with source evidence.
5. Verify Supabase owner-only RLS, signup/signin and email configuration. Add password reset and clearly label unverified delivery. No fabricated authentication or localStorage-only multi-user accounts.
6. Implement opt-in app/browser disaster notifications. Do not send SMS or enable paid services without approval. Secondary disaster estimates must be labeled uncertain, not authoritative warnings.
7. Finish an in-app tutorial based on actual implemented functionality. The YouTube reference title was retrieved, but its full contents were not inspected; do not claim an exact recreation without reviewing the video.
8. Test desktop and mobile layouts, source integrity and secrets, then deploy through the existing Cloudflare setup. Verify the public deployment, push reviewed code, and deliver editable source/configuration alongside every artifact.

## Current Evidence and Blockers

- Aircraft and military provider routes returned HTTP 429 during the latest public checks. OpenSky public/commercial permission remains pending. Keep license gates and shared backoff; do not evade quotas.
- AIS persistent Worker/DO recovery was previously deployed and matched actual public API rows with visible vessel markers.
- CCTV catalog returned 120 sources, but the first public frame returned HTTP 502. Direct provider fetch from the PC succeeded. A proxy header/timeout change is present but not deployed or proven.
- Korean geocoding for Buyeo returned a valid result. Server-only TomTom search integration is newly edited and unverified; preserve the approved 500-request daily budget.
- USGS events returned real records. The configured official KMA CAP RSS was stale (newest record in 2025), so it must not produce a fabricated alert about today's Buyeo earthquake.
- Hankyung official economic RSS supplies current headlines and original article links, not licensed article bodies or image assets. Do not invent photos, sources, or causal explanations.
- Local Ollama had `qwen3:1.7b`. It is not a cloud service. Public Ollama access must use an authenticated backend with timeouts and quotas; do not expose the local daemon or pretend cloud AI is ready.
- RainViewer commercial/public permission is unresolved. Keep `GEV_RAINVIEWER_PERMITTED=0` until permission is established.
- Road dots represent simulated vehicle motion, even when congestion is based on a real aggregate. Globally live individual cars and people have no verified provider; display this limitation.
- User-provided commercial sound files lack confirmed distribution rights. Quiet original Web Audio effects are included; do not upload the unlicensed files.

## New Files to Review

- `worker/connectFeeds.js`: economic RSS, USGS alerts, public account configuration. Harden public configuration to allow only valid Supabase URL and publishable-key formats.
- `worker/roadRoutes.js`: bounded road-only Overpass proxy. Add abuse protection and verify query bounding boxes.
- `worker/voiceRoutes.js`: local-only Ollama interpretation. Validate malformed JSON input and fix instruction truncation in the chat helper.
- `src/plasmaAccount.js`, `src/plasmaWorkspace.js`, `src/plasmaWorkspace.css`: Supabase accounts, preferences, bookmarks, search, toolbar and tutorial.
- `src/plasmaAlerts.js`, `src/quietSfx.js`: opt-in notifications and original quiet effects.
- `src/data/weatherRadar.js`: real RainViewer imagery gated by permission.
- `src/worldConnect.js`: economic/disaster tabs and consent-based ranking. Remove profile listeners on destroy and preserve tab selection on errors.
- `src/data/layerPalette.js`: use stable shared color constants, avoiding per-frame Cesium color allocations.
- `supabase/migrations/20260927010000_plasma_accounts.sql`: already applied to project `jjmkhfqxzvhlblmgljwp`; verify policies before changing or reapplying.
- `public/brand/plasma-logo.png`: supplied PLASMA logo for account/loading placement.

## Verification and Deployment

- Install lockfile dependencies, run focused unit tests and `npm run build:pages` before production changes.
- Use existing Cloudflare project `godseyeview`, AIS service binding, and provider budget storage. Static drag-and-drop does not deploy backend routes.
- Preserve existing server secrets when updating deployment configuration. Never include their values in logs or reports.
- Test the same multi-layer URL for at least ten minutes and report measured failures, not universal performance guarantees.
- For each result, report: implemented, locally tested, publicly verified, blocked, and required user action.
- Keep public credentials distinct from server secrets; no service-role Supabase keys in browser code.
- Package reviewed source with `scripts/export-source.mjs`; scan against approved environment secrets without printing them.

## Reference

Tutorial reference: https://youtu.be/o_FJ1NIH9yw

The comprehensive user specification is a feature backlog, not evidence of implementation. Fix broken real data before adding more inactive controls or a second map renderer.
