# Search, Layout and Dated Imagery Verification

## Implemented

- Typed location searches present all validated candidates (up to 20). Multiple candidates do not move the map until selected. Duplicate coordinates/labels and invalid coordinates are rejected.
- Candidate selection reuses the confirmed coordinates instead of running another geocode or waiting for an Overpass building lookup. Existing camera ownership checks still gate navigation.
- The original four actions and an account action form a bottom-left row of five 44px buttons. Their icons are local Lucide SVGs, not external font glyphs. Duplicate refresh/account controls were removed from the search toolbar.
- Desktop/tablet/phone search tools stay on one row. Compact viewports use an additional-tools menu. Mobile panel headers were compacted and separated from search and voice controls.
- A NASA daily imagery map is available alongside the existing detailed aerial sources. Its date is obtained from NASA GIBS metadata, never invented from the system clock. Manual refresh refetches the dated map provider.
- The startup cover releases after the first rendered frame, with a 600ms fallback; individual data feeds no longer hold the cover open.
- Hanging CCTV image requests have a 15-second deadline and release their pending slot. Hiding or disabling the layer cancels the deadline and image handlers.

## Current Verification

- Focused unit/regression tests: 138 passed, zero failed. Includes search coordinates/selection, image deadlines, NASA metadata, camera handoff and voice basemap aliases.
- Four fresh-browser viewports passed: 1440x900, 834x1112, 393x852 and 852x393. Real search for Seoul Station returned five candidates; selecting a candidate moved the camera. The five actions fit inside each viewport. No JavaScript errors, horizontal page overflow or WebGL context loss were observed in these checks.
- NASA metadata returned HTTP 200 and date 2026-10-03. The dated tiles rendered on the globe. This is daily MODIS imagery at approximately 250m resolution, with clouds and unobserved swaths; it is not October 2026 building-resolution aerial photography.
- Local first usable UI measurements were approximately 2-3.4 seconds in these development checks. They are not a production speed, mobile temperature or long-term stability guarantee.
- A broader legacy markup test selection still has 12 failures (135 tests, 123 passed). The same 12 failures were reproduced in the unmodified 2026-09-27 source delivery. They include English-only expectations against Korean markup and obsolete map-source fixtures. No full-suite green result is claimed.

## Deployment and Remaining Blockers

- Cloudflare OAuth callback authorization and the new device flow both returned an Authentication error. The ordinary Cloudflare login page was subsequently opened successfully for the user. This revision has NOT been deployed to production yet.
- Public CCTV frame caltrans-1 still returned HTTP 502. The same official image returned HTTP 200/image/jpeg (13,446 bytes) directly and through the local Worker code. The precise public Worker/network cause remains unverified; the image deadline does not establish feed recovery.
- Real account authentication/email delivery, physical microphone performance, unrestricted aircraft data, RainViewer commercial permission and daily building-level global imagery remain outside this verified scope.
- Daily imagery metadata is checked when selecting or manually refreshing this map. No claim is made that Esri source photography was re-shot or updated by a scheduled health check.

## Next Urgent Work

1. Finish Cloudflare sign-in, renew only the deployment permissions needed, deploy the existing Pages project and repeat the public browser checks.
2. Inspect public Worker logs for the Caltrans image failure; preserve the camera/host allowlist and do not add an arbitrary URL proxy.
3. Reconcile the legacy localization/map-source tests with the approved UI without weakening behavioral tests, then repeat the broad suite and target-device performance tests.

No API secrets are included in the editable source export or frontend build. The existing canonical environment file and server bindings remain unchanged.
