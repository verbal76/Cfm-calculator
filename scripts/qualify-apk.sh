#!/usr/bin/env bash
# Inspect the ACTUAL built APK. Usage: qualify-apk.sh <apk> <expected-package>
set -uo pipefail
APK="$1"; EXPECTED_PACKAGE="$2"
BT="$(ls -d "$ANDROID_HOME"/build-tools/* | sort -V | tail -1)"
FAIL=0
echo "# APK qualification"
echo "- file: $(basename "$APK")"
echo "- bytes: $(stat -c %s "$APK")"
echo "- sha256 (APK itself): $(sha256sum "$APK" | cut -d' ' -f1)"
echo "- build-tools: $(basename "$BT")"
echo; echo "## Badging"; echo '```'
"$BT/aapt2" dump badging "$APK" | grep -E "^(package|sdkVersion|targetSdkVersion|application-label:|launchable|uses-permission|native-code)" 
echo '```'
echo; echo "## Effective permissions"; echo '```'
"$BT/aapt2" dump permissions "$APK"; echo '```'
echo; echo "## Components (xmltree)"; echo '```'
"$BT/aapt2" dump xmltree --file AndroidManifest.xml "$APK" | grep -E "E: (activity|service|receiver|provider) |A: http://schemas.android.com/apk/res/android:(name|exported)\(" ; echo '```'
echo; echo "## Signature"; echo '```'
"$BT/apksigner" verify --verbose --print-certs "$APK"; echo '```'
echo; echo "## ABI / native libraries"; echo '```'
LIBS="$(unzip -Z1 "$APK" | grep -E '^lib/.*\.so$' || true)"
if [ -z "$LIBS" ]; then echo "NONE - APK contains no native .so libraries and no lib/ ABI directories"; else echo "$LIBS"; fi; echo '```'
echo; echo "## ELF 16 KB result"
if [ -z "$LIBS" ]; then echo "PASS (not applicable): no native ELF libraries packaged"; else
  TMP="$(mktemp -d)"; unzip -q "$APK" 'lib/*' -d "$TMP"
  while read -r so; do
    python3 "$(dirname "$0")/elf16k.py" "$TMP/$so" || FAIL=1
  done <<< "$LIBS"
fi
echo; echo "## APK packaging alignment result"; echo '```'
if "$BT/zipalign" -c -P 16 -v 4 "$APK" > /tmp/zipalign.out 2>&1; then echo "PASS: zipalign -c -P 16 (16 KB page alignment for stored .so; 4-byte zip alignment)"; else echo "FAIL"; tail -20 /tmp/zipalign.out; FAIL=1; fi; echo '```'
PKG_ACTUAL="$("$BT/aapt2" dump badging "$APK" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
TGT="$("$BT/aapt2" dump badging "$APK" | sed -n "s/^targetSdkVersion:'\([0-9]*\)'.*/\1/p")"
echo; echo "## Gates"
[ "$PKG_ACTUAL" = "$EXPECTED_PACKAGE" ] && echo "- package id: PASS ($PKG_ACTUAL)" || { echo "- package id: FAIL ($PKG_ACTUAL != $EXPECTED_PACKAGE)"; FAIL=1; }
[ "${TGT:-0}" -ge 36 ] && echo "- targetSdk >= 36: PASS ($TGT)" || { echo "- targetSdk >= 36: FAIL ($TGT)"; FAIL=1; }
if "$BT/aapt2" dump permissions "$APK" | grep -q "INTERNET"; then echo "- no INTERNET permission: FAIL"; FAIL=1; else echo "- no INTERNET permission: PASS"; fi
exit $FAIL
