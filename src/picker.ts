/** ONE reusable refrigerant picker. Every screen mounts the same component; selection is shared and remembered. */
import { getRefrigerant, listRefrigerants, type RefrigerantId } from './refrigerant/engine';

const STORE_KEY = 'cfm.refrigerant';
const DEFAULT_ID: RefrigerantId = 'R-410A';
const ids = listRefrigerants().map((r) => r.id);

function load(): RefrigerantId {
  try {
    const v = localStorage.getItem(STORE_KEY) as RefrigerantId | null;
    if (v && ids.includes(v)) return v;
  } catch { /* storage unavailable: fall back to the default */ }
  return DEFAULT_ID;
}

let selected: RefrigerantId = load();
const listeners = new Set<(id: RefrigerantId) => void>();

export const selectedRefrigerant = () => selected;

export function setRefrigerant(id: RefrigerantId) {
  if (id === selected) return;
  selected = id;
  try { localStorage.setItem(STORE_KEY, id); } catch { /* ignore */ }
  listeners.forEach((l) => l(id));
}

export function onRefrigerantChange(fn: (id: RefrigerantId) => void) { listeners.add(fn); }

function infoText(id: RefrigerantId): string {
  const r = getRefrigerant(id);
  const parts = [r.composition, `ASHRAE 34 class ${r.ashrae34}`];
  if (r.hasGlide) parts.push(`temperature glide ≈ ${r.glideF40.toFixed(1)}°F at 40°F: bubble and dew differ`);
  return parts.join(' · ');
}

export function mountPicker(host: HTMLElement) {
  host.classList.add('picker');
  host.innerHTML = '<span class="picker-label" id="picker-label">Refrigerant</span><div class="chips" role="radiogroup" aria-label="Refrigerant"></div><p class="note picker-info"></p>';
  const chips = host.querySelector('.chips') as HTMLElement;
  const info = host.querySelector('.picker-info') as HTMLElement;
  for (const id of ids) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = id;
    b.dataset.id = id;
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => setRefrigerant(id));
    chips.appendChild(b);
  }
  const render = () => {
    chips.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === selected)));
    info.textContent = infoText(selected);
  };
  onRefrigerantChange(render);
  render();
}
