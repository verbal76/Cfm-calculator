# Physical-device test checklist (v6: Verbal-CFM-Calculator-v6.apk; v5 = engineering version 4.1.0 / code 5, older)

Expected values come from the bundled dataset `cfm-pt-1.0+coolprop-8.0.0+fb20caa09e` (CoolProp reference EOS). They are **not yet compared to manufacturer charts**
(see docs/REFRIGERANT-DATA.md); where your own chart differs, note which refrigerant and by how much. Values are shown to 1 decimal as the app displays them.
Test builds use an ephemeral debug key: **uninstall any previous test build first**. The legacy App Inventor app can stay installed (different package).

## A. Install and launch
1. Install the APK; launcher label "Verbal's CFM Calculator". (v6 and later) Cold launch: plain dark frame, then the Hot Attic Games logo card for about 2.5 s with a soft fade in/out, then the Main Menu. Background and reopen: no logo card again. Force-stop and reopen: logo card again.
2. Cold launch (force-stop first) shows the studio card, then lands on the **Main Menu** with 4 big buttons: CFM, Subcooling, Superheat, Refrigerant PT.
3. Warm launch (Home, then reopen): same screen.
4. Settings → App info → Permissions shows **none requested**.

## B. CFM (historical)
5. CFM: 108000 / 50 / 1.08 / 3 → Total CFM **2000**, CFM per ton **666.6666666666666**. Clear empties everything. ΔT = 0 → "Division by zero…" message.

## C. Picker and PT lookups (Refrigerant PT screen, "Pressure, psig" field)
6. Tap each chip: R-22, R-410A, R-32, R-454B, R-407C, R-134a, R-404A; the highlighted chip and the info line change; the choice is still selected on the other screens.
| # | Refrigerant | Enter psig | Expected |
|---|---|---|---|
| 7 | R-22 | 70 | Saturation temp **41.0°F** |
| 8 | R-410A | 120 | Saturation temp **40.5°F** (single value; bubble 40.5 / dew 40.7) |
| 9 | R-32 | 120 | **39.6°F** |
| 10 | R-454B | 100 | Bubble **33.7°F**, Dew **36.4°F** |
| 11 | R-407C | 70 | Bubble **33.6°F**, Dew **44.5°F** |
| 12 | R-134a | 35 | **40.0°F** |
| 13 | R-404A | 100 | Bubble **47.3°F**, Dew **48.1°F** |
14. Glide check: R-407C at 70 psig must show **two different values ≈ 11°F apart** (bubble 33.6, dew 44.5).
15. Temperature → pressure ("Saturation temperature, °F" = 40): R-22 **68.6**; R-410A **118.8**; R-32 **121.0**; R-454B bubble **113.2** / dew **107.5**; R-407C bubble **80.2** / dew **63.2**; R-134a **35.0**; R-404A bubble **86.9** / dew **85.4** psig.
16. Interpolation: R-410A at **125.5** psig → bubble **42.9°F**, dew **43.1°F** (between table rows).
17. Chart: expand "PT chart (every 5 °F)"; the 40 row matches item 15.

## D. Superheat (dew point)
18. R-410A, 118 psig, line 52°F → sat **39.8°F**, Superheat **12.2°F**.
19. R-407C, 63 psig, line 50°F → sat **39.9°F**, Superheat **10.1°F** (using bubble would give ≈ 19°F: that would be a bug).
20. R-22, 68.5 psig, line 55°F → **15.0°F**. R-454B, 107.5 psig, line 50°F → **10.0°F**.
21. Line temp below dew point (R-22, 68.5 psig, 30°F) → negative superheat with a "liquid may be present" note.
22. Target superheat: not provided by design; screen text points to the manufacturer chart.

## E. Subcooling (bubble point)
23. R-410A, 350 psig, line 95°F, target 10 → sat **106.7°F**, Subcooling **11.7°F**, "Within target range (7.0 to 13.0°F)".
24. R-407C, 250 psig, 95°F, target 10 → sat **107.2°F**, **12.2°F**, within.
25. R-22, 226 psig, 100°F, target 10 → **9.9°F**, within. R-454B, 330 psig, 98°F, target 10 → sat **106.0°F**, **8.0°F**, within.
26. R-410A 350 psig, 105°F, target 10 → **1.7°F**, "Below target range"; 85°F → **21.7°F**, "Above target range". Blank target → no verdict.

## F. Errors and input handling
27. Blank pressure → "Enter … pressure (psig)." Letters → "must be a number." Negative → "at or above 0 psig". 9999 psig → "outside the supported range … (0 to N psig)". Line temp 9999 → "not a realistic line temperature". No NaN, no crash.
28. Keyboard: numeric keypad appears on every numeric field; focused field stays visible; Done/Back closes it.
29. Back button: from a tool screen (CFM, Subcooling, Superheat, Refrigerant PT, About) Back returns to the Main Menu; Back at the Main Menu closes the app. **Known issue in v6 only:** Back closed the app from every screen (Capacitor 8 core has no Back handling); fixed in the next build.
30. Rotate to landscape and back: layout intact, no lost inputs.

## G. Offline and diagnostics
31. Turn on airplane mode; repeat items 7, 19 and 23: identical results.
32. About: for the v5 binary, version **4.1.0 (build 5)** (v6 and later show "v6", "v7"...), package com.hotatticgames.cfmcalculator, target SDK 36; "Refrigerant PT dataset: cfm-pt-1.0+coolprop-8.0.0+fb20caa09e".
33. Copy Diagnostics, paste anywhere: plain text, contains "Refrigerant dataset: cfm-pt-1.0+coolprop-8.0.0+fb20caa09e", no personal data.
34. Force-stop and relaunch: refrigerant choice is remembered; no entered values persist (by design).
35. Report any value differing from your own PT chart by more than 1 psi / 1°F (R-454B bubble may read ≈ 0.4°F low versus a manufacturer table).

## Quick splash test (v6)
1. Uninstall any earlier test build (v5 or other: the test signing key differs per build), then install `Verbal-CFM-Calculator-v6.apk`.
2. Fully close it, launch it: plain dark frame -> Hot Attic Games card (about 2.5 s, soft fade in and out) -> Main Menu.
3. Check logo size, centering, transparent edges, margins, aspect ratio; look for flashes or ugly transitions; judge the fade timing.
4. Open CFM, enter 108000 / 50 / 1.08 / 3 -> Total CFM 2000, CFM per ton 666.6666666666666.
5. Background the app and come back: the Hot Attic Games card must NOT replay.
6. Fully close and launch again: the card MUST appear again.
7. About shows "Version: v6".
