# Refrigerant PT data: provenance, methodology and limits

Dataset identifier (shown in About and Copy Diagnostics): `cfm-pt-1.0+coolprop-8.0.0+<10-hex content hash>`
(current value: see `src/refrigerant/dataset.json` → `dataset`; the hash covers every table value).

## Supported refrigerants
R-22, R-410A, R-32, R-454B, R-407C, R-134a, R-404A. One engine (`src/refrigerant/engine.ts`) and one dataset power Subcooling,
Superheat and the PT tool; the picker (`src/picker.ts`) is a single shared component. Adding a refrigerant = add it to
`FLUIDS` in `scripts/gen_refrigerant_dataset.py`, regenerate, add it to `REFRIGERANT_ORDER`.

## Source
Tables are **computed** (not copied) from the open-source **CoolProp 8.0.0** thermodynamic library (MIT license) using its
Helmholtz-energy reference equations of state and mixture models (the same equation-of-state family REFPROP uses):

| Refrigerant | Model | Notes |
|---|---|---|
| R-22, R-32, R-134a | CoolProp pure-fluid EOS | no glide |
| R-410A, R-407C, R-404A | CoolProp predefined mixtures (`R410A.mix`, `R407C.mix`, `R404A.mix`) | R-410A glide ≈ 0.2 °F, R-404A ≈ 0.6–0.9 °F, R-407C ≈ 9–11 °F |
| R-454B | **Modelled** as R-32/R-1234yf, 68.9/31.1 mass % (mole fraction R-32 = 0.8292), HEOS mixture with CoolProp's *default (estimated)* binary parameters | **Lower confidence**, see below |

Generator: `scripts/gen_refrigerant_dataset.py` (dev-time only; the app never calls CoolProp). Golden test fixtures:
`scripts/gen_golden_fixtures.py` → `tests/fixtures/coolprop-golden.json` (computed through CoolProp's *pressure-input* path at non-grid
points so tests exercise the app's interpolation, unit conversion and psia/psig handling independently).

**Redistribution:** CoolProp is MIT licensed; the bundled numbers are factual thermodynamic data computed from published equations of state
(EOS keys reported by CoolProp: R-22 Kamei-IJT-1995; R-32 TillnerRoth-JPCRD-1997; R-134a TillnerRoth-JPCRD-1994; R-1234yf Lemmon-IJT-2022; R-125 Lemmon-JPCRD-2005; R-143a LemmonJacobsen-JPCRD-2000; mixture models as implemented in CoolProp 8.0.0). No
manufacturer chart, image or table is copied.

## Verification status (be honest about it)
* **Manufacturer-chart cross-check: NOT DONE.** The build environment's network policy blocks NIST WebBook, Opteon, Honeywell, Hudson and
  Parker. A web-search-only pass produced unverified paraphrases; they are *not* used as authoritative references. Those paraphrases were
  consistent with the dataset for: R-134a 40 °F = 35.0 psig; R-404A 40 °F = 86.9 (bubble) / 85.4 (dew) psig; R-410A 40 °F ≈ 118.8 psig;
  R-22 ≈ 68.5 psig; R-454B dew points within 0.1 °F of a Honeywell-style table at 0–120 psig.
* **R-454B bubble point runs ≈ 0.4 °F lower** than the same Honeywell-style snippet (the model's estimated binary parameters slightly overstate
  glide: ≈ 2.7 °F modelled vs ≈ 2.2 °F reported). That makes R-454B *subcooling* read up to ≈ 0.4 °F low. Dew (superheat) agrees. The app tells the user
  to verify R-454B against the manufacturer chart.
* An unverified snippet for R-407C 40 °F (61.8 / 74.5 psig) **disagrees** with the dataset (63.2 dew / 80.2 bubble); its column labels are
  suspect (bubble pressure must exceed dew pressure). Resolve against a primary R-407C table.
* Internal consistency is tested: monotonic tables, bubble ≥ dew pressure, round trips, golden values, normal-boiling-point anchors
  (R-134a −14.9 °F, R-22 −41.4 °F, R-32 −61 °F at 0 psig).
* **Owner action to complete verification:** allow these hosts (cloud environment → Network access → Custom): `webbook.nist.gov`,
  `prod-edam.honeywell.com`, `www.opteon.com`, `www.hudsontech.com`; or supply the manufacturer PT charts. Then compare 5 points per refrigerant.

## Pressure basis
Technician input is **gauge pressure (psig)**. Tables store **absolute** pressure (psia). `psig = psia − 14.696` (standard atmosphere, sea level).
Local barometric pressure/altitude is *not* corrected (at 5,000 ft the true atmosphere is ≈ 12.2 psi, so gauge readings correspond to ≈ 2.5 psi higher
absolute pressure; a limitation). Tests pin normal-boiling-point anchors at 0 psig so a psia/psig mix-up fails immediately.
Negative gauge (vacuum) input is rejected in the UI.

## Temperature
°F everywhere in the UI. Tables use a 1 °F grid, **−70 °F to 150 °F** (R-454B to 133 °F where the mixture solver stops near the critical region).
Conversion helpers (`fToC`, `cToF`) exist for a future Celsius mode; nothing else depends on Fahrenheit.

## Interpolation
Linear interpolation of temperature against **ln(absolute pressure)** between adjacent table rows (pressure → temperature), and of ln(P) against
temperature (temperature → pressure). This follows the Clausius–Clapeyron shape of saturation curves; against CoolProp's direct solution the
error is below 0.03 °F / 0.05 psi (tested). No extrapolation: inputs outside the table return "outside the supported range" with the limits.

## Bubble / dew convention
* **Superheat** = measured suction-line temperature − **dew-point** saturation temperature at suction pressure.
* **Subcooling** = **bubble-point** saturation temperature at liquid pressure − measured liquid-line temperature.
* Pure fluids (R-22, R-32, R-134a) have bubble = dew. R-410A's 0.2 °F split is shown as one value in the PT tool (UI), but the calculators still use dew/bubble.
* Basis: consistent across all sources the research pass surfaced (Copeland AE bulletin 95-14 as reported, Arkema Forane tech tip, HVAC School). Those
  documents could not be opened from this environment, so the convention is **widely consistent but not primary-verified here**.
* Tests make a bubble/dew swap fail: e.g. R-407C 63.16 psig/50 °F gives 10.0 °F superheat with dew vs ≈ 19 °F with bubble.

## Formulas
`Superheat = T_line − T_dew(P_suction)`; `Subcooling = T_bubble(P_liquid) − T_line`. Subcooling verdict compares against target ± tolerance (default ±3 °F,
inclusive): "Below / Within / Above target range". Wording is deliberately neutral: it states the measurement against the entered target and does not
instruct charging; manufacturer specifications, airflow, metering device and conditions govern.

## Target superheat: NOT IMPLEMENTED (deliberate)
The usual field rule (target SH = (3 × indoor wet-bulb − 80 − outdoor dry-bulb) / 2) is published by an ACCA blog as a *fallback* when the
manufacturer chart is unavailable. No manufacturer publication of it was found, its origin is unrecorded, no sourced validity limits exist, and a
third-party chart disagreed with it by ≈ 11 °F at one point (13 °F vs 24 °F at 67 °F WB / 95 °F DB). That is not a trustworthy basis, so the app does not
compute a target. The Superheat screen directs users to the manufacturer charging chart. **Owner decision:** supply a manufacturer fixed-orifice chart
(or accept the ACCA formula as a labelled approximation) and it can be added in a small follow-up.

## PT tool
Pressure → bubble/dew temperature and temperature → bubble/dew pressure, both from the same engine; glide refrigerants (≥ 0.5 °F) show bubble and dew,
others a single value; a collapsible chart every 5 °F. Safety class (ASHRAE 34: R-22 A1, R-410A A1, R-32 A2L, R-454B A2L, R-407C A1, R-134a A1, R-404A A1) is shown
under the picker (standard published classifications; not re-verified at the primary source this round).

## Offline
All data ships inside the JS bundle (`dataset.json`, ≈ 30 KB). The app has no INTERNET permission (verified on the built APK).

## Testing methodology
`npm test`: engine table invariants, golden values per refrigerant (both branches, both directions), interpolation midpoints, boundaries, out-of-range, invalid
input, psia/psig guards, bubble/dew swap detectors, calculator validation, pinned physical-test values. `scripts/ui_smoke.py` drives the real DOM in Chromium.
