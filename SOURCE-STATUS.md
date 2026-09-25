# Source Delivery - 2026-09-24

This is the current working source, not a claim that every requested feature is finished.

## Included

- God View map, UI, assets and API Worker source.
- Cloudflare configuration (Wrangler 4.136.3 dry-run passed; not publicly deployed).
- Electron Windows/macOS source and manual GitHub build workflow.
- Expo iOS/Android source and dependency lockfile. Both JavaScript exports passed.
- Apple archive/TestFlight configuration; no signed Apple binary or store upload.
- Existing God Flow source and project-owned MCP integration, still in development.
- Source export script with credential checks and per-file SHA-256 manifest.

## Verified

- Root web build passed.
- Selected desktop policy, voice-action, flow graph, MCP and flow-route tests: 89 passed.
- Known credential scan: 8 configured values checked; none found in 451 web build files.
- Desktop packaged startup passed, but visual QA found Cesium blob workers blocked by CSP.
  Source now permits those blob workers; the final executable still needs a rebuild and visual retest.
- The earlier broad GIS suite had 31 failures. This delivery is not all-tests-green.

## Not Finished / Not Activated

- AdSense: address registration was rejected. Cloudflare deployment/domain is now the chosen direction.
  No approval, publisher ID, ads.txt seller identity or ad serving has been fabricated.
- Polar: checkout, webhook verification and production billing are not integrated yet.
- Cesium rejection reason has not been supplied; ion access has not been restored or bypassed.
- The eight newly requested GitHub repositories are not installed in the running app.
  Seven source archives were retrieved for review. OmniRoute exceeded the 100 MiB review download cap.
  Repository descriptions/licenses alone are not a full code/security review.
- Project-Eyes-On discovery/probing of third-party cameras is not enabled.
- No undisclosed geolocation collection from NanoGPS is enabled.
- HYDRO-CORE license was not declared by GitHub metadata; do not redistribute or deploy it without verification.
- No production Cloudflare/GitHub push, new domain purchase or Google Drive backup was performed.
- Third-party Codex plugin private source is not part of this project; only our integration source is supplied.

Keep existing upstream licenses and verify media redistribution rights before making the repository public.
Do not commit real .env files or signing keys. This export deliberately omits them and Git history.
