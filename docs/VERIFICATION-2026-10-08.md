# GOD'S EYE VIEW: recovery and briefing implementation

## Published build

- Public URL: https://godseyeview-c6q.pages.dev
- Final deployment: https://f2a587a8.godseyeview-c6q.pages.dev
- Cesium retained. No new map engine, paid service, Python tile server or full-project rewrite.
- The two October 7 attachments are identical. Their requirements were implemented once.

## Actual changes

1. Shared PLASMA account configuration, Korean sign-in/sign-up/recovery page and verified-user map startup gate. God Flow uses the same account project. This is not automatic cross-domain SSO or authentication of all public feed APIs.
2. Multiple-result place selection and a guard against automatically navigating to fictional/unverified Atlantis or Backrooms entries. BGM startup and its controls removed; original audio files preserved unused.
3. In-app news details/questions use official publisher RSS titles, links and publication times. They are attributed headline briefs, not full-article summaries, independent fact checks, causal analyses or unrestricted AI answers. Optional interests and explicit place-name matches affect ranking.
4. Successful aircraft snapshots share a short edge cache. Nearby requests are grouped, stale/invalid fixes rejected, provider limits preserved and retry metadata returned. Licensed OpenSky remains disabled.
5. Cesium loads only after account verification, not on the login screen. Three or more continuous-render holds cap rendering at 30 FPS or a lower chosen baseline. The parser and Satellite Explorer load on demand.
6. Source Registry v1 stores data license separately from code license and attaches sourceId/retrievedAt/freshness to World Connect and satellite scenes. Source Cards display provenance. Legacy source entries without a reviewed use policy default to unknown for new raster adapters; existing layers are not silently replaced or disabled.
7. Spatial Intent v1 has a strict schema and a bounded Korean parser. Four requested fixtures pass. The satellite-imagery command opens the Explorer. General semantic POI filtering, SpatialReasoner/MapSpec and image-change analysis have NOT been claimed as implemented.
8. Satellite Explorer searches actual Sentinel-2 L2A STAC metadata by a bounded area, date range and cloud percentage; maximum 12 results. It displays acquisition times and missing metadata honestly. Scene selection fetches a verified JPEG preview and displays its geographic bounding box on the existing globe.
9. COG assets are listed but a projected, high-resolution COG globe overlay is NOT implemented. Thumbnails are not falsely stretched onto the globe. Unknown/restricted sources cannot auto-activate raster data.
10. Cloudflare does not support Fetch redirect='error'. Restricted upstream requests now use manual redirects and reject redirection. This fixed the sampled CCTV image failure. The STAC sort field was corrected against the actual supplier response.
11. Aircraft provider attribution now survives shared cooldown failures. The UI no longer retains the old OpenSky source name when the actual ADSB.lol fallback is limited.

## Public observations

- NASA daily imagery metadata: HTTP 200, provider date 2026-10-08. This is a roughly 250m daily satellite composite, NOT a new daily high-resolution image of every building worldwide. Clouds, gaps and provider publication delays remain.
- Sentinel search around Seoul: HTTP 200, 7 scenes with <=30% cloud in the sampled period. First scene: S2B_52SBG_20261008_0_L2A, acquired 2026-10-08T02:27:15.889Z. Its JPEG preview: HTTP 200, 28,249 bytes.
- CCTV catalog: HTTP 200, 120 District 4 camera entries. Sample caltrans-1 frame: HTTP 200, image/jpeg. This does not certify all cameras or full-motion video.
- Official economic RSS: HTTP 200, 30 recent headlines. The feed does not provide article bodies/photos in the checked response.
- Aircraft: one public HTTP 200 during checks, followed by HTTP 429 on a later request. Continuous aircraft availability is still NOT restored. Earlier direct PC access returned 103 aircraft while public access was restricted; local and cloud request paths differ. No IP rotation or rate-limit bypass was added.
- AIS: actual collector snapshots are preserved, but transport reconnection/staleness must not be presented as guaranteed live vessel coverage.
- RainViewer production permission is unconfirmed and remains restricted. Global individual-person or vehicle live tracking is not available; animated traffic dots are simulations based on road/flow data.

## Verification boundaries

- Build: frontend and Pages Worker built successfully. Nonfatal existing large-chunk/third-party directive warnings remain.
- Focused regression batch: 80 tests passed before the final compatibility regression was added. Final focused source/STAC/provider/account/governor batch: 38 passed. Final Worker/STAC/desktop policy batch: 31 passed. These batches overlap; counts must not be added as unique tests.
- Final provider-attribution regression batch: 30/30 passed, including shared cooldown, source registry, STAC bounds, rejected redirects and preview validation.
- Public security smoke checks: 16/16 passed. This is not a penetration test or a blanket security guarantee.
- Browser QA: 1440x900 and 393x852 passed anonymous redirect, no pre-login Cesium download, invalid-login feedback, multiple selectable results, in-app news question, source UI and actual STAC JPEG preview. Both reported no overflow or WebGL context loss.
- Browser auth/search responses were controlled test fixtures. News, STAC and preview requests used the real public backend. Actual signup email delivery, password reset and production-user login were not tested by creating accounts.
- Ten-minute public multi-layer test completed: 20 samples, no JavaScript page errors, browser exit or WebGL context loss; reported JS heap 40-64 MB, final 54 MB. Flights and military remained limited with zero contacts, earthquakes rendered 37 and satellite propagation rendered 815 in the final sample. Auth/search were controlled fixtures; provider requests were real. This is not a device temperature measurement, global availability guarantee or 60 FPS benchmark.
- The unrestricted full suite was interrupted when concurrent tests and packaging exhausted practical machine responsiveness. Three existing vessel-label assertions failed in that run. No full-suite-green claim is made. Test concurrency is now bounded and configurable through GEV_TEST_CONCURRENCY=1..16.
- Known-secret scan: 931 built files and 688 source files checked against 8 known credential values without printing them. This does not prove absence of every unknown credential.
- git diff --check passed.

## Native and source delivery

- Windows x64 portable 0.3.0 built. Authenticode status: NotSigned. Windows application control blocked the packaged EXE before its smoke test could start. No security protection was disabled to launch it.
- Editable source export includes frontend, Worker, Cloudflare deployment scripts/configurations, tests and project-owned integration modules. It excludes actual environment files, credentials, Git history, dependencies and generated builds. Assets retain their original licenses.
- GitHub-ready delivery is not a claim of a new remote commit. macOS/iOS signing and store releases are not completed on this Windows host.
- Deploy from source with npm ci, npm run build:pages and npm run deploy:pages. The deploy wrapper creates a correctly named Wrangler configuration in its generated deployment directory. Drag-and-drop static source upload does not deploy the API Worker.

## Briefing repositories

stac-map, stac-react, geotiff.js and TiTiler were assessed as references, not installed wholesale. The existing DOM/Cesium application uses its own bounded STAC adapter. No second GPU renderer or TanStack stack was added. NaLaMap informed the bounded intent boundary; Arion GPL code was not copied. The developer rule to register new sources is in AGENTS.md.

Data references: https://element84.com/earth-search/ and https://cds.climate.copernicus.eu/licences/ec-sentinel . Sentinel data rights and required attribution come from the data legal notice, not MIT library licenses.

## Most urgent remaining work

Stabilize the aircraft supplier's public-server access through an approved production allocation or licensed alternative. Audit zero-coverage traffic labels, expand CCTV frame checks conservatively, and use a signed release channel for Windows. High-resolution COG tiling/reprojection is a separate, performance-gated task.
