# Instructions for Claude sessions in this repository

## Release naming is a hard rule (see docs/RELEASING.md)
* Public version is ONE sequential integer: **CFM Calculator v5, v6, v7...** Never semver, codenames, build letters, SHAs or "final/candidate" in titles or filenames.
* GitHub Release title = `CFM Calculator v<N>`, tag `v<N>`, file `CFM-Calculator-v<N>.apk`, and it must be the **Latest** release. Release notes start with the install file and the next version number.
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

## Other standing constraints
* Do not modify `Gas_CFM_calc.apk` or `cfm original.zip` (historical evidence).
* Package id `com.hotatticgames.cfmcalculator`; offline; no INTERNET permission; targetSdk/compileSdk 36.
* Refrigerant data provenance and limits: docs/REFRIGERANT-DATA.md. Do not invent PT values.
