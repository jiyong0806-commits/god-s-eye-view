# Aircraft and AIS Recovery

## Verified Before Deployment

- Canonical AISStream key exists; its value was not printed or written to source.
- One compressed private Node probe received subscription confirmation and
  12 actual position messages in 20 seconds. It was then disconnected.
- Cloudflare dashboard showed Workers Free as the current plan. No purchase,
  paid upgrade or payment details were entered.
- Existing D1 database received an additive provider_cooldown table.

## Implementation

- `worker/aisCollector.js`: one SQLite-backed Durable Object per provider
  credential stream, accessed through a Pages service binding. The global object
  is deliberate: opening a separate stream for each visitor would violate
  provider connection limits and duplicate all work.
- `wrangler.ais.jsonc`: deploy the collector before deploying Pages. Set
  AISSTREAM_API_KEY using a server Secret. The collector's workers.dev and preview
  ingress remain disabled; browsers use the existing same-origin API.
- Persistent outbound stream; one connection shared by viewers. Reconnects back
  off 30 seconds to 15 minutes, auth failures wait one hour. No automatic fast
  retry of rejected credentials. Provider raw error text is never exposed.
- Only valid position messages with finite coordinates and 9-digit MMSIs create
  rows. Handshakes and malformed frames never establish live status.
- The socket explicitly selects ArrayBuffer delivery before accept. With recent
  Cloudflare compatibility dates the default is Blob, which a synchronous byte
  decoder cannot read. The regression mock checks the selection at accept.
- Maximum 5000 in-memory vessels, 30-minute position TTL. A warm-restart checkpoint
  retains at most 200 recent rows; this is not a historical tracking database.
- Checkpoint once per minute, not per message. No-viewer idle timeout: 3 minutes.
  Silent data is marked stale after 2 minutes. Alarms supervise reconnection.
- The Workers outbound socket is uncompressed. AISStream may limit bandwidth;
  global subscription does not guarantee complete worldwide observations.
- Free-plan quota exhaustion can interrupt service; it cannot activate a paid
  plan. Long-duration quota/thermal tests are not yet certified.
- Track history returns an explicit unavailable reason and no invented samples.
- ADSB.lol 429 cooldown is now shared in D1 across regions and military endpoints.
  Longer provider waits cannot be shortened by another isolate. This does not
  bypass limits, grant OpenSky licensing or guarantee aircraft availability.

## Public Verification

- Pages deployment f2d29042-08c6-4e0d-8225-02fdc7572d3e succeeded.
  The separately deployed AIS Worker was subsequently corrected for binary frames.
- At 2026-09-27T03:39:50Z, the public desktop map had 446 accepted AIS vessels,
  matching 446 API rows with HTTP 200 and feed status live. The inspected vessel's
  coordinates exactly matched its provider row. WebGL was not lost, the map canvas
  was nonblank, and no page errors were recorded during this check.
- Aircraft and military requests still returned HTTP 429 and Retry-After 60.
  Shared cooldown is active; aircraft availability is NOT restored.
- Focused Worker tests: 36 passed. Existing AIS frontend tests: 74 passed.
  Public security smoke: 16 checks passed. Pages build succeeded.
- This is a short desktop check, not a 10-minute soak, mobile thermal benchmark,
  comprehensive penetration test, global coverage guarantee or history service.

## Deployment Commands

1. Apply `migrations/0002_provider_cooldown.sql` to existing PROVIDER_DB.
2. `npx wrangler deploy --config wrangler.ais.jsonc`
3. `npx wrangler secret put AISSTREAM_API_KEY --config wrangler.ais.jsonc`
4. Bind AIS_BACKEND to gev-ais-collector in Pages production configuration.
5. `npm run build:pages`, deploy Pages, then verify /api/ais-live and the map.

Keep all real keys out of GitHub, source delivery and frontend variables.

## Sources

- https://aisstream.io/documentation
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/best-practices/websockets/
