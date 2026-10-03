#!/usr/bin/env python3
"""Generate src/refrigerant/dataset.json from the CoolProp reference equations of state.

Run (dev-time only, requires `pip install CoolProp==8.0.0`):  python3 scripts/gen_refrigerant_dataset.py

Output rows are saturation states on a 1 degF grid. For each row we store the ABSOLUTE pressure (psia) of the
bubble-point (saturated liquid, Q=0) and dew-point (saturated vapor, Q=1) states at that temperature.
Gauge pressure (psig) = psia - 14.696 (standard atmosphere) is applied by the runtime engine, never here.
"""
import hashlib
import json
import sys

import CoolProp
import CoolProp.CoolProp as CP

ATM_PSI = 14.696
PA_PER_PSI = 6894.757293168
T_MIN_F, T_MAX_F = -70, 150

M = lambda f: CP.PropsSI('molar_mass', f)  # noqa: E731


def r454b_state():
    # ASHRAE 34 composition of R-454B: 68.9 / 31.1 mass % R-32 / R-1234yf
    n32, n1234 = 0.689 / M('R32'), 0.311 / M('R1234yf')
    x32 = n32 / (n32 + n1234)
    a = CoolProp.AbstractState('HEOS', 'R32&R1234yf')
    a.set_mole_fractions([x32, 1 - x32])
    return a


def make_state(fluid):
    if fluid == 'R454B':
        return r454b_state()
    a = CoolProp.AbstractState('HEOS', fluid)
    return a


# id -> (CoolProp name, display, composition (mass %), ASHRAE 34 class, model notes)
FLUIDS = {
    'R-22':   ('R22',   'R-22',   'R-22 (pure)',                              'A1',  'CoolProp pure-fluid EOS (Kamei-IJT-1995)'),
    'R-410A': ('R410A', 'R-410A', 'R-32/125 50/50',                           'A1',  'CoolProp predefined mixture R410A.mix'),
    'R-32':   ('R32',   'R-32',   'R-32 (pure)',                              'A2L', 'CoolProp pure-fluid EOS (TillnerRoth-JPCRD-1997)'),
    'R-454B': ('R454B', 'R-454B', 'R-32/1234yf 68.9/31.1',                    'A2L', 'Modelled as R-32/R-1234yf mixture, HEOS with CoolProp default (estimated) binary parameters'),
    'R-407C': ('R407C', 'R-407C', 'R-32/125/134a 23/25/52',                   'A1',  'CoolProp predefined mixture R407C.mix'),
    'R-134a': ('R134a', 'R-134a', 'R-134a (pure)',                            'A1',  'CoolProp pure-fluid EOS (TillnerRoth-JPCRD-1994)'),
    'R-404A': ('R404A', 'R-404A', 'R-125/143a/134a 44/52/4',                  'A1',  'CoolProp predefined mixture R404A.mix'),
}


def sat_psia(state, tk, q):
    state.update(CoolProp.QT_INPUTS, q, tk)
    return state.p() / PA_PER_PSI


def f2k(f):
    return (f - 32) / 1.8 + 273.15


def main():
    out = {'dataset': None, 'generator': 'scripts/gen_refrigerant_dataset.py', 'coolprop': CoolProp.__version__,
           'atmosphericPsi': ATM_PSI, 'refrigerants': {}}
    for rid, (cp, disp, comp, cls, note) in FLUIDS.items():
        st = make_state(cp)
        rows = []
        for tf in range(T_MIN_F, T_MAX_F + 1):
            try:
                pb = sat_psia(st, f2k(tf), 0)
                pd = sat_psia(st, f2k(tf), 1)
            except Exception:
                break  # stop at the first failure (approaching the critical region)
            rows.append([tf, round(pb, 4), round(pd, 4)])
        # glide (degF) at the bubble pressure of 40 degF and 100 degF
        def glide_at(tf):
            pb = sat_psia(st, f2k(tf), 0)
            st.update(CoolProp.PQ_INPUTS, pb * PA_PER_PSI, 1)
            return (st.T() - f2k(tf)) * 1.8
        out['refrigerants'][rid] = {
            'id': rid, 'name': disp, 'composition': comp, 'ashrae34': cls, 'model': note,
            'glideF40': round(glide_at(40), 2), 'glideF100': round(glide_at(100), 2),
            'rows': rows,
        }
        print(rid, len(rows), 'rows', rows[0][0], '..', rows[-1][0], 'F; glide@40F', out['refrigerants'][rid]['glideF40'],
              'glide@100F', out['refrigerants'][rid]['glideF100'], file=sys.stderr)
    body = json.dumps(out['refrigerants'], sort_keys=True, separators=(',', ':'))
    out['dataset'] = f"cfm-pt-1.0+coolprop-{CoolProp.__version__}+{hashlib.sha256(body.encode()).hexdigest()[:10]}"
    with open('src/refrigerant/dataset.json', 'w') as fh:
        json.dump(out, fh, separators=(',', ':'))
    print(out['dataset'], file=sys.stderr)


if __name__ == '__main__':
    main()
