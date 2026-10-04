# Instructions for Claude sessions in this repository

## Release naming is a hard rule (see docs/RELEASING.md)
* Public version is ONE sequential integer: **CFM Calculator v5, v6, v7...** Never semver, codenames, build letters, SHAs or "final/candidate" in titles or filenames.
* GitHub Release title = `CFM Calculator v<N>`, tag `v<N>`, file `CFM-Calculator-v<N>.apk`, and it must be the **Latest** release. Release notes start with the install file and the next version number.
* `release/VERSION` is the single source of truth (versionCode == N). Push tag `vN` to publish; never publish prereleases named like `v4.1.0-test.3` again.
* Never reuse a number for a different binary. Do not rebuild a verified binary just to rename it (use the workflow's promote path).
* Whenever you deliver a new playable build, tell the owner: `CFM Calculator v<N>` and the exact filename to install, and state that the next one will be v<N+1>.
* SHA, versionCode, dataset id, CI run, etc. stay in diagnostics, release notes and docs only.

## Other standing constraints
* Do not modify `Gas_CFM_calc.apk` or `cfm original.zip` (historical evidence).
* Package id `com.hotatticgames.cfmcalculator`; offline; no INTERNET permission; targetSdk/compileSdk 36.
* Refrigerant data provenance and limits: docs/REFRIGERANT-DATA.md. Do not invent PT values.
