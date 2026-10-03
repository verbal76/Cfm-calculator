/**
 * Calculation logic ported 1:1 from the legacy App Inventor app
 * (appinventor.ai_verbalgamer.Gas_CFM_calc v3.0), recovered from the Kawa/YAIL
 * bytecode of Screen1.calculate$Click and Subcool.Calculate$Click.
 * See docs/LEGACY-ANALYSIS.md. Do not "fix" formulas here without owner sign-off.
 */

export type CalcError =
  | { kind: 'NOT_A_NUMBER'; op: string }
  | { kind: 'DIVISION_BY_ZERO' };

/** App Inventor padded-string->number: decimal numbers only (no fractions/radix). */
export function parseNumber(text: string): number | null {
  const t = text.trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** App Inventor appinventor-number->string: whole values print without ".0", no rounding. */
export function formatNumber(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e21) return String(n);
  const s = String(n);
  if (!/e/i.test(s)) return s;
  // expand exponent form into plain decimal
  return n.toFixed(20).replace(/\.?0+$/, '');
}

type Num = { ok: true; value: number } | { ok: false; error: CalcError };

function operand(text: string, op: string): Num {
  const v = parseNumber(text);
  return v === null ? { ok: false, error: { kind: 'NOT_A_NUMBER', op } } : { ok: true, value: v };
}

function divide(a: number, b: number): Num {
  if (b === 0) return { ok: false, error: { kind: 'DIVISION_BY_ZERO' } };
  return { ok: true, value: a / b };
}

export interface CfmInputs {
  btuh: string;
  deltaT: string;
  specificHeat: string;
  tonnage: string;
}
export interface CfmResult {
  /** deltaT * specificHeat (hidden "multiplypart" field in the legacy app) */
  multiplier?: string;
  totalCfm?: string;
  cfmPerTon?: string;
  error?: CalcError;
}

/**
 * Legacy order: multiplier = deltaT * specificHeat; totalCfm = btuh / multiplier;
 * cfmPerTon = totalCfm / tonnage. Each output was written as soon as computed, so a
 * later failure leaves earlier outputs populated (partial result preserved).
 */
export function calculateCfm(i: CfmInputs): CfmResult {
  const r: CfmResult = {};
  const dt = operand(i.deltaT, '*');
  const sh = operand(i.specificHeat, '*');
  if (!dt.ok) return { ...r, error: dt.error };
  if (!sh.ok) return { ...r, error: sh.error };
  const mult = dt.value * sh.value;
  r.multiplier = formatNumber(mult);

  const btuh = operand(i.btuh, '/');
  if (!btuh.ok) return { ...r, error: btuh.error };
  const total = divide(btuh.value, mult);
  if (!total.ok) return { ...r, error: total.error };
  r.totalCfm = formatNumber(total.value);

  const tons = operand(i.tonnage, '/');
  if (!tons.ok) return { ...r, error: tons.error };
  const per = divide(total.value, tons.value);
  if (!per.ok) return { ...r, error: per.error };
  r.cfmPerTon = formatNumber(per.value);
  return r;
}

export const SUBCOOL_DEFAULT_TOLERANCE = '3';
export const SUBCOOL_ADD = 'Add Refrigerant';
export const SUBCOOL_RECOVER = 'Recover refrigerant ';
export const SUBCOOL_OK = 'Charge is within Range';

export interface SubcoolInputs {
  target: string;
  liquidLineTemp: string;
  liquidSatTemp: string;
  tolerance: string;
}
export interface SubcoolResult {
  targetSubcooling?: string;
  actualSubcooling?: string;
  correctHigh?: string;
  correctLow?: string;
  verdict?: string;
  error?: CalcError;
}

/** Actual subcooling = liquid saturation temp - liquid line temp; compared to target +/- tolerance. */
export function calculateSubcool(i: SubcoolInputs): SubcoolResult {
  const r: SubcoolResult = { targetSubcooling: i.target };
  const sat = operand(i.liquidSatTemp, '-');
  const liq = operand(i.liquidLineTemp, '-');
  if (!sat.ok) return { ...r, error: sat.error };
  if (!liq.ok) return { ...r, error: liq.error };
  const actual = sat.value - liq.value;
  r.actualSubcooling = formatNumber(actual);

  const target = operand(i.target, '+');
  const tol = operand(i.tolerance, '+');
  if (!target.ok) return { ...r, error: target.error };
  if (!tol.ok) return { ...r, error: tol.error };
  const high = target.value + tol.value;
  r.correctHigh = formatNumber(high);
  const low = target.value - tol.value;
  r.correctLow = formatNumber(low);

  if (actual < low) r.verdict = SUBCOOL_ADD;
  else if (actual > high) r.verdict = SUBCOOL_RECOVER;
  else r.verdict = SUBCOOL_OK;
  return r;
}
