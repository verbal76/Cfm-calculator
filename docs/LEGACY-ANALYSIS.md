# Legacy application analysis (evidence)

Source of truth for what the historical app did. The historical binary `Gas_CFM_calc.apk` (repo root) and
`cfm original.zip` are preserved untouched.

## Historical APK
| Item | Value |
|---|---|
| File | `Gas_CFM_calc.apk`, 3,640,293 bytes |
| SHA-256 | `8b68129527e37ed46b4e03875f1c0c7a5ef6fd9192e3f017d96aa4668f404a76` |
| Package | `appinventor.ai_verbalgamer.Gas_CFM_calc` |
| Label | Verbal's CFM calculator |
| versionName / versionCode | 3.0 / 3 |
| minSdk / targetSdk / compileSdk | 7 / 33 / 33 (built 2023-09-13 by MIT App Inventor) |
| Permissions | `INTERNET` only (App Inventor default; no network components are used) |
| Components | Activities Screen1 (launcher), Menu, Subcool, Superheat; FileProvider. No services/receivers |
| Native libs / ABIs | none (`lib/` absent) |
| Signing | v1+v2+v3, CN=verbalgamer@gmail.com, O=AppInventor for Android; cert SHA-256 `0A4072918D01ED528B205653911EB1D535C6A3C4545D1EAA4FF4DAD872BE9709` (valid 2014-07-10 → 2041-11-25). The App Inventor account key is not in this repo. |
| Stack | MIT App Inventor (Kawa/YAIL compiled to dex). **Not** Cordova/Capacitor/RN. |
| Storage | None. No TinyDB/File/SQL components; Initialize clears all fields. Nothing is persisted. |
| Network | None used. No analytics, ads or telemetry strings. |

`cfm original.zip` contains only empty `.aia` folders (no `.scm`/`.bky`), so the APK bytecode is the only recoverable source.
Logic below was recovered by disassembling `Screen1`, `Subcool`, `Superheat`, `Menu` (androguard). It was **not** executed on a device.

## What it calculates
HVAC service-technician tool (gas heating): airflow and refrigerant charge checks.

### Screen1 — CFM (launcher screen)
Inputs (text, numeric keyboard): Furnace rated output (BTUH), Supply − Return °F (ΔT), specific heat of air (user types; the
explanatory text cites 1.08), System tonnage. Outputs: Total CFM, CFM per ton.
```
multiplier = ΔT × specificHeat
totalCFM   = BTUH ÷ multiplier
CFM/ton    = totalCFM ÷ tonnage
```
* Division uses App Inventor `yail-divide` → floating point; ÷0 raises "Division by zero" runtime error.
* `*` with an empty/non-numeric operand raises a runtime-error dialog.
* Each output is written as soon as it is computed (partial results remain on a later error).
* No rounding: full double precision; whole numbers print without ".0".
* Clear empties all fields. Labels/hints mapping (which hint belongs to which field) is inferred from string order: UNVERIFIED.

### Subcool
Inputs: Target Subcooling, liquid line temperature, liquid saturation temperature, tolerance (default `3`, "Clear data" restores 3).
```
actual = satTemp − liquidLineTemp
high = target + tolerance;  low = target − tolerance
actual <  low → "Add Refrigerant"
actual >  high → "Recover refrigerant "   (trailing space in original)
otherwise      → "Charge is within Range"   (bounds inclusive)
```
### Superheat
Placeholder screen: one text box and a "Main Menu" button. No calculation exists in v3.0.

### Menu
"Are you calculating superheat and sub cooling or CFM?" with buttons CFM, Subcool, Superheat. Launch screen is CFM; Menu is reached via "Main Menu".

## Intentional changes in 4.0.0
* New platform (Capacitor 8 + native Android, targetSdk 36); new package id `com.hotatticgames.cfmcalculator` (see MODERNIZATION.md).
* `INTERNET` permission removed (never used).
* Runtime-error dialogs replaced by an inline message; partial-result behavior preserved.
* Subcool shows the acceptable range (low–high) that the original computed into fields.
* About screen and Copy Diagnostics added.
* Superheat remains a placeholder (note text added).
* Formulas and formatting unchanged. Possible follow-ups (owner decision, not done): rounding output, default specific heat 1.08, input validation.
