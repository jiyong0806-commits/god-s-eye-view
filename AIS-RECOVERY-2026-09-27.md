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

## Build and Deploy

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
