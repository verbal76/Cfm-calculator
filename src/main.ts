import './style.css';
import { calculateCfm, type CalcError } from './calc';
import { mountPicker, onRefrigerantChange, selectedRefrigerant } from './picker';
import { DATASET_ID, getRefrigerant, listRefrigerants, tableRows } from './refrigerant/engine';
import { startDomSplash } from './splash';
import {
  calculateSubcoolingFromPressure, calculateSuperheat, lookupFromPressure, lookupFromTemperature,
  SUBCOOL_TOLERANCE_DEFAULT, VERDICT_TEXT, type FieldError,
} from './refrigerant/superheatSubcool';
import { APP_NAME, formatDiagnostics, loadNativeInfo, publicVersionLabel, sourceInfo, type NativeInfo } from './buildinfo';

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

const fmtF = (n: number) => `${n.toFixed(1)}°F`;
const fmtP = (n: number) => `${n.toFixed(1)} psig`;
function showFieldError(id: string, e?: FieldError) { const el = $(id); el.hidden = !e; el.textContent = e ? e.message : ''; }
function showNote(id: string, text?: string) { const el = $(id); el.hidden = !text; el.textContent = text ?? ''; }
const row = (label: string, value: string) => `<dt>${label}</dt><dd>${value}</dd>`;

// ---- Subcooling (bubble point at liquid pressure)
function clearSubcoolResults() {
  $('sc-results').hidden = true; set('sc-actual'); set('sc-verdict'); showFieldError('sc-error'); showNote('sc-note');
}
function runSubcool() {
  clearSubcoolResults();
  const r = calculateSubcoolingFromPressure({
    refrigerant: selectedRefrigerant(), liquidPsig: val('sc-psig'), liquidLineTempF: val('sc-temp'), targetF: val('sc-target'), toleranceF: val('sc-tol'),
  });
  if (!r.ok) { showFieldError('sc-error', r.error); return; }
  const glide = getRefrigerant(r.refrigerant!).hasGlide;
  set('sc-r-ref', r.refrigerant); set('sc-r-psig', fmtP(r.liquidPsig!));
  $('sc-r-sat-label').textContent = glide ? 'Saturation temp (bubble point)' : 'Saturation temp';
  set('sc-r-sat', fmtF(r.saturationTempF!)); set('sc-r-line', fmtF(r.liquidLineTempF!));
  $('sc-results').hidden = false;
  set('sc-actual', fmtF(r.subcoolingF!));
  if (r.verdict) set('sc-verdict', `${VERDICT_TEXT[r.verdict]} (${r.low!.toFixed(1)} to ${r.high!.toFixed(1)}°F)`);
  showNote('sc-note', r.note);
}
function clearSubcool() {
  ['sc-psig', 'sc-temp', 'sc-target'].forEach((id) => set(id));
  set('sc-tol', SUBCOOL_TOLERANCE_DEFAULT);
  clearSubcoolResults();
}

// ---- Superheat (dew point at suction pressure)
function clearSuperheatResults() { $('sh-results').hidden = true; set('sh-actual'); showFieldError('sh-error'); showNote('sh-note'); }
function runSuperheat() {
  clearSuperheatResults();
  const r = calculateSuperheat({ refrigerant: selectedRefrigerant(), suctionPsig: val('sh-psig'), suctionLineTempF: val('sh-temp') });
  if (!r.ok) { showFieldError('sh-error', r.error); return; }
  set('sh-r-ref', r.refrigerant); set('sh-r-psig', fmtP(r.suctionPsig!));
  set('sh-r-sat', fmtF(r.saturationTempF!)); set('sh-r-line', fmtF(r.suctionLineTempF!));
  $('sh-results').hidden = false;
  set('sh-actual', fmtF(r.superheatF!));
  showNote('sh-note', r.note);
}
function clearSuperheat() { ['sh-psig', 'sh-temp'].forEach((id) => set(id)); clearSuperheatResults(); }

// ---- Refrigerant PT
function renderPt() {
  const id = selectedRefrigerant();
  const info = getRefrigerant(id);
  const p = val('pt-psig').trim();
  const pr = $('pt-p-results');
  if (p === '') { pr.innerHTML = ''; showFieldError('pt-p-error'); } else {
    const r = lookupFromPressure(id, p);
    showFieldError('pt-p-error', r.ok ? undefined : r.error);
    pr.innerHTML = !r.ok ? '' : info.hasGlide
      ? row('Bubble (liquid)', fmtF(r.bubbleF!)) + row('Dew (vapor)', fmtF(r.dewF!))
      : row('Saturation temp', fmtF(r.bubbleF!));
  }
  const t = val('pt-temp').trim();
  const tr = $('pt-t-results');
  if (t === '') { tr.innerHTML = ''; showFieldError('pt-t-error'); } else {
    const r = lookupFromTemperature(id, t);
    showFieldError('pt-t-error', r.ok ? undefined : r.error);
    tr.innerHTML = !r.ok ? '' : info.hasGlide
      ? row('Bubble (liquid)', fmtP(r.bubblePsig!)) + row('Dew (vapor)', fmtP(r.dewPsig!))
      : row('Saturation pressure', fmtP(r.bubblePsig!));
  }
  const notes = [`${id}: pressures are gauge (psig); ${info.hasGlide ? 'superheat uses dew, subcooling uses bubble.' : 'single saturation curve.'}`];
  if (id === 'R-454B') notes.push('R-454B is modelled from R-32/R-1234yf; verify against the manufacturer chart.');
  set('pt-note', notes.join(' '));
  const header = info.hasGlide ? '<tr><th>°F</th><th>Bubble psig</th><th>Dew psig</th></tr>' : '<tr><th>°F</th><th>psig</th></tr>';
  $('pt-chart').innerHTML = header + tableRows(id, 5).map((r) =>
    info.hasGlide ? `<tr><td>${r.tempF}</td><td>${r.bubblePsig.toFixed(1)}</td><td>${r.dewPsig.toFixed(1)}</td></tr>`
      : `<tr><td>${r.tempF}</td><td>${r.bubblePsig.toFixed(1)}</td></tr>`).join('');
}

// ---- About
let native: NativeInfo | null = null;
async function renderAbout() {
  native ??= await loadNativeInfo();
  const src = sourceInfo();
  $('about-version').textContent = native ? `Version ${publicVersionLabel(native.versionCode, native.versionName)}` : 'Version unavailable';
  $('about-tech').textContent = [
    `Version: ${publicVersionLabel(native?.versionCode, native?.versionName)}`,
    `Package: ${native?.packageName ?? 'unavailable'}`,
    `Android versionCode: ${native?.versionCode ?? 'unavailable'}`,
    `Source commit: ${src.sha}`, `Source branch: ${src.branch}`, `Built: ${src.builtAt}`,
    `Android: ${native ? `${native.androidRelease} (API ${native.androidApi})` : 'unavailable'}`,
    `Target SDK: ${native?.targetSdk ?? 'unavailable'}`,
    `Build type: ${native?.buildType ?? 'unavailable'}`,
    `Refrigerant dataset: ${DATASET_ID}`,
  ].join('\n');
  $('about-dataset').textContent = `Refrigerant PT dataset: ${DATASET_ID}`;
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
const SCREENS = ['cfm', 'menu', 'subcool', 'superheat', 'pt', 'about'];
function route() {
  const name = SCREENS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'menu';
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach((s) => { s.hidden = s.id !== `screen-${name}`; });
  document.title = APP_NAME;
  window.scrollTo(0, 0);
  if (name === 'about') void renderAbout();
  if (name === 'pt') renderPt();
}

$('cfm-calc').addEventListener('click', runCfm);
$('cfm-clear').addEventListener('click', clearCfm);
$('sc-calc').addEventListener('click', runSubcool);
$('sc-clear').addEventListener('click', clearSubcool);
$('sh-calc').addEventListener('click', runSuperheat);
$('sh-clear').addEventListener('click', clearSuperheat);
['pt-psig', 'pt-temp'].forEach((id) => $(id).addEventListener('input', renderPt));
document.querySelectorAll<HTMLElement>('[data-picker]').forEach(mountPicker);
// A different refrigerant invalidates displayed results.
onRefrigerantChange(() => { clearSubcoolResults(); clearSuperheatResults(); renderPt(); });
$('copy-diag').addEventListener('click', () => void copyDiagnostics());
window.addEventListener('hashchange', route);
route();

// ---- Start-up: the studio card (src/splash.ts) is shown on cold launch; this work runs behind it, so it adds no waiting time.
async function initApp() {
  listRefrigerants();           // parse/index the bundled PT dataset now
  native = await loadNativeInfo(); // warm the native bridge; About/diagnostics reuse the result
}
void startDomSplash(initApp);
