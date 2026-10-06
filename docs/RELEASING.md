# Release convention (Hot Attic Games studio standard)

**Public version = a single sequential integer: `Verbal's CFM Calculator v6`, then `v7`, `v8`...** (v5 predates the name change and stays as published.) No semver, no codenames, no SHA/build letters in anything the owner sees.
The owner must never have to decode a filename to know what to install.

| Thing | Rule |
|---|---|
| Product name | `Verbal's CFM Calculator` (same as the app label) |
| GitHub Release title | exactly `Verbal's CFM Calculator v<N>`, marked **Latest** |
| Release tag | `v<N>` (e.g. `v6`) |
| Artifact filenames | owner-facing APK **`Verbal-CFM-Calculator-v<N>.apk`** (and `.aab`); CI/dev builds are `Verbal-CFM-Calculator-CI-<sha>.apk` and are never deliverables |
| Release notes | top: install instructions + file name + next version; technical provenance below |
| Android `versionCode` | **equals N** (so it is always monotonic and agrees with the public version) |
| Android `versionName` | `"<N>"` for release builds, `"<N>-dev"` for CI/dev builds |
| In-app About / Copy Diagnostics | show `Version: v<N>` (derived from versionCode) plus package, versionCode, source commit, dataset |

## Single source of truth
`release/VERSION` holds one integer: the public version of the next build to be delivered. Gradle (`versionCode`/`versionName`), the About screen,
diagnostics, release title, tag, filenames and notes are all derived from it. A tag build fails unless the tag number equals `release/VERSION`.

## Delivering a new build (the only way a new number is consumed)
1. Make sure `release/VERSION` is the next unused number `N` (it already is after any release; bump it in the commit that prepares the build).
2. Merge/commit the source, then either push the tag (`git tag vN && git push origin vN`) **or**, where tags cannot be pushed, commit a file `release/deliver`
   containing `N` (the workflow then creates tag `vN` at that commit). Either way the number must equal `release/VERSION` and `vN` must not exist yet.
3. The `Android build` workflow builds, qualifies (package, production versionName/versionCode, not debuggable, targetSdk, signature, permissions, ABIs, 16 KB, alignment, native splash resources, icon, bundled studio card, canonical logo bytes), publishes **Verbal's CFM Calculator vN** as Latest, and stops. The emulator smoke test is no longer automatic (budget policy): to run it against a PUBLISHED build, commit `release/smoke` containing that version number N (`smoke.yml`; emulator evidence only, not a physical test).
4. Immediately afterwards bump `release/VERSION` to `N+1` for the following build.

Rules: never reuse a number for a different binary; never overwrite a published version; failed CI attempts and developer-only builds do not consume numbers.
CI builds from branches/PRs are named `CFM-Calculator-CI-<sha>.apk`, say `v<N>-dev` in About, and are never published as releases.

## Publishing an existing verified binary under its public version (no rebuild)
Used once for v5 (`release/promote.json`, since removed). Either Actions → **Promote verified release** → *Run workflow* (`promote_version=N`, `promote_from_tag=<existing tag>`), or commit `release/promote.json`
(`{"version": N, "from": "<tag>"}`; idempotent). The workflow downloads the release's exact binary, verifies its SHA-256 against that release's `SHA256SUMS.txt`, uploads
identical-bytes copies named `CFM-Calculator-vN.apk/.aab`, removes the cryptic original asset names, retitles the release `CFM Calculator vN`, takes it off prerelease and makes it
**Latest**. The historical git tag is never moved or deleted (the Actions token cannot create a new tag at a commit that modified workflow files, and proxy sessions cannot push tags, so v5
keeps its historical tag name `v4.1.0-test.3`; only the title and filenames are public-facing).

## Workflows and the Actions budget
Hosted minutes are scarce (policy: CLAUDE.md "Actions budget"). Validate locally first: `npm run check:all` (or `npm run check:fast` without the browser step) runs typecheck, lint, all tests, web build, splash asset check and the real-browser splash check via `scripts/local-check.sh`.

| Workflow | Runs when | Cost |
|---|---|---|
| `ci.yml` | non-draft PR opened/updated, or push to `main`; ignores docs, `*.md`, `release/**`, smoke/promote files; cancels superseded runs | ~3 min, no APK |
| `android.yml` (Release build) | tag `vN`, or a push touching `release/deliver` that is a real delivery | full APK/AAB build + qualification + publish; a non-delivery `release/deliver` push stops after seconds |
| `promote.yml` | `release/promote.json` changed, or manual | seconds; no rebuild |
| `smoke.yml` | `release/smoke` changed, or manual | emulator, ~10-20 min; opt-in |

Docs-only and bookkeeping changes trigger nothing. Keep PRs in draft while iterating. Hosted runs are for: final CI of a release candidate, tests not reproducible locally, artifacts needed for physical testing/release, OTA publication checks and store/release builds. Not for: per-push APKs, unrequested platform builds, re-running to see if a test passes, rebuilding an already-verified SHA.

## History and numbering decision
| Public version | Build | versionName / versionCode | Where |
|---|---|---|---|
| v3 | Legacy MIT App Inventor app "Verbal's CFM calculator" | 3.0 / 3 | `Gas_CFM_calc.apk` in the repository (never a GitHub Release; preserved untouched) |
| v4 | First modern (Capacitor) build: CFM, Subcooling, About | 4.0.0 / 4 | release tag `v4.0.0-test.1` (source f18cd5a) |
| v5 | Refrigerant build: PT engine, Subcooling/Superheat by pressure, PT tool | 4.1.0 / 5 | GitHub release titled `CFM Calculator v5` (Latest); historical tag `v4.1.0-test.3`, source 2d27353 |
| v6 | First build with the Hot Attic Games studio splash; first under the name `Verbal's CFM Calculator vN` / `Verbal-CFM-Calculator-vN.apk` | 6 / 6 | tag `v6`, delivered from the `release/deliver` commit |
| v7 | next (candidate prepared on the branch, NOT published): Android Back fix, studio-card robustness | 7 / 7 | |

Rationale: the legacy app already carried versionCode 3 ("3.0"), the two builds delivered since carried versionCode 4 and 5, so the real delivered sequence is 3 → 4 → 5.
This keeps continuity without inventing numbers. Historical tags (`v4.0.0-test.1`, `v4.1.0-test.3`) are immutable provenance and stay; only their display titles were improved.

**Exception:** the v4 and v5 binaries were built before this convention. Inside them, About shows the engineering version ("4.0.0" / "4.1.0 (build 5)") rather than "v5". From v6 onward About shows `v6`, `v7`, ...

## Engineering traceability (kept, not public)
Git SHA, versionCode, package id, target SDK, refrigerant dataset id, CI run, signing identity and checksums remain in release notes, `qualification.md`, `SHA256SUMS.txt` and diagnostics.

## Known issues in published builds
* **v6** (`Verbal-CFM-Calculator-v6.apk`): (1) Android Back closes the app from every screen instead of returning to the Main Menu (Capacitor 8 core has no Back handling); (2) on a slow cold start the studio card can be skipped or shortened (the artwork wait ceiling was 800 ms and the visible clock started before the first presented frame). Both are fixed and emulator-verified in the unpublished v7 candidate. Found by the emulator smoke test (`scripts/android_smoke.py`).
