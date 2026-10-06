/**
 * Refrigerant-aware Superheat and Subcooling.
 *
 *   Superheat  = measured suction-line temp  - DEW    saturation temp at suction pressure
 *   Subcooling = BUBBLE saturation temp at liquid-line pressure - measured liquid-line temp
 *
 * (Dew point for superheat, bubble point for subcooling: the standard convention for zeotropic blends; see docs/REFRIGERANT-DATA.md.)
 */
import { psigFromSaturationTemp, saturationTempFromPsig, type RefrigerantId } from './engine';

/** Engine errors are generic (the table includes vacuum); the app only accepts gauge pressure >= 0. */
function rangeMessage(id: string, psig: number, e: { kind: string; message: string; min?: number; max?: number }): string {
  if (e.kind !== 'OUT_OF_RANGE' || e.max === undefined || e.min === undefined) return e.message;
  const lo = Math.max(0, Math.ceil(e.min * 10) / 10), hi = Math.floor(e.max * 10) / 10;
  return `${Math.round(psig * 10) / 10} psig is outside the supported range for ${id} (${lo} to ${hi} psig).`;
}

export interface FieldError { field: string; message: string }

const TEMP_MIN_F = -100, TEMP_MAX_F = 400;

export function parseField(text: string, label: string): { ok: true; value: number } | { ok: false; error: FieldError } {
  const t = text.trim();
  if (t === '') return { ok: false, error: { field: label, message: `Enter ${label}.` } };
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return { ok: false, error: { field: label, message: `${label} must be a number.` } };
  const v = Number(t);
  if (!Number.isFinite(v)) return { ok: false, error: { field: label, message: `${label} must be a number.` } };
  return { ok: true, value: v };
}

/** Gauge pressure input: must be >= 0 psig (vacuum readings are not supported). */
function pressureField(text: string, label: string) {
  const p = parseField(text, label);
  if (!p.ok) return p;
  if (p.value < 0) return { ok: false as const, error: { field: label, message: `Enter ${label} at or above 0 psig (vacuum readings are not supported).` } };
  return p;
}

function tempField(text: string, label: string) {
  const p = parseField(text, label);
  if (!p.ok) return p;
  if (p.value < TEMP_MIN_F || p.value > TEMP_MAX_F) {
    return { ok: false as const, error: { field: label, message: `${label} (${p.value}°F) is not a realistic line temperature.` } };
  }
  return p;
}

export interface SuperheatInput { refrigerant: RefrigerantId; suctionPsig: string; suctionLineTempF: string }
export interface SuperheatResult {
  ok: boolean;
  error?: FieldError;
  refrigerant?: RefrigerantId;
  suctionPsig?: number;
  saturationTempF?: number;
  suctionLineTempF?: number;
  superheatF?: number;
  /** Informational, e.g. negative superheat means liquid present at the measurement point */
  note?: string;
}

export function calculateSuperheat(i: SuperheatInput): SuperheatResult {
  const p = pressureField(i.suctionPsig, 'suction pressure (psig)');
  if (!p.ok) return { ok: false, error: p.error };
  const t = tempField(i.suctionLineTempF, 'suction-line temperature');
  if (!t.ok) return { ok: false, error: t.error };
  const sat = saturationTempFromPsig(i.refrigerant, p.value, 'dew');
  if (!sat.ok) return { ok: false, error: { field: 'suction pressure (psig)', message: rangeMessage(i.refrigerant, p.value, sat.error) } };
  const sh = t.value - sat.value;
  return {
    ok: true, refrigerant: i.refrigerant, suctionPsig: p.value, saturationTempF: sat.value, suctionLineTempF: t.value, superheatF: sh,
    note: sh < 0 ? 'Negative superheat: the line is colder than the dew point, so liquid refrigerant may be present. Re-check the readings.' : undefined,
  };
}

export const SUBCOOL_TOLERANCE_DEFAULT = '3';
export type SubcoolVerdict = 'below' | 'within' | 'above';

export interface SubcoolInput {
  refrigerant: RefrigerantId;
  liquidPsig: string;
  liquidLineTempF: string;
  /** optional; blank = no comparison */
  targetF: string;
  toleranceF: string;
}
export interface SubcoolResult {
  ok: boolean;
  error?: FieldError;
  refrigerant?: RefrigerantId;
  liquidPsig?: number;
  saturationTempF?: number;
  liquidLineTempF?: number;
  subcoolingF?: number;
  low?: number;
  high?: number;
  verdict?: SubcoolVerdict;
  note?: string;
}

export function calculateSubcoolingFromPressure(i: SubcoolInput): SubcoolResult {
  const p = pressureField(i.liquidPsig, 'liquid pressure (psig)');
  if (!p.ok) return { ok: false, error: p.error };
  const t = tempField(i.liquidLineTempF, 'liquid-line temperature');
  if (!t.ok) return { ok: false, error: t.error };
  const sat = saturationTempFromPsig(i.refrigerant, p.value, 'bubble');
  if (!sat.ok) return { ok: false, error: { field: 'liquid pressure (psig)', message: rangeMessage(i.refrigerant, p.value, sat.error) } };
  const sc = sat.value - t.value;
  const r: SubcoolResult = {
    ok: true, refrigerant: i.refrigerant, liquidPsig: p.value, saturationTempF: sat.value, liquidLineTempF: t.value, subcoolingF: sc,
  };
  if (sc < 0) r.note = 'Negative subcooling: the line is warmer than the bubble point, so the refrigerant is not fully liquid at the measurement point. Re-check the readings.';
  if (i.targetF.trim() !== '') {
    const target = parseField(i.targetF, 'target subcooling');
    if (!target.ok) return { ok: false, error: target.error };
    const tol = parseField(i.toleranceF, 'tolerance');
    if (!tol.ok) return { ok: false, error: tol.error };
    if (tol.value < 0) return { ok: false, error: { field: 'tolerance', message: 'Tolerance cannot be negative.' } };
    r.low = target.value - tol.value;
    r.high = target.value + tol.value;
    r.verdict = sc < r.low ? 'below' : sc > r.high ? 'above' : 'within';
  }
  return r;
}

export const VERDICT_TEXT: Record<SubcoolVerdict, string> = {
  below: 'Below target range',
  within: 'Within target range',
  above: 'Above target range',
};

// ---------------- PT lookup (standalone tool)
export interface PtFromPressure {
  ok: boolean; error?: FieldError;
  bubbleF?: number; dewF?: number; psig?: number;
}
export function lookupFromPressure(id: RefrigerantId, psigText: string): PtFromPressure {
  const p = pressureField(psigText, 'pressure (psig)');
  if (!p.ok) return { ok: false, error: p.error };
  const b = saturationTempFromPsig(id, p.value, 'bubble');
  const d = saturationTempFromPsig(id, p.value, 'dew');
  if (!b.ok) return { ok: false, error: { field: 'pressure (psig)', message: rangeMessage(id, p.value, b.error) } };
  if (!d.ok) return { ok: false, error: { field: 'pressure (psig)', message: rangeMessage(id, p.value, d.error) } };
  return { ok: true, psig: p.value, bubbleF: b.value, dewF: d.value };
}

export interface PtFromTemp {
  ok: boolean; error?: FieldError;
  bubblePsig?: number; dewPsig?: number; tempF?: number;
}
export function lookupFromTemperature(id: RefrigerantId, tempText: string): PtFromTemp {
  const t = parseField(tempText, 'temperature (°F)');
  if (!t.ok) return { ok: false, error: t.error };
  const b = psigFromSaturationTemp(id, t.value, 'bubble');
  const d = psigFromSaturationTemp(id, t.value, 'dew');
  if (!b.ok) return { ok: false, error: { field: 'temperature (°F)', message: b.error.message } };
  if (!d.ok) return { ok: false, error: { field: 'temperature (°F)', message: d.error.message } };
  return { ok: true, tempF: t.value, bubblePsig: b.value, dewPsig: d.value };
}
