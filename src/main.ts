import './style.css';
import {
  calculateCfm, calculateSubcool, SUBCOOL_DEFAULT_TOLERANCE, type CalcError,
} from './calc';
import { APP_NAME, formatDiagnostics, loadNativeInfo, sourceInfo, type NativeInfo } from './buildinfo';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => $<HTMLInputElement>(id).value;
const set = (id: string, v = '') => { const e = $(id); if (e instanceof HTMLInputElement) e.value = v; else e.textContent = v; };

function describe(e: CalcError): string {
  return e.kind === 'DIVISION_BY_ZERO'
    ? 'Division by zero. Check that Delta T, specific heat and tonnage are not zero.'
    : 'Enter a number in every field.';
}
function showError(id: string, e?: CalcError) {
  const el = $(id);
  el.hidden = !e;
  el.textContent = e ? describe(e) : '';
}

// ---- CFM
function runCfm() {
  const r = calculateCfm({ btuh: val('btuh'), deltaT: val('deltat'), specificHeat: val('spec'), tonnage: val('tons') });
  set('cfm-total', r.totalCfm ?? '');
  set('cfm-per-ton', r.cfmPerTon ?? '');
  showError('cfm-error', r.error);
}
function clearCfm() {
  ['btuh', 'deltat', 'spec', 'tons', 'cfm-total', 'cfm-per-ton'].forEach((id) => set(id));
  showError('cfm-error');
}

// ---- Subcool
function runSubcool() {
  const r = calculateSubcool({ target: val('sc-target'), liquidLineTemp: val('sc-liq'), liquidSatTemp: val('sc-sat'), tolerance: val('sc-tol') });
  set('sc-actual', r.actualSubcooling ?? '');
  set('sc-range', r.correctLow !== undefined && r.correctHigh !== undefined ? `${r.correctLow} to ${r.correctHigh}` : '');
  set('sc-verdict', r.verdict ?? '');
  showError('sc-error', r.error);
}
function clearSubcool() {
  ['sc-target', 'sc-liq', 'sc-sat', 'sc-actual', 'sc-range', 'sc-verdict'].forEach((id) => set(id));
  set('sc-tol', SUBCOOL_DEFAULT_TOLERANCE);
  showError('sc-error');
}

// ---- About
let native: NativeInfo | null = null;
async function renderAbout() {
  native ??= await loadNativeInfo();
  const src = sourceInfo();
  $('about-version').textContent = native ? `Version ${native.versionName} (build ${native.versionCode})` : 'Version unavailable';
  $('about-tech').textContent = [
    `Package: ${native?.packageName ?? 'unavailable'}`,
    `Source SHA: ${src.sha}`, `Source branch: ${src.branch}`, `Built: ${src.builtAt}`,
    `Android: ${native ? `${native.androidRelease} (API ${native.androidApi})` : 'unavailable'}`,
    `Target SDK: ${native?.targetSdk ?? 'unavailable'}`,
    `Build type: ${native?.buildType ?? 'unavailable'}`,
  ].join('\n');
}
async function copyDiagnostics() {
  native ??= await loadNativeInfo();
  const text = formatDiagnostics(native);
  const status = $('copy-status');
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = 'Diagnostics copied.';
  } catch {
    // Fallback: show the text so it can be selected and copied manually.
    $('about-tech').textContent = text;
    ($('about-tech').closest('details') as HTMLDetailsElement).open = true;
    status.textContent = 'Could not access the clipboard. Diagnostics are shown below; select and copy them.';
  }
}

// ---- Navigation: hash routes so the Android back button steps through screens.
const SCREENS = ['cfm', 'menu', 'subcool', 'superheat', 'about'];
function route() {
  const name = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'cfm';
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  document.title = APP_NAME;
  window.scrollTo(0, 0);
  if (name === 'about') void renderAbout();
}

$('cfm-calc').addEventListener('click', runCfm);
$('cfm-clear').addEventListener('click', clearCfm);
$('sc-calc').addEventListener('click', runSubcool);
$('sc-clear').addEventListener('click', clearSubcool);
$('copy-diag').addEventListener('click', () => void copyDiagnostics());
window.addEventListener('hashchange', route);
route();
