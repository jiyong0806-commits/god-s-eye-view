# GOD'S EYE VIEW / PLASMA

## Source Layout

- `src`, `index.html`, `public`: complete existing God View map and assets.
- `worker`: public backend and provider state handling.
- `wrangler.jsonc`: standalone Cloudflare Workers deployment configuration.
- `apps/desktop`: Windows/macOS Electron application. Opens the map directly.
- `apps/mobile`: Expo iOS/Android WebView application. Opens the public map directly.
- `apps/web`, `packages/god-*`, `tools`: God Flow and the project-owned MCP integration.
- `infra/apple`, `scripts/build-testflight.sh`: Apple archive/upload configuration.
- `.github/workflows/desktop-release.yml`: manually triggered Windows/macOS artifact build.

These are project source files and integrations, not the private source code of third-party Codex plugins.
The Cesium map engine is retained. Unity is not added as a second engine.

## Build

Use Node.js 22 or newer. In the repository root:

```sh
npm ci
npm run build
npm ci --prefix apps/desktop
npm run build:win --prefix apps/desktop
```

On macOS, replace the last command with `npm run build:mac --prefix apps/desktop`.
Windows output is in `output/desktop`. Unsigned builds are for testing, not verified publisher releases.
Do not disable operating-system security warnings to install an untrusted copy.

The desktop application contains the actual web map bundle, not an Internet shortcut.
It uses a private application protocol, does not open a TCP listening port, and does not stop other servers.
Live data still requires the public backend and each provider's permission/configuration.
No provider keys, signing keys or `.env` files are included in the app or source delivery.

## Cloudflare

```sh
npm run build
npx wrangler@4.136.3 deploy --config wrangler.jsonc
```

Set backend secrets with `wrangler secret put NAME`, never in `vars` or frontend code.
TomTom/TTS remain disabled without a durable `PROVIDER_DB` D1 binding and
`migrations/0001_provider_usage.sql`. The maximum configured daily budgets are 500 and 50.
RainViewer and OpenSky permissions are not granted by deployment.
The existing Sites manifest is also preserved for publishing to the existing chatgpt.site address.

## iOS / Android

```sh
cd apps/mobile
npm ci
npx expo prebuild
npx expo run:android
```

Android needs a JDK, Android SDK and an emulator/device. iOS needs macOS, Xcode and CocoaPods.
Use EAS only after signing in and checking account quotas; no paid build has been started.
`eas.json` contains APK preview and AAB production profiles. Store submissions are not automatic.
The TestFlight script requires externally stored Apple credentials and a real Apple team.
`--upload` explicitly opts in to upload. Verify archive/export results and App Store processing before reporting release success.

## Verification And Limits

- God Flow graph/runtime and backend contract tests are included.
- Local Ollama returned a real Korean answer; public AI is not connected to that private PC.
- The prior broad GIS test run contained 31 failures, many concerning existing localized text.
  A passing build is not a claim that every provider or every prior test is healthy.
- iOS/macOS/Android release binaries require their toolchains and signing verification.
- Database schema/RLS groundwork exists; frontend cloud saving is not yet enabled.
- Backup and Google Drive upload are stopped at the user's request.

For future deliveries, include the source folder, dependency lockfiles, build configuration,
artifact checksums and a verification report with each executable or deployed artifact.

## GitHub Handoff

`output/delivery/GODS-EYE-VIEW-source` is the credential-filtered working source, including
the current uncommitted changes and an SHA-256 manifest. It excludes Git history, dependencies,
build output and caches. `.env.example` describes configuration; actual keys remain on your machine.
Create your own private repository and push this folder to that repository after reviewing the
included media licenses. The upstream attribution and license are intentionally retained.
No GitHub repository, Google Drive backup or public Cloudflare deployment is created by this export.

The included `apps/web` and `packages/god-*` folders preserve ongoing God Flow work;
their presence does not mean the full God Flow product is finished. Windows opens God View first.
