# Release convention (Hot Attic Games studio standard)

**Public version = a single sequential integer: `CFM Calculator v5`, then `v6`, `v7`...** No semver, no codenames, no SHA/build letters in anything the owner sees.
The owner must never have to decode a filename to know what to install.

| Thing | Rule |
|---|---|
| Product short name | `CFM Calculator` (the app label stays "Verbal's CFM Calculator") |
| GitHub Release title | exactly `CFM Calculator v<N>`, marked **Latest** |
| Release tag | `v<N>` (e.g. `v6`) |
| Artifact filenames | `CFM-Calculator-v<N>.apk` (and `.aab`) |
| Release notes | top: install instructions + file name + next version; technical provenance below |
| Android `versionCode` | **equals N** (so it is always monotonic and agrees with the public version) |
| Android `versionName` | `"<N>"` for release builds, `"<N>-dev"` for CI/dev builds |
| In-app About / Copy Diagnostics | show `Version: v<N>` (derived from versionCode) plus package, versionCode, source commit, dataset |

## Single source of truth
`release/VERSION` holds one integer: the public version of the next build to be delivered. Gradle (`versionCode`/`versionName`), the About screen,
diagnostics, release title, tag, filenames and notes are all derived from it. A tag build fails unless the tag number equals `release/VERSION`.

## Delivering a new build (the only way a new number is consumed)
1. Make sure `release/VERSION` is the next unused number `N` (it already is after any release; bump it in the commit that prepares the build).
2. Merge/commit the source, then push the tag: `git tag vN && git push origin vN`.
3. The `Android build` workflow builds, qualifies (package, targetSdk, signature, permissions, ABIs, 16 KB, alignment) and publishes **CFM Calculator vN** as Latest.
4. Immediately afterwards bump `release/VERSION` to `N+1` for the following build.

Rules: never reuse a number for a different binary; never overwrite a published version; failed CI attempts and developer-only builds do not consume numbers.
CI builds from branches/PRs are named `CFM-Calculator-CI-<sha>.apk`, say `v<N>-dev` in About, and are never published as releases.

## Re-labelling an existing verified binary (no rebuild)
Either Actions → **Android build** → *Run workflow* with `promote_version=N` and `promote_from_tag=<existing tag>`, or commit `release/promote.json` (`{"version": N, "from": "<tag>"}`; it is idempotent and skips if `vN` already exists). The workflow downloads the exact binary, verifies its SHA-256 against
that release's `SHA256SUMS.txt`, republishes the identical bytes as `CFM-Calculator-vN.apk` and `CFM Calculator vN` (Latest), and retitles the old test release for display only.

## History and numbering decision
| Public version | Build | versionName / versionCode | Where |
|---|---|---|---|
| v3 | Legacy MIT App Inventor app "Verbal's CFM calculator" | 3.0 / 3 | `Gas_CFM_calc.apk` in the repository (never a GitHub Release; preserved untouched) |
| v4 | First modern (Capacitor) build: CFM, Subcooling, About | 4.0.0 / 4 | release tag `v4.0.0-test.1` (source f18cd5a) |
| v5 | Refrigerant build: PT engine, Subcooling/Superheat by pressure, PT tool | 4.1.0 / 5 | release tag `v4.1.0-test.3` (source 2d27353), republished as `v5` |
| v6 | next | 6 / 6 | |

Rationale: the legacy app already carried versionCode 3 ("3.0"), the two builds delivered since carried versionCode 4 and 5, so the real delivered sequence is 3 → 4 → 5.
This keeps continuity without inventing numbers. Historical tags (`v4.0.0-test.1`, `v4.1.0-test.3`) are immutable provenance and stay; only their display titles were improved.

**Exception:** the v4 and v5 binaries were built before this convention. Inside them, About shows the engineering version ("4.0.0" / "4.1.0 (build 5)") rather than "v5". From v6 onward About shows `v6`, `v7`, ...

## Engineering traceability (kept, not public)
Git SHA, versionCode, package id, target SDK, refrigerant dataset id, CI run, signing identity and checksums remain in release notes, `qualification.md`, `SHA256SUMS.txt` and diagnostics.
