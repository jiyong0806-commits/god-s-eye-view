# Mobile layout verification - 2026-10-09

## Scope

- Compact mobile map controls without changing the desktop layout or providers.
- Preserve the existing map engine, attribution, account gate and panel actions.
- Diagnose the reported aircraft failure without claiming supplier recovery.

## Changes

- Mobile includes widths up to 760px and short landscape screens up to 950px.
- Five panel controls share a fixed grid row. Opening one panel does not resize
  its neighbors. Existing native controls still own state, timers and cleanup.
- Search buttons are 32px; bottom map actions are 36px. Search input stays 16px
  to avoid iOS focus zoom. Panel labels use 12px high-contrast text.
- Panels are at most 340px wide and 390px high, with viewport-constrained height.
  Layer lists scroll inside the panel. World Connect is at most 340px by 420px.
- Only one mobile panel or World Connect remains open. The command dock is
  hidden while these views are open, preventing it from covering their contents.
- Account dialogs are centered, limited to 360px by 480px and scroll internally;
  their close header remains visible. Safe-area insets are retained.

## Executed verification

- `node --test src/compactPanels.test.mjs src/plasmaWorkspace.test.mjs`: 6/6 pass.
- `npm run build:pages`: passed; frontend and API Worker generated. Existing
  large-chunk and dependency annotation warnings remain.
- `node scripts/verify-compact-mobile.mjs http://127.0.0.1:5192`: passed against
  the built Pages app, not only development CSS.
- `node scripts/verify-compact-mobile.mjs https://godseyeview-c6q.pages.dev`:
  passed after deployment at 320x568, 393x852, 430x932, 852x393 and 1440x900.
- All five panel actions, exclusive opening, internal layer scrolling, account
  dialog positioning and World Connect were exercised. No page errors or lost
  WebGL contexts were observed during these short checks. Canvas pixels confirm
  rendered globe imagery. This is not a 10-minute endurance or thermal test.
- Auth and news responses are explicitly mocked in browser UI checks; assets,
  fonts, globe and application logic are real. This does not validate live feeds,
  actual account credentials or news freshness. Public map and account-config
  endpoints independently returned HTTP 200.
- At 393x852 the initial top occupied region decreased from 236px to 132px.
  Desktop title, toolbar and five panel rectangles match the pre-deploy baseline
  within 1px after the same settling delay. No horizontal document overflow.
- Known-credential scan passed across 931 built files and 691 source files,
  using both legacy project and canonical sandbox env files: eight known values
  checked without printing them. This does not rule out unknown credentials.

## Aircraft failure observed this turn

- Public `/api/opensky?lat=37.5&lon=127` returned HTTP 429, actual supplier
  `adsb.lol`, with Retry-After 60 and a regional-feed rate-limit error.
- One direct PC request to the ADSB.lol regional API returned HTTP 403.
- These observations locate the failure before marker rendering. They do not
  establish the provider's exact IP, account or traffic-blocking criteria.
  A retry timer is not a promise that access will resume after 60 seconds.
- OpenSky remains disabled for the public service under the previously provided
  licensing response. No permission flags, keys or aircraft providers changed.
- Provider permission/access clarification and a permitted alternative feed are
  the urgent next aircraft steps. Do not bypass restrictions or mark cached,
  simulated or missing data as live.

## Deployment and handoff

- Production: https://godseyeview-c6q.pages.dev
- Verified deployment: https://0d5158c2.godseyeview-c6q.pages.dev
- Full editable source: `output/delivery/GODS-EYE-VIEW-2026-10-09-mobile-source`.
  Export includes Cloudflare Worker/config, licenses and project-owned adapters;
  real env files, credentials, dependencies, build output and Git history omitted.
- GitHub changes are scoped to the mobile helper, workspace styles/initialization,
  World Connect styles, tests and this report, based on the verified Oct 8 branch.
- No EXE, native build, BGM, AI model, provider permission or billing changes.
- A Vite-only engine-path startup problem was observed during initial QA; the
  Pages build and deployed map passed instead. That dev-path issue remains
  separate from this mobile fix and must not be described as repaired.
