#!/usr/bin/env bash
set -euo pipefail

if [[ "${SPRINTER_SIDELOAD:-}" != "1" ]]; then
  echo "Set SPRINTER_SIDELOAD=1 to build the personal-test variant." >&2
  exit 1
fi

export NODE_ENV=production
mkdir -p .build/ipa
xcodebuild -version
python3 - <<'PY'
import pathlib, plistlib
path = pathlib.Path('ios/Sprinter/Sprinter.entitlements')
entitlements = plistlib.loads(path.read_bytes())
for key in entitlements:
    if key.startswith('com.apple.developer.healthkit') or key == 'com.apple.security.application-groups':
        raise SystemExit('Unsupported personal-signing entitlement: ' + key)
print('Personal-signing entitlement check passed.')
PY

xcodebuild \
  -workspace ios/Sprinter.xcworkspace \
  -scheme Sprinter \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$PWD/.build/DerivedData" \
  -archivePath "$PWD/.build/Sprinter.xcarchive" \
  -jobs 3 \
  archive \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  CURRENT_PROJECT_VERSION="${GITHUB_RUN_NUMBER:-1}" \
  2>&1 | tee .build/xcodebuild.log | xcbeautify

app="$PWD/.build/Sprinter.xcarchive/Products/Applications/Sprinter.app"
test -d "$app"
test -s "$app/main.jsbundle"
test ! -d "$app/PlugIns"
lipo -archs "$app/Sprinter"
python3 - "$app" <<'PY'
import pathlib, plistlib, sys
app = pathlib.Path(sys.argv[1])
info = plistlib.loads((app / 'Info.plist').read_bytes())
assert info.get('CFBundleSupportedPlatforms') == ['iPhoneOS'], 'Not an iPhone device build'
assert not info.get('NSSupportsLiveActivities'), 'Unexpected Live Activities configuration'
assert 'NSHealthShareUsageDescription' not in info, 'Unexpected HealthKit configuration'
print('Device app verified; JavaScript bundled; no widget extension or HealthKit permission.')
PY

mkdir -p .build/package/Payload
ditto "$app" .build/package/Payload/Sprinter.app
(cd .build/package && zip -qry ../ipa/Sprinter-unsigned.ipa Payload)
(cd .build/ipa && shasum -a 256 Sprinter-unsigned.ipa > SHA256SUMS.txt)
cp docs/INSTALL_IPA.md .build/ipa/INSTALLATION.md
{
  echo "Commit: ${GITHUB_SHA:-$(git rev-parse HEAD)}"
  echo "Variant: personal-test, unsigned"
  echo "HealthKit and Live Activities: disabled"
  echo "JavaScript: embedded Release bundle"
  echo "Workflow: ${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-Flombt/Sprinter}/actions/runs/${GITHUB_RUN_ID:-local}"
  xcodebuild -version
} > .build/ipa/BUILD-INFO.txt
