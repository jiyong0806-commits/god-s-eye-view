#!/usr/bin/env bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then echo 'macOS with Xcode is required.' >&2; exit 1; fi
: "${APPLE_TEAM_ID:?Set APPLE_TEAM_ID outside the repository}"
: "${ASC_KEY_ID:?Set ASC_KEY_ID outside the repository}"
: "${ASC_ISSUER_ID:?Set ASC_ISSUER_ID outside the repository}"
: "${ASC_KEY_PATH:?Set ASC_KEY_PATH to an external .p8 file}"
test -f "$ASC_KEY_PATH"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/mobile"
npm ci
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
WORKSPACE="$(find "$PWD/ios" -maxdepth 1 -name '*.xcworkspace' -print -quit)"
test -n "$WORKSPACE"
: "${IOS_SCHEME:?Set IOS_SCHEME from xcodebuild -list -workspace <workspace>}"
mkdir -p "$ROOT/output/ios"
xcodebuild -workspace "$WORKSPACE" -scheme "$IOS_SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ROOT/output/ios/GodsEyeView.xcarchive" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" -allowProvisioningUpdates \
  -authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID" archive
if [[ "${1:-}" == '--upload' ]]; then
  : "${EXPORT_OPTIONS:?Set EXPORT_OPTIONS to an App Store export plist}"
  xcodebuild -exportArchive -archivePath "$ROOT/output/ios/GodsEyeView.xcarchive" \
    -exportPath "$ROOT/output/ios/export" -exportOptionsPlist "$EXPORT_OPTIONS" \
    -allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH" \
    -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID"
fi
