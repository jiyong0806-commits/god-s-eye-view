# Cloudflare Recovery Verification

## Deployed

- Public site: https://godseyeview-c6q.pages.dev/
- Verified successful deployment: bfc9c2cd-91fa-4c28-845a-c9f30ff2a90b.
- Built assets replace the accidentally uploaded source tree. The map and God Flow pages now return 200 without canonical-URL redirect loops.
- App icon, Earth image and Pretendard font return their actual bytes, not SPA HTML.
- The Pages Worker handles API routes. Missing assets no longer receive a successful HTML fallback from the offline cache.
- Offline cache is limited to 180 entries, skips APIs and media ranges, and only removes this application's older caches.
- Provider credentials are server secrets, not frontend variables. The canonical environment's OPEN_CLIENT_SECRET is mapped to OPENSKY_CLIENT_SECRET on the server.
- D1 PROVIDER_DB now persists the TomTom global daily budget. A real tile request returned 200 and increased the UTC-day counter from 0 to 1, with a maximum of 500.
- OpenSky licensing, RainViewer permission and paid TTS remain disabled.

## Actual Public Responses

These are observations from 2026-09-24, not guarantees of future availability.

| Feature | Observed result |
| --- | --- |
| Map | Seoul imagery rendered in browser; initial console error check was empty |
| God Flow | Korean Wikipedia search returned real results and source links |
| God Flow AI | 503, secure public model backend not configured; local Ollama remains local-only |
| FIRMS | 200, 20,000 capped recent detections |
| Satellites | 200, stations TLE response, 3,360 bytes; orbital calculations are not live telemetry |
| CCTV | 200, 120 source entries; individual camera playback still requires verification |
| Korean geocode | 200, Seoul camera destination |
| TomTom | 200 protobuf tile; persisted 500/day cap active |
| Aircraft | 429 from ADSB.lol; Retry-After 60 seconds |
| Military aircraft | 502 upstream timeout; retry state returned |
| Ships | 503, persistent AISStream backend absent |
| Weather | 503, public-service provider not configured |
| RainViewer | 451, public-service usage permission unresolved |

## Build And Test Scope

- 18 focused Pages, graph, MCP and Flow tests passed.
- 15 backend and desktop path-policy tests passed; provider fixtures are not live-provider approval.
- Independent God Flow source: clean dependency installation and build passed.
- Independent exhibition source: clean dependency installation and build passed; all referenced fonts are included.
- Mobile iOS and Android JavaScript exports passed after switching to the Cloudflare URL. These are not signed IPA/APK builds.
- Export scan checked eight known credential values; no matches in source or frontend assets. This does not prove absence of unknown secrets.
- The full long-duration stability test and native-device tests are not complete.

## Separated Delivery

`output/products-2026-09-24` contains `god-view`, `god-flow`, `mobile`, and `humanities-event`.
Each contains its own source and/or built deployment directory. God View includes the full shared repository; Flow and exhibition have independently buildable sources.
Deploy `cloudflare-upload`, not `source`. Use Wrangler for deployments that include `_worker.js`.
The exhibition's official booth layout has not been supplied and remains empty rather than fictional.

## GitHub

Source is committed locally for `jiyong0806-commits/god-s-eye-view`, preserving upstream license and attribution.
The push failed because this computer has no Git HTTPS login. The connected GitHub plugin does not automatically authenticate local Git.
No remote source upload is claimed. Sign in to GitHub for Git on this computer, then push the prepared source repository without force.

## Most Urgent Remaining Work

Resolve the aircraft provider's public-host request limit; provision the persistent AIS backend; connect an authorized weather provider; verify actual camera playback and satellite markers; complete long-duration mobile/desktop stability checks.
