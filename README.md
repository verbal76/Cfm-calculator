# CFM Calculator

Verbal's CFM Calculator (gas-heating CFM per ton and refrigerant subcooling checks).
Capacitor 8 / Android API 36, fully offline. Tools: CFM, refrigerant-aware Subcooling and Superheat, Refrigerant PT (R-22, R-410A, R-32, R-454B, R-407C, R-134a, R-404A). See `docs/LEGACY-ANALYSIS.md`, `docs/MODERNIZATION.md`, `docs/REFRIGERANT-DATA.md` (data provenance, bubble/dew, limits) and `docs/PHYSICAL-TEST.md`.

`Gas_CFM_calc.apk` and `cfm original.zip` are the preserved legacy v3.0 artifacts - do not modify.

```
npm ci && npm run check   # typecheck, lint, tests, web build
npx cap sync android      # then ./gradlew assembleRelease in android/ (CI does this)
```
