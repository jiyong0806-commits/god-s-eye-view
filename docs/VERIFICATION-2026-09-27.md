# GOD'S EYE VIEW Verification Receipt

## Public Deployment

- Site: https://godseyeview-c6q.pages.dev
- Deployment: `c65a1687-7609-41ac-b6af-864f10ddcc78` (Cloudflare status: success).
- Source branch: `cloud-work-2026-09-27` in `jiyong0806-commits/god-s-eye-view`.
- Online editor: https://github.dev/jiyong0806-commits/god-s-eye-view/tree/cloud-work-2026-09-27
- No new paid plan or supplier quota bypass was enabled.

## Fixed and Verified

- Fixed the map bootstrap crash caused by a Lucide `Map` import shadowing the JavaScript `Map` constructor.
- Removed forced startup service-worker reloads that interrupted user interactions.
- Cloudflare response caches now store detached bytes rather than request-bound streams. Four consecutive public news calls returned HTTP 200 and 12 real RSS headlines each; four consecutive alert calls returned HTTP 200.
- Non-ASCII provider names are encoded in HTTP headers while JSON preserves readable names.
- Korean search rejects unrelated foreign fuzzy matches. Public school search returned latitude 35.827415, longitude 126.830054 in Gimje. The browser search control also flew to these coordinates in both desktop and mobile checks.
- Actual public browser checks at 1440x900 and 393x852 passed account form and supplied logo loading, guest bookmark save/fly-to, OSM 2D/3D switching, tutorial opening and official economic article links. Neither run raised JavaScript errors or lost the WebGL context.
- Radar permission failure is explicit, not synthetic weather imagery. Narrow-screen news controls no longer overlap the new toolbar.
- Voice recognition/output serialization, TTS cancellation, object-URL cleanup and local-only Ollama input validation were implemented and covered by focused tests. Real microphone recognition, speaker feedback and public AI availability are not proven.
- Refresh work is bounded to two concurrent layer jobs; marker colors no longer allocate a new Cesium color per frame.
- Public Supabase configuration allows only the expected HTTPS project URL and publishable-key format. Owner-only profile/bookmark RLS was checked; anonymous REST access was denied.
- Additional public audit: AIS returned 200 actual rows, FIRMS returned 20,000 records, CelesTrak station elements returned HTTP 200, and the CCTV catalog returned 120 sources. These response checks alone do not prove every marker or CCTV frame is rendered live.

## Test Results

- Focused worker, provider cache, voice route, account config, workspace, vessel color and related regression tests: 48 passed, 0 failed.
- Pages build passed. The main bundle still produces a large-chunk warning; no universal performance or temperature guarantee is made.
- Full suite run: 2711 tests, 2675 passed, 34 failed, 2 skipped. One vessel-color expectation was subsequently corrected and passed in the focused run. The full suite has not been rerun to claim a new total or a green result.
- Source and frontend build were scanned against eight known secret values without printing them. Environment secrets and dependency/build caches are excluded from source delivery.
- Ten-minute multi-layer public-browser soak passed: 19 samples over 614 seconds of interaction, no page crashes, JavaScript errors or WebGL context loss. JS heap samples ranged from 45 to 105 MiB and ended at 69 MiB. This is one desktop run, not proof of zero leaks, low physical temperature or mobile stability over ten minutes.
- The same soak still received failed API responses: HTTP 404 (72), 429 (15), 451 (1), 502 (111), 504 (14). Map survival is not complete feature recovery. The current soak records aggregate codes, not individual failing paths; endpoint-level follow-up is still needed.

## Blocked or Not Verified

- Aircraft/military aircraft: supplier HTTP 429 and unresolved OpenSky public/commercial permission. Shared backoff and licensing gates remain.
- CCTV: catalog contains 120 sources, but the tested public image proxy still returned HTTP 502 even though a PC-side provider fetch succeeded.
- RainViewer: public/commercial usage permission is unresolved. Its gate remains disabled.
- Domestic earthquake alert source: configured KMA feed is stale. Do not invent a fresh Buyeo warning; USGS does not establish complete coverage of small domestic events.
- Globally live individual people and cars: no verified provider. Road motion is simulation; real congestion aggregates do not make individual markers live observations.
- Ollama runs locally, not automatically in Cloudflare or another device. Public AI requires a secured server connection and quotas.
- Real signup confirmation/reset email delivery, microphone hardware, licensed news photos, secondary-disaster prediction and complete mobile redesign remain unverified or unfinished.
- Source media retain their licenses. Unconfirmed commercial effects were not uploaded; quiet original Web Audio effects are used.

## Next Urgent Work

1. Trace the remaining 404/502/504 paths from a multi-layer browser session, and diagnose CCTV public proxy failure without introducing an arbitrary URL proxy.
2. Resolve supplier authorization/quota and confirm real aircraft rows and rendered markers together.
3. Obtain a current official domestic earthquake feed and test opt-in notifications with a clearly marked fixture.
4. Fix and rerun the remaining full-suite regressions; measure target-device frame time and memory before considering another renderer or C++.
5. Complete authenticated cloud AI and real account email tests. Preserve server-only secrets and explicit service limitations.
