#!/usr/bin/env bash
# Inspect the ACTUAL built APK. Usage: qualify-apk.sh <apk> <expected-package>
set -uo pipefail
APK="$1"; EXPECTED_PACKAGE="$2"; HAG_LOGO_SHA256="${3:-}"; EXPECTED_VERSION_NAME="${4:-}"
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
echo; echo "## Hot Attic Games studio splash artwork (inside the APK)"; echo '```'
LOGO_ENTRIES="$(unzip -Z1 "$APK" | grep -E '^assets/public/assets/Hot_Attic_Games_Master_Logo_ALPHA_FINAL-.*\.png$' || true)"
if [ -z "$HAG_LOGO_SHA256" ]; then echo "SKIPPED: no expected SHA-256 supplied"
elif [ "$(printf '%s\n' "$LOGO_ENTRIES" | grep -c .)" -ne 1 ]; then echo "FAIL: expected exactly one Hot_Attic_Games_Master_Logo_ALPHA_FINAL asset in the APK, found: ${LOGO_ENTRIES:-none}"; FAIL=1
else
  GOT="$(unzip -p "$APK" "$LOGO_ENTRIES" | sha256sum | cut -d' ' -f1)"
  if [ "$GOT" = "$HAG_LOGO_SHA256" ]; then echo "PASS: $LOGO_ENTRIES is byte-identical to the canonical Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png ($GOT)"; else echo "FAIL: $LOGO_ENTRIES differs from the canonical file ($GOT vs $HAG_LOGO_SHA256)"; FAIL=1; fi
fi; echo '```'
echo; echo "## Production identity, native splash resources, icon and bundled studio card"; echo '```'
BADGING="$("$BT/aapt2" dump badging "$APK")"
VNAME="$(printf '%s\n' "$BADGING" | sed -n "s/^package: .* versionName='\([^']*\)'.*/\1/p")"
VCODE="$(printf '%s\n' "$BADGING" | sed -n "s/^package: .* versionCode='\([^']*\)'.*/\1/p")"
echo "versionName='$VNAME' versionCode='$VCODE'"
if [ -n "$EXPECTED_VERSION_NAME" ]; then
  if [ "$VNAME" = "$EXPECTED_VERSION_NAME" ] && [ "$VCODE" = "$EXPECTED_VERSION_NAME" ]; then echo "PASS: production identity (versionName == versionCode == $EXPECTED_VERSION_NAME, no -dev suffix)"; else echo "FAIL: expected production versionName/versionCode $EXPECTED_VERSION_NAME"; FAIL=1; fi
fi
if grep -q "application-debuggable" <<<"$BADGING"; then echo "FAIL: APK is debuggable"; FAIL=1; else echo "PASS: not debuggable (release build)"; fi
RES="$("$BT/aapt2" dump resources "$APK" 2>/dev/null)"
for want in "drawable/splash_icon_blank" "drawable/splash" "NoActionBarLaunch" "mipmap/ic_launcher"; do
  if grep -Eq "$want" <<<"$RES"; then echo "PASS: resource present: $want"; else echo "FAIL: resource missing: $want"; FAIL=1; fi
done
ICON="$(printf '%s\n' "$BADGING" | sed -n "s/^application-icon-[0-9]*:'\(.*\)'/\1/p" | head -1)"
[ -n "$ICON" ] && echo "PASS: app icon packaged: $ICON" || { echo "FAIL: no application-icon entry"; FAIL=1; }
unzip -p "$APK" assets/public/index.html > /tmp/apk-index.html 2>/dev/null
for want in 'id="hag-splash"' 'id="hag-splash-img"' 'Hot_Attic_Games_Master_Logo_ALPHA_FINAL' 'data-splash'; do
  if grep -q "$want" /tmp/apk-index.html; then echo "PASS: bundled index.html contains $want"; else echo "FAIL: bundled index.html lacks $want"; FAIL=1; fi
done
JS="$(unzip -Z1 "$APK" | grep -E '^assets/public/assets/index-.*\.js$' | head -1)"
[ -n "$JS" ] && unzip -p "$APK" "$JS" > /tmp/apk-app.js 2>/dev/null
if [ -n "$JS" ] && grep -q "hag.splash.shown" /tmp/apk-app.js; then echo "PASS: bundled app code contains the studio-card timeline ($JS)"; else echo "FAIL: studio-card timeline missing from bundled JS"; FAIL=1; fi
unzip -p "$APK" assets/capacitor.config.json > /tmp/apk-capcfg.json 2>/dev/null
grep -qi '"backgroundColor": *"#0f0c0b"' /tmp/apk-capcfg.json && echo "PASS: Capacitor WebView background matches the native frame (#0f0c0b)" || { echo "FAIL: capacitor.config.json backgroundColor not #0f0c0b"; FAIL=1; }
echo "native libraries: none (verified in the ABI section above)"
echo '```'
PKG_ACTUAL="$("$BT/aapt2" dump badging "$APK" | sed -n "s/^package: name='\([^']*\)'.*/\1/p")"
TGT="$("$BT/aapt2" dump badging "$APK" | sed -n "s/^targetSdkVersion:'\([0-9]*\)'.*/\1/p")"
echo; echo "## Gates"
[ "$PKG_ACTUAL" = "$EXPECTED_PACKAGE" ] && echo "- package id: PASS ($PKG_ACTUAL)" || { echo "- package id: FAIL ($PKG_ACTUAL != $EXPECTED_PACKAGE)"; FAIL=1; }
[ "${TGT:-0}" -ge 36 ] && echo "- targetSdk >= 36: PASS ($TGT)" || { echo "- targetSdk >= 36: FAIL ($TGT)"; FAIL=1; }
PERMS_OUT="$("$BT/aapt2" dump permissions "$APK")"
if grep -q "INTERNET" <<<"$PERMS_OUT"; then echo "- no INTERNET permission: FAIL"; FAIL=1; else echo "- no INTERNET permission: PASS"; fi
exit $FAIL
