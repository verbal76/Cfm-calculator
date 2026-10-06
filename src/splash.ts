/**
 * Hot Attic Games studio splash (standing studio requirement; see CLAUDE.md).
 *
 * Artwork: Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png (repo root, owner-supplied canonical file) - shown exactly as supplied,
 * aspect ratio preserved (object-fit: contain), transparency preserved.
 *
 * Cold launch order:  native splash (plain background frame, no icon)
 *                     -> studio card (this module, driven by <html data-splash="...">; markup/CSS live in index.html + style.css)
 *                     -> the product's own opening (the Main Menu titled "Verbal's CFM Calculator")
 *
 * This file holds only the timeline so it can be unit-tested without a DOM. App initialisation runs behind the card.
 */

export type SplashPhase = 'prep' | 'in' | 'hold' | 'out' | 'done';

export const SPLASH = {
  /** logo fades in (CSS transition must match) */
  fadeInMs: 400,
  /** time the logo is fully visible, nominal */
  holdMs: 1700,
  /** card fades out into the app (CSS transition must match) */
  fadeOutMs: 400,
  /** absolute ceiling for the card's total display time (fade-in start to fade-out end) */
  hardCapMs: 3000,
  /** how long to wait for the artwork to decode before giving up and skipping the card. The card is a studio requirement, so this is
   *  generous: a slow cold start (low-end phone, software rendering) must delay the card, never silently skip it. */
  imageWaitMs: 2500,
  /** ceiling for the pre-rasterise step (two animation frames normally take ~30 ms) */
  prepareMaxMs: 600,
} as const;

/** Nominal total display time: 2.5 s. */
export const nominalDurationMs = (c = SPLASH) => c.fadeInMs + c.holdMs + c.fadeOutMs;

export interface SplashView {
  setPhase(phase: SplashPhase): void;
  /** resolves true when the artwork is decoded and can be shown, false if it cannot be shown */
  imageReady(): Promise<boolean>;
  /**
   * Paint the artwork at (near) zero opacity and wait for the frames that rasterise and upload it, so the first visible frame of
   * the fade-in is not delayed by first-paint work. The card's visible clock starts only after this resolves.
   */
  prepare(): Promise<void>;
}

export interface Timers {
  now(): number;
  wait(ms: number): Promise<void>;
}

export type SplashOutcome =
  | { reason: 'shown'; totalMs: number; initOk: boolean; initWaitedMs: number }
  | { reason: 'image-unavailable'; totalMs: number };

/** The splash is a COLD-LAUNCH card: once shown in this WebView session it is never replayed (reloads, resume, in-app navigation). */
export function shouldShowSplash(alreadyShownThisSession: boolean): boolean {
  return !alreadyShownThisSession;
}

// A zero-delay timer is clamped to >= 1 ms by JS runtimes, which would overshoot the hard cap: skip no-op waits.
const settle = (ms: number, timers: Timers) => (ms > 0 ? timers.wait(ms) : Promise.resolve());

/**
 * Runs the card. `init` is the app's start-up work, which proceeds concurrently behind the card (it never adds waiting time):
 *  - normal:      card visible for 2.5 s total
 *  - slow init:   hold is extended until init finishes, but never past the 3.0 s hard cap
 *  - init error:  swallowed; timeline continues normally (the user is never stranded)
 *  - bad artwork: card is skipped at once instead of showing an empty frame
 */
export async function runSplashTimeline(view: SplashView, init: () => Promise<unknown>, timers: Timers, cfg = SPLASH): Promise<SplashOutcome> {
  const t0 = timers.now();
  const state: { doneAt: number | null; ok: boolean } = { doneAt: null, ok: true };
  const initPromise = Promise.resolve()
    .then(init)
    .catch(() => { state.ok = false; })
    .then(() => { state.doneAt = timers.now(); });

  const ready = await Promise.race([view.imageReady().catch(() => false), settle(cfg.imageWaitMs, timers).then(() => false)]);
  if (!ready) {
    await Promise.race([initPromise, settle(cfg.hardCapMs - cfg.fadeOutMs, timers)]);
    view.setPhase('out');
    await settle(cfg.fadeOutMs, timers);
    view.setPhase('done');
    return { reason: 'image-unavailable', totalMs: timers.now() - t0 };
  }

  await Promise.race([view.prepare().catch(() => undefined), settle(cfg.prepareMaxMs, timers)]);

  const tIn = timers.now();
  view.setPhase('in');
  await settle(cfg.fadeInMs, timers);
  view.setPhase('hold');

  const nominalHoldEnd = tIn + cfg.fadeInMs + cfg.holdMs;
  const latestHoldEnd = tIn + cfg.hardCapMs - cfg.fadeOutMs;
  // extend the hold only while init is still running, and never beyond the cap
  if (state.doneAt === null || state.doneAt > nominalHoldEnd) {
    await Promise.race([initPromise, settle(Math.max(0, latestHoldEnd - timers.now()), timers)]);
  }
  const holdEnd = Math.min(Math.max(nominalHoldEnd, state.doneAt ?? 0), latestHoldEnd);
  await settle(Math.max(0, holdEnd - timers.now()), timers);

  view.setPhase('out');
  await settle(cfg.fadeOutMs, timers);
  view.setPhase('done');
  return { reason: 'shown', totalMs: timers.now() - tIn, initOk: state.ok, initWaitedMs: Math.max(0, (state.doneAt ?? timers.now()) - t0) };
}

/** Browser glue: drives <html data-splash> from the timeline. */
export function startDomSplash(init: () => Promise<unknown>): Promise<SplashOutcome | 'skipped'> {
  const root = document.documentElement;
  const KEY = 'hag.splash.shown';
  let already = false;
  try { already = sessionStorage.getItem(KEY) === '1'; } catch { /* storage unavailable: treat as cold launch */ }
  if (!shouldShowSplash(already)) {
    root.dataset.splash = 'skip';
    void init().catch(() => undefined);
    return Promise.resolve('skipped');
  }
  try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }

  const img = document.getElementById('hag-splash-img') as HTMLImageElement | null;
  const view: SplashView = {
    setPhase: (p) => { root.dataset.splash = p; },
    prepare: () => new Promise<void>((resolve) => {
      root.dataset.splash = 'prep';       // logo at ~1% opacity: rasterised and uploaded while still effectively invisible
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }),
    imageReady: () => {
      if (!img) return Promise.resolve(false);
      if (typeof img.decode === 'function') return img.decode().then(() => img.naturalWidth > 0, () => false);
      return new Promise<boolean>((resolve) => {
        if (img.complete) return resolve(img.naturalWidth > 0);
        img.addEventListener('load', () => resolve(true), { once: true });
        img.addEventListener('error', () => resolve(false), { once: true });
      });
    },
  };
  const timers: Timers = { now: () => performance.now(), wait: (ms) => new Promise((r) => setTimeout(r, ms)) };
  return runSplashTimeline(view, init, timers);
}
