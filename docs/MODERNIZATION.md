# Modernization decisions

* **Architecture: Capacitor 8 (vanilla TypeScript + Vite UI) in a native Android shell.** The legacy app is a tiny form-based
  calculator with no native features; a web UI is the lowest-risk maintainable path. Alternatives rejected: rebuilding in
  App Inventor (no source, no API 36 path), React Native/Expo (framework overhead, no benefit), native Kotlin (more code for no gain).
* **Toolchain:** Capacitor 8.5.x template: AGP 8.13.0, Gradle 8.14.3, JDK 21 (CI), compileSdk 36, targetSdk 36, minSdk 24. No NDK/Kotlin; no native libs.
* **Package id:** `com.hotatticgames.cfmcalculator`. The historical id (`appinventor.ai_verbalgamer.Gas_CFM_calc`) was signed with
  an App Inventor account key that is not available, so the new APK could never upgrade the old app regardless of id, and the old
  app stores no data. The new app therefore installs **alongside** the legacy app. If the owner needs the legacy id for external
  continuity, that is an owner decision (it would still not upgrade in place without the original key).
  `tests/identity.test.ts` guards drift across Capacitor config, Gradle, strings, Java and CI.
* **Version:** 4.0.0 / versionCode 4 (continues legacy 3.0 / 3).
* **Signing:** release build signed with the debug key for physical testing. No production key exists or is committed.
* **OTA:** NOT RECOMMENDED. Offline calculator with a bundled UI; an updater adds attack surface and complexity for no value.
  "Applying update" UI: NOT APPLICABLE.
* **Studio splash:** `branding/Hot_Attic_Games_Master_Logo.png` is absent from this repository and its history.
  BLOCKED — CANONICAL HOT ATTIC GAMES ASSET REQUIRES PORTFOLIO/OWNER SUPPLY. Startup uses a neutral solid-color native splash (no Capacitor logo).
* **AAB:** CI also builds `bundleRelease` (AAB READY; Play upload and production signing deferred).
* **16 KB:** no native libraries are packaged; APK alignment is verified in CI with `zipalign -P 16` (`scripts/qualify-apk.sh`).

## Physical-device test checklist
1. Install: succeeds; package `com.hotatticgames.cfmcalculator`; coexists with legacy app (different id).
2. Startup: cold + warm launch lands on CFM screen; blue splash only; portrait and landscape OK.
3. CFM: 108000 / 50 / 1.08 / 3 → Total 2000, per ton 666.6666666666666; zero, decimals, large (1e9), empty, letters, ΔT=0, tons=0 (error text, partial output); Clear.
4. Subcool: target 10, liquid 90, sat 100 → 10, within; sat 96 → Add Refrigerant; sat 104 → Recover refrigerant; tolerance edit; Clear restores 3.
5. Menu/Superheat/back button steps Main Menu ↔ screens; back on CFM exits.
6. Android: edge-to-edge bars not overlapping content, keyboard doesn't hide the focused field, airplane mode works, no permission prompts, Settings → App info shows no permissions.
7. About: version 4.0.0 (build 4), package, target SDK 36, Copy Diagnostics pastes plain text.
8. Persistence: nothing is stored by design; force-stop → relaunch shows empty fields.
9. Parity (if legacy APK runnable on a device): compare the same CFM and Subcool inputs; note output digits.
