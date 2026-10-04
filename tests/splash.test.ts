import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nominalDurationMs, runSplashTimeline, shouldShowSplash, SPLASH, type SplashPhase, type SplashView, type Timers } from '../src/splash';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CANONICAL = 'Hot_Attic_Games_Master_Logo_ALPHA_FINAL.png';

describe('canonical studio artwork', () => {
  const path = new URL(`../${CANONICAL}`, import.meta.url);
  it('exists at the repository root under its exact name', () => expect(existsSync(path)).toBe(true));
  const png = existsSync(path) ? readFileSync(path) : Buffer.alloc(0);
  it('is a PNG with an alpha channel and the supplied 1536x1024 (3:2) geometry', () => {
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(1536);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[24]).toBe(8);        // bit depth
    expect(png[25]).toBe(6);        // colour type 6 = RGBA (transparency preserved)
  });
  it('is byte-identical to the owner-supplied file (any change needs explicit owner approval; update this pin together with the owner)', () => {
    expect(createHash('sha256').update(png).digest('hex')).toBe('e3d9bb5653eafb783eede827606e7ac73a4e45564a1c25b1ed13ad1429f48c4e');
  });
  it('is the file the splash markup displays (not a substitute) and the obsolete path is not referenced', () => {
    const html = read('index.html');
    expect(html).toContain(`src="/${CANONICAL}"`);
    expect(html).toContain('id="hag-splash-img"');
    expect(read('src/splash.ts')).toContain(CANONICAL);
    // code must not reference the obsolete path (docs may mention it, as obsolete)
    for (const f of ['index.html', 'src/splash.ts', 'src/main.ts', 'vite.config.ts', 'capacitor.config.ts']) {
      expect(read(f)).not.toContain('branding/Hot_Attic_Games_Master_Logo.png');
    }
  });
  it('is never cropped or stretched: contain-fit, no background-size/transform tricks', () => {
    const html = read('index.html');
    expect(html).toMatch(/#hag-splash img \{[^}]*object-fit: contain/);
    expect(html).not.toMatch(/#hag-splash img \{[^}]*(cover|stretch|scale\()/);
  });
});

describe('studio card timeline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const timers: Timers = { now: () => Date.now(), wait: (ms) => new Promise((r) => setTimeout(r, ms)) };
  function makeView(imageOk = true) {
    const log: { phase: SplashPhase; at: number }[] = [];
    const view: SplashView = {
      setPhase: (phase) => log.push({ phase, at: Date.now() }),
      imageReady: () => Promise.resolve(imageOk),
    };
    return { view, log };
  }
  const run = async (view: SplashView, init: () => Promise<unknown>) => {
    const p = runSplashTimeline(view, init, timers);
    await vi.advanceTimersByTimeAsync(10_000);
    return p;
  };
  const t = (log: { phase: SplashPhase; at: number }[], ph: SplashPhase) => log.find((x) => x.phase === ph)!.at - log[0].at;

  it('nominal display time is 2.5 s and inside the 2-3 s requirement', () => {
    expect(nominalDurationMs()).toBe(2500);
    expect(nominalDurationMs()).toBeGreaterThanOrEqual(2000);
    expect(SPLASH.hardCapMs).toBeLessThanOrEqual(3000);
  });

  it('fast init: in -> hold -> out -> done, 2.5 s total', async () => {
    const { view, log } = makeView();
    const out = await run(view, () => Promise.resolve());
    expect(log.map((x) => x.phase)).toEqual(['in', 'hold', 'out', 'done']);
    expect(t(log, 'hold')).toBe(400);
    expect(t(log, 'out')).toBe(2100);
    expect(t(log, 'done')).toBe(2500);
    expect(out).toMatchObject({ reason: 'shown', totalMs: 2500, initOk: true });
  });

  it('init runs behind the card: it adds no waiting time when it finishes within the card', async () => {
    const { view, log } = makeView();
    await run(view, () => new Promise((r) => setTimeout(r, 1500)));
    expect(t(log, 'done')).toBe(2500);
  });

  it('slow init extends the hold but never past the 3 s hard cap', async () => {
    const { view, log } = makeView();
    const out = await run(view, () => new Promise((r) => setTimeout(r, 2300)));
    expect(Math.abs(t(log, 'out') - 2300)).toBeLessThanOrEqual(5);   // fake-timer ordering can differ by a millisecond
    expect(Math.abs(t(log, 'done') - 2700)).toBeLessThanOrEqual(5);
    const stuck = makeView();
    const out2 = await run(stuck.view, () => new Promise(() => undefined)); // init never completes
    expect(t(stuck.log, 'done')).toBeLessThanOrEqual(SPLASH.hardCapMs);
    expect(t(stuck.log, 'done')).toBeGreaterThanOrEqual(SPLASH.hardCapMs - 5);
    expect(out).toMatchObject({ reason: 'shown' });
    expect(out2.reason).toBe('shown');
    expect((out2 as { totalMs: number }).totalMs).toBeLessThanOrEqual(3000);
  });

  it('an init error cannot strand the user: the card still completes normally', async () => {
    const { view, log } = makeView();
    const out = await run(view, () => Promise.reject(new Error('boom')));
    expect(log[log.length - 1].phase).toBe('done');
    expect(out).toMatchObject({ reason: 'shown', initOk: false, totalMs: 2500 });
    const sync = makeView();
    await run(sync.view, () => { throw new Error('sync boom'); });
    expect(sync.log[log.length - 1].phase).toBe('done');
  });

  it('artwork that cannot be shown skips the card promptly instead of showing an empty frame', async () => {
    const { view, log } = makeView(false);
    const out = await run(view, () => Promise.resolve());
    expect(log.map((x) => x.phase)).toEqual(['out', 'done']);
    expect(out.reason).toBe('image-unavailable');
    expect(out.totalMs).toBeLessThanOrEqual(SPLASH.fadeOutMs + 50);
  });

  it('artwork that never finishes decoding is abandoned after the image wait', async () => {
    const view: SplashView = { setPhase: () => undefined, imageReady: () => new Promise(() => undefined) };
    const out = await run(view, () => Promise.resolve());
    expect(out.reason).toBe('image-unavailable');
    expect(out.totalMs).toBeLessThanOrEqual(SPLASH.imageWaitMs + SPLASH.fadeOutMs + 50);
  });
});

describe('cold launch only', () => {
  it('shows on a cold launch and never replays within the same session (reload, resume, in-app navigation)', () => {
    expect(shouldShowSplash(false)).toBe(true);
    expect(shouldShowSplash(true)).toBe(false);
  });
  it('no resume/visibility handler can re-trigger the card', () => {
    const src = read('src/splash.ts') + read('src/main.ts');
    expect(src).not.toMatch(/addEventListener\(\s*['"](visibilitychange|pageshow|pagehide|resume|focus)['"]/);
    expect(src).not.toMatch(/appStateChange|App\.addListener/);
  });
});

describe('durable requirement and no stale blocker', () => {
  it('CLAUDE.md records the standing requirement with the exact canonical filename', () => {
    const c = read('CLAUDE.md');
    expect(c).toContain(CANONICAL);
    expect(c).toMatch(/studio splash/i);
    expect(c).toMatch(/cold launch/i);
  });
  it('no document still says the logo is missing/blocked', () => {
    for (const f of ['docs/MODERNIZATION.md', 'docs/PHYSICAL-TEST.md', 'README.md', 'CLAUDE.md']) {
      expect(read(f)).not.toMatch(/BLOCKED — CANONICAL|logo (is|was) (absent|missing)|\(no logo\)|requires portfolio\/owner supply/i);
    }
  });
});
