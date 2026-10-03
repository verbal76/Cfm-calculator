#!/usr/bin/env python3
"""Golden fixtures computed DIRECTLY from CoolProp (pressure-input path, non-grid points) - independent of the
1 degF grid + interpolation used by the app, so tests catch interpolation, unit and psia/psig mistakes."""
import json

import CoolProp
import CoolProp.CoolProp as CP
import importlib.util, sys

spec = importlib.util.spec_from_file_location('gen', 'scripts/gen_refrigerant_dataset.py')
gen = importlib.util.module_from_spec(spec); spec.loader.exec_module(gen)

PSIG_POINTS = [5.5, 20.25, 37.5, 68.0, 101.3, 118.0, 150.75, 240.0, 301.7]
TEMP_POINTS = [-10.5, 0.5, 33.25, 40.5, 75.0, 99.5, 115.25]
out = {'coolprop': CoolProp.__version__, 'atmosphericPsi': gen.ATM_PSI, 'refrigerants': {}}
for rid, (cp, *_rest) in gen.FLUIDS.items():
    st = gen.make_state(cp)
    pts = []
    for psig in PSIG_POINTS:
        pa = (psig + gen.ATM_PSI) * gen.PA_PER_PSI
        try:
            st.update(CoolProp.PQ_INPUTS, pa, 0); tb = (st.T() - 273.15) * 1.8 + 32
            st.update(CoolProp.PQ_INPUTS, pa, 1); td = (st.T() - 273.15) * 1.8 + 32
        except Exception:
            continue
        pts.append({'psig': psig, 'bubbleF': round(tb, 4), 'dewF': round(td, 4)})
    tps = []
    for tf in TEMP_POINTS:
        try:
            tb = gen.f2k(tf)
            st.update(CoolProp.QT_INPUTS, 0, tb); pb = st.p() / gen.PA_PER_PSI - gen.ATM_PSI
            st.update(CoolProp.QT_INPUTS, 1, tb); pd = st.p() / gen.PA_PER_PSI - gen.ATM_PSI
        except Exception:
            continue
        tps.append({'tempF': tf, 'bubblePsig': round(pb, 4), 'dewPsig': round(pd, 4)})
    out['refrigerants'][rid] = {'fromPressure': pts, 'fromTemp': tps}
json.dump(out, open('tests/fixtures/coolprop-golden.json', 'w'), indent=1)
print({k: (len(v['fromPressure']), len(v['fromTemp'])) for k, v in out['refrigerants'].items()})
