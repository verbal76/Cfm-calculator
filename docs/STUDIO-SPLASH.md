# Hot Attic Games studio splash

Standing studio requirement: every Hot Attic Games app opens with the studio card before its own title/menu.
Artwork: **`Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png`** (repository root; 1536x1024 RGBA, strictly binary alpha: 30.2% fully transparent / 69.8% opaque, clean corners, artwork runs edge to edge).
It is used byte-for-byte (the build copies it unmodified; Vite only renames it with a content hash; the APK check proves the bytes).

## Cold-launch sequence
1. **Android system splash**: plain `#0F0C0B` frame (`Theme.SplashScreen`, blank animated icon, same colour as the WebView background in `capacitor.config.ts`) - no icon, no flash.
2. **Studio card** (`#hag-splash` in `index.html`, timeline in `src/splash.ts`): painted in the very first web frame, fully inline so it does not depend on the stylesheet or JavaScript to appear.
   Logo fades in (400 ms), holds (1700 ms), card fades out into the app (400 ms): **2.5 s nominal**, hard cap 3.0 s.
3. **Product opening**: the Main Menu titled "Verbal's CFM Calculator".

## Behaviour
* Fit: `object-fit: contain` inside a box inset by 8 vmin plus system safe-area insets (`env(safe-area-inset-*)` and Capacitor's `--safe-area-inset-*`). Never cropped or stretched; aspect 3:2 verified.
* Transparency composites over the card background (`#0f0c0b`); no white or black frames.
* Init (parsing the bundled PT dataset, warming the native BuildInfo bridge) runs concurrently behind the card and never adds waiting time. If init is slow the hold is extended up to the 3.0 s cap; init errors are swallowed.
* App UI is `visibility:hidden` until the card starts fading out, so no uninitialised UI is visible; the card blocks touches while up.
* Cold launch only: `sessionStorage` marks the session (reload skips the card before first paint via an inline head script); there is no resume/visibility handler, so backgrounding never replays it.
  A killed process / new WebView is a cold launch and shows the card again.
* Failure safety: unusable artwork skips the card at once; JS failure is covered by a CSS-only failsafe (card hidden and UI revealed after 4.5 s).
* `prefers-reduced-motion`: fades removed, display time unchanged.
* No OTA/updater exists in this app, so there is nothing to coordinate with.

## Verification
* `tests/splash.test.ts`: asset exists/PNG/RGBA/1536x1024/pinned SHA-256, markup uses the canonical file, contain-fit, timeline (nominal 2.5 s, slow init capped at 3 s, init error, bad artwork), cold-launch-only, docs state the requirement.
* `scripts/splash_check.py` (real Chromium/Chrome, run in CI): displayed bytes == canonical file, 1536x1024, aspect and margin on 4 form factors, transparent corners composite over the background, UI hidden during card, ~2.5 s, ordering, touches pass after, navigation, resume does not replay, reload skips, missing artwork and JS failure cannot strand the user.
* `scripts/verify-splash-asset.mjs` (CI): the built `dist/` contains the canonical bytes; `scripts/qualify-apk.sh`: the built APK contains the canonical bytes.
* `scripts/android_smoke.py` (CI emulator, Android 14, run for releases or `[smoke]` commits against the published APK): install, versionCode 6, cold launch order (launch frame -> card -> app), no white flash, Main Menu / open CFM / back by keyboard + OCR, background-resume does not replay the card, full close then cold launch shows the card again, no crash/ANR.
  Card duration is measured from a screen recording. **Observed on the software-rendered emulator: the logo was on screen about 1.5 s, not 2.5 s** (the real-browser run measures exactly 2.50 s). Likely cause: the first paint of the 2.8 MB logo lags the timeline (timers start when the image is decoded, not when it is first presented), which would show as a shorter card or an abrupt appearance on slow-rendering hardware. This is reported as a warning, not hidden; whether it occurs on a real phone is exactly what the physical test should judge. If it does, the fix is to start the visible clock after the first presented frame (pre-rasterise the logo at near-zero opacity, then fade in).
* Not covered by automation (needs a phone): the Android system-splash-to-card handoff and real device safe areas. See docs/PHYSICAL-TEST.md.

## Version
First shipped in Verbal's CFM Calculator v6 (`Verbal-CFM-Calculator-v6.apk`).
