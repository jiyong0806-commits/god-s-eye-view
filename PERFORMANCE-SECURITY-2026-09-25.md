# GOD'S EYE VIEW: performance and security verification (2026-09-25)

## Released

- Cloudflare Pages project: `godseyeview`.
- Production URL: https://godseyeview-c6q.pages.dev/
- Verified deployment: `a01e2fff-644d-4a09-a183-0d8064234556` (deploy stage succeeded).
- Full editable source: https://github.com/jiyong0806-commits/god-s-eye-view (main, initial commit `5d24ce9d4cc34647cb2bd1f8ba328ebf711ff781`).

## Performance

- Touch devices now request 30 fps and 2x MSAA instead of 60 fps and 4x MSAA. Desktop remains at 60 fps and 4x MSAA.
- The two world-overlay canvas backing stores cap DPR at 2. A DPR 3 viewport allocates 4 rather than 9 backing pixels per CSS pixel per surface. The cap is covered by a unit test.
- WebGL `preserveDrawingBuffer` remains enabled because voice viewport capture reads the rendered Cesium canvas. Removing it without replacing capture could return a blank image.
- Headless Chrome verified viewport sizes, frame caps, canvas availability, and no page exceptions. It displayed a flat globe despite receiving Esri HTTP 200 tile responses. The Codex in-app browser rendered actual Esri satellite imagery at the same production URL; headless image results are therefore not accepted as a map-availability verdict.
- These are render-work reductions, not a measured device-temperature claim. Actual thermal and battery testing on target devices remains open.

## Security

- `scripts/security-smoke.mjs` passed 16 bounded public HTTP checks after deployment: hidden environment/config files, JSON API routing, method/origin/content-type/size guards, and response security headers. Record: `output/security-smoke.json` (local, not part of the source export).
- `npm audit` reports zero vulnerabilities including development dependencies after updating the affected packages.
- Source export checked 608 files and 451 built files against eight known canonical `.env` credential values without printing them. This does not establish that unknown credentials are absent.
- Strix scans did not run. The plugin repeatedly returned `UNAUTHORIZED: reauthentication required`; the 16 smoke checks are not a substitute for a penetration test. Before starting any billed scans, inspect the connected organization's balance and authorized domain.

## Remaining work

- Full unit suite: 2,710 tests, 2,678 passed, 30 failed, 2 skipped. Many failures reflect older English-label assertions and changed map/layer contracts; these are not hidden or counted as passes. The focused overlay/Pages/Flow suite passed 58/58.
- Mobile map layout remains crowded at a 393 px viewport. A dedicated functional mobile view remains separate work.
- Provider rate limits, unavailable feeds, commercial permissions and unsupported layers are not made live by this release. Keep source status and retry reasons visible to users.
