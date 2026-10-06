import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// GitHub Actions budget policy (CLAUDE.md "Actions budget"): these guards keep hosted CI cheap and opt-in.
const root = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const onBlock = (w: string) => w.slice(w.indexOf('\non:'), w.indexOf('\njobs:'));

describe('Actions budget policy', () => {
  it('ci.yml: PRs (not drafts) + main only, path-filtered, cancels superseded runs, builds no APK', () => {
    const w = read('.github/workflows/ci.yml');
    expect(onBlock(w)).not.toMatch(/ccr-|'\*\*'/);
    expect(onBlock(w)).toContain('branches: [main]');
    expect(onBlock(w)).toContain('paths-ignore');
    expect(w).toContain('cancel-in-progress: true');
    expect(w).toContain('draft == false');
    expect(w).toContain('timeout-minutes');
    expect(w).not.toMatch(/gradlew|upload-artifact|android-emulator-runner|playwright/);
  });
  it('android.yml (release): only tags vN and release/deliver pushes; no PR, no dispatch, no emulator, never cancels a publish', () => {
    const w = read('.github/workflows/android.yml');
    const on = onBlock(w);
    expect(on).not.toMatch(/pull_request|workflow_dispatch/);
    expect(on).toContain("paths: ['release/deliver']");
    expect(on).toContain("tags: ['v[0-9]*']");
    expect(w).toContain('cancel-in-progress: false');
    expect(w).toContain('timeout-minutes');
    expect(w).not.toMatch(/android-emulator-runner|^ {2}smoke:|^ {2}promote:/m);
    // a non-delivery run must stop right after version resolution
    const afterResolve = w.slice(w.indexOf('- uses: actions/setup-node'));
    for (const step of afterResolve.split(/\n(?= {6}- )/)) expect(step).toContain("env.IS_RELEASE == 'true'");
  });
  it('release safety gates are still in the release workflow', () => {
    const w = read('.github/workflows/android.yml');
    for (const gate of ['npm run typecheck', 'npm run lint', 'npm test', 'scripts/qualify-apk.sh', 'verify-splash-asset', '-PreleaseBuild'])
      expect(w).toContain(gate);
  });
  it('promote.yml and smoke.yml are opt-in: path-triggered or manual only', () => {
    const p = onBlock(read('.github/workflows/promote.yml'));
    const s = onBlock(read('.github/workflows/smoke.yml'));
    expect(p).toContain("paths: ['release/promote.json']");
    expect(s).toContain("paths: ['release/smoke']");
    for (const o of [p, s]) expect(o).not.toContain('pull_request');
  });
  it('every workflow has a timeout and no workflow triggers on plain pushes', () => {
    for (const f of readdirSync(resolve(root, '.github/workflows')).filter((x) => x.endsWith('.yml'))) {
      const w = read(`.github/workflows/${f}`);
      expect(w, f).toContain('timeout-minutes');
      const on = onBlock(w);
      if (on.includes('push:') && !on.includes('branches: [main]')) expect(on, f).toMatch(/paths:|tags:/);
    }
  });
  it('the policy is recorded for agents and documented', () => {
    const c = read('CLAUDE.md');
    expect(c).toContain('Actions budget');
    expect(c).toContain('Does this need GitHub Actions, or can I prove it locally?');
    expect(read('docs/RELEASING.md')).toContain('scripts/local-check.sh');
    expect(read('scripts/local-check.sh')).toContain('verify-splash-asset');
  });
});
