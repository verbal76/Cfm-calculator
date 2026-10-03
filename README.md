# CFM Calculator

Verbal's CFM Calculator (gas-heating CFM per ton and refrigerant subcooling checks).
Capacitor 8 / Android API 36, offline. See `docs/LEGACY-ANALYSIS.md` and `docs/MODERNIZATION.md`.

`Gas_CFM_calc.apk` and `cfm original.zip` are the preserved legacy v3.0 artifacts - do not modify.

```
npm ci && npm run check   # typecheck, lint, tests, web build
npx cap sync android      # then ./gradlew assembleRelease in android/ (CI does this)
```
