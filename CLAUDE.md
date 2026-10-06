# Instructions for Claude sessions in this repository

## Release naming is a hard rule (see docs/RELEASING.md)
* Public version is ONE sequential integer: **Verbal's CFM Calculator v6, v7, v8...** Never semver, codenames, build letters, SHAs or "final/candidate" in titles or filenames.
* GitHub Release title = `Verbal's CFM Calculator v<N>`, tag `v<N>`, owner-facing file **`Verbal-CFM-Calculator-v<N>.apk`** (owner-mandated name; never deliver generic names like app-release.apk or the CI artifact), and it must be the **Latest** release. Release notes start with the install file and the next version number.
* v5 was published earlier as `CFM Calculator v5` / `CFM-Calculator-v5.apk` (tag `v4.1.0-test.3`); it is the rollback baseline and is left as published.
* `release/VERSION` is the single source of truth (versionCode == N). Publish by pushing tag `vN` or committing `release/deliver` = N (see docs/RELEASING.md); never publish prereleases or titles named like `v4.1.0-test.3` again.
* Never reuse a number for a different binary. Do not rebuild a verified binary just to rename it (use the workflow's promote path).
* Whenever you deliver a new playable build, tell the owner: `CFM Calculator v<N>` and the exact filename to install, and state that the next one will be v<N+1>.
* SHA, versionCode, dataset id, CI run, etc. stay in diagnostics, release notes and docs only.

## Hot Attic Games studio splash (standing studio-wide requirement)
* Every Hot Attic Games app opens with the studio card BEFORE its own title/menu: native splash (plain frame) -> studio card -> product opening.
* The artwork is the owner-supplied canonical file **`Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png`** at the repository root. Never redraw, recreate, crop, stretch, recolour or substitute it.
  The old `branding/Hot_Attic_Games_Master_Logo.png` path is obsolete; do not wait for or look for it. A test pins the file's SHA-256: changing the logo needs the owner.
* Cold launch only (~2.5 s, hard cap 3 s, fade in/out, aspect preserved, transparency preserved); never replay on resume/reload/navigation; init runs behind it; it can never strand the user.
* Implementation: `index.html` (markup + inline CSS), `src/splash.ts` (timeline), Android splash theme (plain frame), checks in `tests/splash.test.ts` and `scripts/splash_check.py`. See docs/STUDIO-SPLASH.md.

## Actions budget (standing owner directive; hosted minutes are scarce and shared)
* Before triggering ANY hosted workflow ask: **"Does this need GitHub Actions, or can I prove it locally?"** Validate locally first: `npm run check:all` (`scripts/local-check.sh`: tsc, eslint, vitest, web build, splash asset, real-browser splash check). Never use CI as a substitute for local debugging or re-run it to see if a test passes.
* Workflows: `ci.yml` (cheap checks; non-draft PRs + `main` only; skips docs/`release/**`), `android.yml` (RELEASE-only: tag `vN` or a `release/deliver` push), `promote.yml` (only `release/promote.json`), `smoke.yml` (opt-in emulator test, only `release/smoke`). Guarded by `tests/workflow-policy.test.ts`; do not widen triggers.
* Docs/research/bookkeeping changes cost ~zero minutes (path filters). Keep PRs in draft while iterating. No APK/AAB/EXE/OTA artifacts on routine commits; no duplicate workflows for one push; superseded runs are cancelled; reuse a verified artifact (promote path) instead of rebuilding the same SHA.
* Hosted Actions ARE appropriate for: final CI of a candidate near release, tests not reproducible locally, artifacts actually needed for physical testing/release, OTA publication checks, store/release builds, important platform-specific checks.
* Never bypass release safety (qualification/signing checks, version/tag match, runtime/OTA compatibility, release gates, rollback baseline). Never publish a release/OTA/APK merely because of workflow or policy work.
* Do the CI cleanup/operation autonomously; do not ask the owner to trigger or operate routine workflows.

## Other standing constraints
* Android Back: Capacitor 8 core does NOT handle it. Keep `MainActivity`'s `OnBackPressedCallback` (WebView history, close only at the root) and the history-tagged navigation in `src/main.ts`; guarded by `tests/identity.test.ts`.
* Do not modify `Gas_CFM_calc.apk` or `cfm original.zip` (historical evidence).
* Package id `com.hotatticgames.cfmcalculator`; offline; no INTERNET permission; targetSdk/compileSdk 36.
* Refrigerant data provenance and limits: docs/REFRIGERANT-DATA.md. Do not invent PT values.
