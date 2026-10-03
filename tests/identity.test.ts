import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const PKG = 'com.hotatticgames.cfmcalculator';

describe('package identity cannot drift', () => {
  it('capacitor config', () => expect(read('capacitor.config.ts')).toContain(`appId: '${PKG}'`));
  it('gradle namespace + applicationId', () => {
    const g = read('android/app/build.gradle');
    expect(g).toContain(`namespace = "${PKG}"`);
    expect(g).toContain(`applicationId "${PKG}"`);
  });
  it('android strings', () => {
    const s = read('android/app/src/main/res/values/strings.xml');
    expect(s).toContain(`<string name="package_name">${PKG}</string>`);
  });
  it('java sources live in the package and declare it', () => {
    for (const f of ['MainActivity', 'BuildInfoPlugin']) {
      expect(read(`android/app/src/main/java/${PKG.replaceAll('.', '/')}/${f}.java`)).toContain(`package ${PKG};`);
    }
  });
  it('CI workflow expects the same package', () => expect(read('.github/workflows/android.yml')).toContain(`EXPECTED_PACKAGE: ${PKG}`));
  it('package id is not hardcoded in web code (read from OS at runtime)', () => {
    for (const f of ['src/main.ts', 'src/buildinfo.ts']) expect(read(f)).not.toContain(PKG);
  });
});

describe('Android policy guards', () => {
  const vars = read('android/variables.gradle');
  const num = (k: string) => Number(new RegExp(`${k}\\s*=\\s*(\\d+)`).exec(vars)?.[1]);
  it('targets API 36 (Play requirement)', () => {
    expect(num('targetSdkVersion')).toBeGreaterThanOrEqual(36);
    expect(num('compileSdkVersion')).toBeGreaterThanOrEqual(36);
  });
  it('removes INTERNET and declares no other permissions (offline app)', () => {
    const m = read('android/app/src/main/AndroidManifest.xml');
    expect(m).toMatch(/INTERNET"\s+tools:node="remove"/);
    const perms = [...m.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((x) => x[1]);
    expect(perms).toEqual(['android.permission.INTERNET']); // only the removal marker
  });
  it('version code is above the legacy v3.0 (code 3)', () => {
    expect(Number(/versionCode (\d+)/.exec(read('android/app/build.gradle'))?.[1])).toBeGreaterThan(3);
  });
});
