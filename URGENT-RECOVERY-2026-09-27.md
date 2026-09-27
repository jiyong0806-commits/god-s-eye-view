# Public Recovery: 2026-09-27

## Implemented

- World Connect questions no longer require a model to retrieve USGS magnitude,
  source, location, time or depth. The result explicitly says non-AI source lookup.
- Cause, damage, aftershock and intensity questions cannot be answered from these
  fields. Magnitude is never substituted for intensity.
- Non-earthquake USGS events are excluded from the earthquake panel.
- Cloudflare Workers AI adapter is prepared, not enabled. It requires both
  GEV_WORLD_AI_ENABLED=1 and GEV_WORLD_AI_FREE_CONFIRMED=1, an AI binding and
  the existing PROVIDER_DB binding. No subscription changes were made.
- Model output is limited to a topic classification. Displayed facts are still
  server-verified USGS fields. Invalid output is discarded.
- Public model calls reserve an atomic D1 counter before inference: site-wide
  maximum 50 calls per UTC day, even across isolates. A smaller configured limit
  is accepted; a larger limit is clamped. Missing or failing DB blocks inference.
- Provider failures still consume reservations. No automatic model retry.
- Inference output is capped at 64 tokens; response wait is limited to 15 seconds.
  A timeout does not guarantee the provider cancels computation; its reservation
  remains consumed. The counter is not a universal account billing guarantee.

## Public API Checks Before This Release

Host: https://godseyeview-c6q.pages.dev

| Feature | Actual response | Interpretation |
| --- | --- | --- |
| Aircraft, lat=37.5 lon=127 | 429, Retry-After 91 | ADSB.lol provider cooldown; not repaired or bypassed |
| Military aircraft | 429, Retry-After 120 | ADSB.lol provider restriction |
| AIS | 503, Retry-After 900 | Persistent AISStream backend not configured |
| Station satellite TLE | 200, 610 bytes | API delivered TLE; does not prove all map markers |
| FIRMS status | 200, hasKey=true | Key configuration only; not detection verification |
| RainViewer | 451 | Public-service permission unresolved |
| Map-source status | 200 | Provider metadata check, not newly captured imagery |

The Cloudflare Pages API and Workers account settings API were accessible.
The subscription API lacked access, so Workers Free was not independently
verified. Public inference stays disabled until that is confirmed.

## Verification

Focused World Connect, Worker, God Flow, map-source, imagery-cap and graph tests:
44 passed, zero failed. Not a full-suite, thermal, 10-minute stress or penetration
test certification. Deployment and browser evidence are saved separately.

## Next Priority

Persistent AIS backend and provider-approved aircraft access/cooldown policy.
Do not enable OpenSky without the required permission, evade provider limits,
or replace missing observations with invented real-time markers.

## Provider References

- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/models/llama-3.2-3b-instruct/
- https://developers.cloudflare.com/pages/functions/bindings/#workers-ai
