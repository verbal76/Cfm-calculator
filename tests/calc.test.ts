import { describe, expect, it } from 'vitest';
import {
  calculateCfm, calculateSubcool, formatNumber, parseNumber,
  SUBCOOL_ADD, SUBCOOL_OK, SUBCOOL_RECOVER,
} from '../src/calc';

/**
 * Characterization fixtures. Expected values are derived by hand from the legacy
 * formulas recovered from the v3.0 APK bytecode (not captured from a running old APK).
 */
describe('parse/format', () => {
  it('parses App Inventor style decimals', () => {
    expect(parseNumber('1.08')).toBe(1.08);
    expect(parseNumber(' .5 ')).toBe(0.5);
    expect(parseNumber('-3')).toBe(-3);
    expect(parseNumber('5.')).toBe(5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1/2')).toBeNull();
  });
  it('formats whole numbers without .0 and does not round', () => {
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(0.1 + 0.2)).toBe('0.30000000000000004');
    expect(formatNumber(2000 / 3)).toBe('666.6666666666666');
    expect(formatNumber(1e-7)).not.toMatch(/e/i);
  });
});

describe('CFM (Screen1)', () => {
  it('80000 BTUH, dT 50, 1.08, 4 ton', () => {
    const r = calculateCfm({ btuh: '80000', deltaT: '50', specificHeat: '1.08', tonnage: '4' });
    expect(r.multiplier).toBe('54');
    expect(r.totalCfm).toBe(String(80000 / 54));
    expect(r.cfmPerTon).toBe(String(80000 / 54 / 4));
  });
  it('whole-number result', () => {
    const r = calculateCfm({ btuh: '108000', deltaT: '50', specificHeat: '1.08', tonnage: '3' });
    expect(r.multiplier).toBe('54');
    expect(r.totalCfm).toBe('2000');
    expect(r.cfmPerTon).toBe(formatNumber(2000 / 3));
  });
  it('zero btuh gives zero', () => {
    const r = calculateCfm({ btuh: '0', deltaT: '40', specificHeat: '1.08', tonnage: '2' });
    expect(r.totalCfm).toBe('0');
    expect(r.cfmPerTon).toBe('0');
  });
  it('division by zero keeps earlier outputs (legacy partial write)', () => {
    const r = calculateCfm({ btuh: '1000', deltaT: '0', specificHeat: '1.08', tonnage: '3' });
    expect(r.error).toEqual({ kind: 'DIVISION_BY_ZERO' });
    expect(r.multiplier).toBe('0');
    expect(r.totalCfm).toBeUndefined();
    const t = calculateCfm({ btuh: '1000', deltaT: '40', specificHeat: '1.08', tonnage: '0' });
    expect(t.error).toEqual({ kind: 'DIVISION_BY_ZERO' });
    expect(t.totalCfm).toBe(formatNumber(1000 / 43.2));
    expect(t.cfmPerTon).toBeUndefined();
  });
  it('empty / invalid input is an error, not NaN', () => {
    expect(calculateCfm({ btuh: '', deltaT: '40', specificHeat: '1.08', tonnage: '3' }).error?.kind).toBe('NOT_A_NUMBER');
    expect(calculateCfm({ btuh: '1', deltaT: '', specificHeat: '1.08', tonnage: '3' }).error?.kind).toBe('NOT_A_NUMBER');
    expect(calculateCfm({ btuh: '1', deltaT: '4', specificHeat: 'x', tonnage: '3' }).multiplier).toBeUndefined();
  });
  it('large values', () => {
    const r = calculateCfm({ btuh: '1e9', deltaT: '1', specificHeat: '1', tonnage: '1' });
    expect(r.totalCfm).toBe('1000000000');
  });
});

describe('Subcooling (Subcool screen)', () => {
  const base = { target: '10', liquidLineTemp: '90', tolerance: '3' };
  it('within range at boundaries (inclusive)', () => {
    expect(calculateSubcool({ ...base, liquidSatTemp: '100' }).verdict).toBe(SUBCOOL_OK);
    expect(calculateSubcool({ ...base, liquidSatTemp: '103' }).verdict).toBe(SUBCOOL_OK);
    expect(calculateSubcool({ ...base, liquidSatTemp: '97' }).verdict).toBe(SUBCOOL_OK);
  });
  it('low subcooling -> add refrigerant', () => {
    const r = calculateSubcool({ ...base, liquidSatTemp: '96' });
    expect(r.actualSubcooling).toBe('6');
    expect(r.correctLow).toBe('7');
    expect(r.correctHigh).toBe('13');
    expect(r.verdict).toBe(SUBCOOL_ADD);
  });
  it('high subcooling -> recover refrigerant (trailing space preserved)', () => {
    const r = calculateSubcool({ ...base, liquidSatTemp: '104' });
    expect(r.verdict).toBe(SUBCOOL_RECOVER);
    expect(r.verdict).toBe('Recover refrigerant ');
  });
  it('decimals and negatives', () => {
    const r = calculateSubcool({ target: '10.5', liquidLineTemp: '89.5', liquidSatTemp: '100', tolerance: '0.5' });
    expect(r.actualSubcooling).toBe('10.5');
    expect(r.verdict).toBe(SUBCOOL_OK);
    expect(calculateSubcool({ target: '5', liquidLineTemp: '100', liquidSatTemp: '90', tolerance: '3' }).verdict).toBe(SUBCOOL_ADD);
  });
  it('errors', () => {
    expect(calculateSubcool({ ...base, liquidSatTemp: '' }).error?.kind).toBe('NOT_A_NUMBER');
    const r = calculateSubcool({ target: '', liquidLineTemp: '90', liquidSatTemp: '100', tolerance: '3' });
    expect(r.actualSubcooling).toBe('10');
    expect(r.error?.kind).toBe('NOT_A_NUMBER');
    expect(r.verdict).toBeUndefined();
  });
});
