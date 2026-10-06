import { describe, expect, it } from 'vitest';
import golden from './fixtures/coolprop-golden.json';
import {
  ATMOSPHERIC_PSI, DATASET_ID, REFRIGERANT_ORDER, getRefrigerant, listRefrigerants, pressureRangePsig, psigFromSaturationTemp,
  rawRows, saturationTempFromPsig, tableRows, type Branch, type RefrigerantId,
} from '../src/refrigerant/engine';
import {
  calculateSubcoolingFromPressure, calculateSuperheat, lookupFromPressure, lookupFromTemperature, VERDICT_TEXT,
} from '../src/refrigerant/superheatSubcool';

const T = (r: { ok: boolean; value?: number }) => { if (!r.ok) throw new Error('lookup failed'); return r.value as number; };
const G = golden.refrigerants as Record<string, { fromPressure: { psig: number; bubbleF: number; dewF: number }[]; fromTemp: { tempF: number; bubblePsig: number; dewPsig: number }[] }>;

describe('dataset', () => {
  it('has the core seven refrigerants and a dataset id', () => {
    expect(listRefrigerants().map((r) => r.id)).toEqual(['R-22', 'R-410A', 'R-32', 'R-454B', 'R-407C', 'R-134a', 'R-404A']);
    expect(DATASET_ID).toMatch(/^cfm-pt-1\.0\+coolprop-8\.0\.0\+[0-9a-f]{10}$/);
    expect(ATMOSPHERIC_PSI).toBe(14.696);
  });
  it.each(REFRIGERANT_ORDER)('%s table is monotonic with bubble >= dew pressure', (id) => {
    const rows = rawRows(id);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].bubble).toBeGreaterThan(rows[i - 1].bubble);
      expect(rows[i].dew).toBeGreaterThan(rows[i - 1].dew);
    }
    for (const r of rows) expect(r.bubble).toBeGreaterThanOrEqual(r.dew - 1e-6);
  });
  it('safety classes and glide flags', () => {
    const c = (id: RefrigerantId) => getRefrigerant(id);
    expect(c('R-32').ashrae34).toBe('A2L');
    expect(c('R-454B').ashrae34).toBe('A2L');
    expect(c('R-22').ashrae34).toBe('A1');
    expect(c('R-407C').hasGlide).toBe(true);
    expect(c('R-454B').hasGlide).toBe(true);
    expect(c('R-404A').hasGlide).toBe(true);
    expect(c('R-22').hasGlide).toBe(false);
    expect(c('R-32').hasGlide).toBe(false);
    expect(c('R-134a').hasGlide).toBe(false);
  });
});

describe.each(REFRIGERANT_ORDER)('%s vs independent CoolProp golden values', (id) => {
  it('pressure -> saturation temperature (non-grid pressures, both branches)', () => {
    let compared = 0;
    for (const g of G[id].fromPressure) {
      for (const [branch, want] of [['bubble', g.bubbleF], ['dew', g.dewF]] as [Branch, number][]) {
        const [lo, hi] = pressureRangePsig(id, branch);
        const r = saturationTempFromPsig(id, g.psig, branch);
        if (g.psig < lo || g.psig > hi) { expect(r.ok).toBe(false); continue; } // beyond the tabulated range: rejected, never extrapolated
        expect(Math.abs(T(r) - want)).toBeLessThan(0.03);
        compared++;
      }
    }
    expect(compared).toBeGreaterThanOrEqual(10);
  });
  it('temperature -> pressure (half-degree temperatures, both branches)', () => {
    for (const g of G[id].fromTemp) {
      const b = T(psigFromSaturationTemp(id, g.tempF, 'bubble'));
      const d = T(psigFromSaturationTemp(id, g.tempF, 'dew'));
      expect(Math.abs(b - g.bubblePsig)).toBeLessThan(0.05 + 0.0005 * Math.abs(g.bubblePsig));
      expect(Math.abs(d - g.dewPsig)).toBeLessThan(0.05 + 0.0005 * Math.abs(g.dewPsig));
    }
  });
});

describe.each(REFRIGERANT_ORDER)('%s interpolation, boundaries and basis', (id) => {
  const rows = rawRows(id);
  const mid = Math.floor(rows.length / 2);
  it('exact table point returns the table temperature', () => {
    for (const branch of ['bubble', 'dew'] as Branch[]) {
      const row = rows[mid];
      const psig = (branch === 'bubble' ? row.bubble : row.dew) - ATMOSPHERIC_PSI;
      expect(T(saturationTempFromPsig(id, psig, branch))).toBeCloseTo(row.t, 6);
    }
  });
  it('halfway between points is between the neighbours and round-trips', () => {
    const a = rows[mid], b = rows[mid + 1];
    const psig = (Math.sqrt(a.bubble * b.bubble)) - ATMOSPHERIC_PSI; // geometric mean = exact midpoint in ln(P)
    const t = T(saturationTempFromPsig(id, psig, 'bubble'));
    expect(t).toBeCloseTo((a.t + b.t) / 2, 6);
    expect(T(psigFromSaturationTemp(id, t, 'bubble'))).toBeCloseTo(psig, 4);
  });
  it('lower and upper boundaries are accepted; just outside is rejected without extrapolating', () => {
    for (const branch of ['bubble', 'dew'] as Branch[]) {
      const [lo, hi] = pressureRangePsig(id, branch);
      expect(saturationTempFromPsig(id, lo, branch).ok).toBe(true);
      expect(saturationTempFromPsig(id, hi, branch).ok).toBe(true);
      const below = saturationTempFromPsig(id, lo - 0.5, branch);
      const above = saturationTempFromPsig(id, hi + 0.5, branch);
      expect(below.ok).toBe(false);
      expect(above.ok).toBe(false);
      if (!below.ok) expect(below.error.kind).toBe('OUT_OF_RANGE');
    }
    const [tlo, thi] = getRefrigerant(id).tempRangeF;
    expect(psigFromSaturationTemp(id, tlo, 'bubble').ok).toBe(true);
    expect(psigFromSaturationTemp(id, thi, 'dew').ok).toBe(true);
    expect(psigFromSaturationTemp(id, tlo - 1, 'bubble').ok).toBe(false);
    expect(psigFromSaturationTemp(id, thi + 1, 'bubble').ok).toBe(false);
  });
  it('invalid numbers are rejected', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(saturationTempFromPsig(id, bad, 'bubble').ok).toBe(false);
      expect(psigFromSaturationTemp(id, bad, 'dew').ok).toBe(false);
    }
  });
  it('decimal pressure works', () => {
    const t = T(saturationTempFromPsig(id, 100.37, 'bubble'));
    expect(t).toBeGreaterThan(T(saturationTempFromPsig(id, 100.36, 'bubble')));
  });
});

describe('PSIG vs PSIA basis (guards against the silent plausible-but-wrong error)', () => {
  it('R-134a at 0 psig is its normal boiling point (-14.9 F), not the 14.7 psia -> 0 psia confusion', () => {
    expect(T(saturationTempFromPsig('R-134a', 0, 'bubble'))).toBeCloseTo(-14.93, 1);
  });
  it('R-22 at 0 psig is about -41.4 F (normal boiling point)', () => {
    expect(T(saturationTempFromPsig('R-22', 0, 'bubble'))).toBeCloseTo(-41.4, 0);
  });
  it('R-32 at 0 psig is about -61 F (normal boiling point)', () => {
    expect(T(saturationTempFromPsig('R-32', 0, 'bubble'))).toBeCloseTo(-61.1, 0);
  });
  it('treating psig as psia would be detectably wrong', () => {
    // R-410A: 100 psig is ~ 32 F; reading the same number as psia (i.e. 85.3 psig) gives ~ 24 F, so the mix-up shifts results by several degF
    const asGauge = T(saturationTempFromPsig('R-410A', 100, 'bubble'));
    const ifPsia = T(saturationTempFromPsig('R-410A', 100 - ATMOSPHERIC_PSI, 'bubble'));
    expect(asGauge - ifPsia).toBeGreaterThan(5);
  });
  it('published-chart sanity points (typical manufacturer charts; unverified web paraphrase, +/-0.6 psi)', () => {
    expect(T(psigFromSaturationTemp('R-134a', 40, 'bubble'))).toBeCloseTo(35.0, 0);
    expect(Math.abs(T(psigFromSaturationTemp('R-410A', 40, 'bubble')) - 118.8)).toBeLessThan(0.6);
    expect(Math.abs(T(psigFromSaturationTemp('R-404A', 40, 'bubble')) - 86.9)).toBeLessThan(0.6);
    expect(Math.abs(T(psigFromSaturationTemp('R-404A', 40, 'dew')) - 85.4)).toBeLessThan(0.6);
  });
});

describe('bubble/dew distinction (swapping them must be detected)', () => {
  it('R-407C glide ~9-11 F at the same pressure', () => {
    const b = T(saturationTempFromPsig('R-407C', 70, 'bubble'));
    const d = T(saturationTempFromPsig('R-407C', 70, 'dew'));
    expect(d - b).toBeGreaterThan(8);
    expect(d - b).toBeLessThan(13);
  });
  it('R-454B glide ~2.5 F; R-404A ~1 F; pure fluids none', () => {
    expect(T(saturationTempFromPsig('R-454B', 100, 'dew')) - T(saturationTempFromPsig('R-454B', 100, 'bubble'))).toBeGreaterThan(2);
    expect(T(saturationTempFromPsig('R-404A', 100, 'dew')) - T(saturationTempFromPsig('R-404A', 100, 'bubble'))).toBeGreaterThan(0.5);
    for (const id of ['R-22', 'R-32', 'R-134a'] as RefrigerantId[]) {
      expect(T(saturationTempFromPsig(id, 80, 'dew'))).toBeCloseTo(T(saturationTempFromPsig(id, 80, 'bubble')), 6);
    }
  });
  it('dew pressure < bubble pressure at the same temperature for blends', () => {
    expect(T(psigFromSaturationTemp('R-407C', 40, 'bubble'))).toBeGreaterThan(T(psigFromSaturationTemp('R-407C', 40, 'dew')) + 10);
  });
});

describe('Superheat (uses DEW point)', () => {
  it('R-407C: 63.2 psig dew is 40 F, so a 50 F line is 10 F superheat; using bubble would give ~19 F', () => {
    const dew = T(saturationTempFromPsig('R-407C', 63.16, 'dew'));
    expect(dew).toBeCloseTo(40, 1);
    const r = calculateSuperheat({ refrigerant: 'R-407C', suctionPsig: '63.16', suctionLineTempF: '50' });
    expect(r.ok).toBe(true);
    expect(r.superheatF).toBeCloseTo(10, 1);
    const wrongBubble = 50 - T(saturationTempFromPsig('R-407C', 63.16, 'bubble'));
    expect(Math.abs(wrongBubble - (r.superheatF as number))).toBeGreaterThan(5);
  });
  it('R-410A typical: 118 psig, 52 F line', () => {
    const r = calculateSuperheat({ refrigerant: 'R-410A', suctionPsig: '118', suctionLineTempF: '52' });
    expect(r.saturationTempF).toBeCloseTo(T(saturationTempFromPsig('R-410A', 118, 'dew')), 9);
    expect(r.superheatF).toBeCloseTo(52 - (r.saturationTempF as number), 9);
  });
  it('negative superheat is reported with a note', () => {
    const r = calculateSuperheat({ refrigerant: 'R-22', suctionPsig: '68.56', suctionLineTempF: '35' });
    expect(r.superheatF as number).toBeLessThan(0);
    expect(r.note).toMatch(/liquid/i);
  });
  it('validation', () => {
    const base = { refrigerant: 'R-22' as RefrigerantId, suctionPsig: '68', suctionLineTempF: '50' };
    expect(calculateSuperheat({ ...base, suctionPsig: '' }).ok).toBe(false);
    expect(calculateSuperheat({ ...base, suctionPsig: 'abc' }).error?.message).toMatch(/number/);
    expect(calculateSuperheat({ ...base, suctionPsig: '-5' }).error?.message).toMatch(/0 psig/);
    expect(calculateSuperheat({ ...base, suctionPsig: '5000' }).error?.message).toMatch(/outside the supported range/);
    expect(calculateSuperheat({ ...base, suctionLineTempF: '' }).ok).toBe(false);
    expect(calculateSuperheat({ ...base, suctionLineTempF: '9999' }).ok).toBe(false);
  });
});

describe('Subcooling from pressure (uses BUBBLE point)', () => {
  it('R-407C: 80.24 psig bubble is 40 F; 32 F liquid line is 8 F subcooling', () => {
    const r = calculateSubcoolingFromPressure({ refrigerant: 'R-407C', liquidPsig: '80.24', liquidLineTempF: '32', targetF: '', toleranceF: '3' });
    expect(r.ok).toBe(true);
    expect(r.saturationTempF).toBeCloseTo(40, 1);
    expect(r.subcoolingF).toBeCloseTo(8, 1);
    expect(r.verdict).toBeUndefined();
    const wrongDew = T(saturationTempFromPsig('R-407C', 80.24, 'dew')) - 32;
    expect(Math.abs(wrongDew - (r.subcoolingF as number))).toBeGreaterThan(5);
  });
  it('target and tolerance (default 3 F, inclusive bounds)', () => {
    const run = (line: string) => calculateSubcoolingFromPressure({ refrigerant: 'R-22', liquidPsig: '226.4', liquidLineTempF: line, targetF: '10', toleranceF: '3' });
    const sat = run('0').saturationTempF as number;
    expect(run(String(sat - 10)).verdict).toBe('within');
    expect(run(String(sat - 13)).verdict).toBe('within');
    expect(run(String(sat - 7)).verdict).toBe('within');
    expect(run(String(sat - 6.9)).verdict).toBe('below');
    expect(run(String(sat - 13.1)).verdict).toBe('above');
    expect(VERDICT_TEXT.below).toBe('Below target range');
    expect(VERDICT_TEXT.above).toBe('Above target range');
  });
  it('validation', () => {
    const base = { refrigerant: 'R-410A' as RefrigerantId, liquidPsig: '350', liquidLineTempF: '95', targetF: '10', toleranceF: '3' };
    expect(calculateSubcoolingFromPressure(base).ok).toBe(true);
    expect(calculateSubcoolingFromPressure({ ...base, liquidPsig: '' }).ok).toBe(false);
    expect(calculateSubcoolingFromPressure({ ...base, liquidPsig: '9999' }).ok).toBe(false);
    expect(calculateSubcoolingFromPressure({ ...base, toleranceF: '-1' }).error?.message).toMatch(/negative/);
    expect(calculateSubcoolingFromPressure({ ...base, targetF: 'x' }).ok).toBe(false);
    expect(calculateSubcoolingFromPressure({ ...base, targetF: '', toleranceF: 'zzz' }).ok).toBe(true); // tolerance unused without a target
  });
});

describe('PT lookup tool', () => {
  it('pressure -> bubble and dew', () => {
    const r = lookupFromPressure('R-407C', '70');
    expect(r.ok).toBe(true);
    expect(r.dewF as number).toBeGreaterThan(r.bubbleF as number);
  });
  it('temperature -> bubble and dew pressures round-trip with the pressure lookup', () => {
    const r = lookupFromTemperature('R-454B', '45.5');
    expect(r.ok).toBe(true);
    const back = lookupFromPressure('R-454B', String(r.bubblePsig));
    expect(back.bubbleF).toBeCloseTo(45.5, 3);
  });
  it('errors are readable and never NaN', () => {
    for (const t of ['', 'x', '-3', '99999']) {
      const r = lookupFromPressure('R-32', t);
      expect(r.ok).toBe(false);
      expect(r.error?.message.length).toBeGreaterThan(5);
    }
    expect(lookupFromTemperature('R-410A', '500').ok).toBe(false);
    expect(lookupFromTemperature('R-410A', '').ok).toBe(false);
  });
  it('chart rows are in psig and cover every 5 F', () => {
    const rows = tableRows('R-410A', 5);
    expect(rows.find((r) => r.tempF === 40)!.bubblePsig).toBeCloseTo(118.8, 0);
    expect(rows.every((r) => r.tempF % 5 === 0)).toBe(true);
  });
});

describe('pinned physical-device test values (docs/PHYSICAL-TEST.md; displayed with 1 decimal)', () => {
  const f1 = (n: number | undefined) => (n as number).toFixed(1);
  it.each([
    ['R-22', '70', '41.0', '41.0'], ['R-410A', '120', '40.5', '40.7'], ['R-32', '120', '39.6', '39.6'], ['R-454B', '100', '33.7', '36.4'],
    ['R-407C', '70', '33.6', '44.5'], ['R-134a', '35', '40.0', '40.0'], ['R-404A', '100', '47.3', '48.1'], ['R-410A', '125.5', '42.9', '43.1'],
  ] as [RefrigerantId, string, string, string][])('%s %s psig -> bubble %s / dew %s', (id, p, b, d) => {
    const r = lookupFromPressure(id, p);
    expect([f1(r.bubbleF), f1(r.dewF)]).toEqual([b, d]);
  });
  it.each([
    ['R-22', '68.6', '68.6'], ['R-410A', '118.8', '118.4'], ['R-32', '121.0', '121.0'], ['R-454B', '113.2', '107.5'],
    ['R-407C', '80.2', '63.2'], ['R-134a', '35.0', '35.0'], ['R-404A', '86.9', '85.4'],
  ] as [RefrigerantId, string, string][])('%s 40 F -> bubble %s / dew %s psig', (id, b, d) => {
    const r = lookupFromTemperature(id, '40');
    expect([f1(r.bubblePsig), f1(r.dewPsig)]).toEqual([b, d]);
  });
  it('superheat and subcooling examples', () => {
    const sh = (id: RefrigerantId, p: string, t: string) => f1(calculateSuperheat({ refrigerant: id, suctionPsig: p, suctionLineTempF: t }).superheatF);
    expect([sh('R-410A', '118', '52'), sh('R-407C', '63', '50'), sh('R-22', '68.5', '55'), sh('R-454B', '107.5', '50')]).toEqual(['12.2', '10.1', '15.0', '10.0']);
    const sc = (id: RefrigerantId, p: string, t: string) => f1(calculateSubcoolingFromPressure({ refrigerant: id, liquidPsig: p, liquidLineTempF: t, targetF: '10', toleranceF: '3' }).subcoolingF);
    expect([sc('R-410A', '350', '95'), sc('R-407C', '250', '95'), sc('R-22', '226', '100'), sc('R-454B', '330', '98')]).toEqual(['11.7', '12.2', '9.9', '8.0']);
  });
});
