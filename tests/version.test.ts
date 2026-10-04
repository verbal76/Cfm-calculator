import { describe, expect, it } from 'vitest';
import { formatDiagnostics, publicVersionLabel } from '../src/buildinfo';

describe('public version label', () => {
  it('is derived from versionCode, never inferred from metadata', () => {
    expect(publicVersionLabel(6, '6')).toBe('v6');
    expect(publicVersionLabel(6, '6-dev')).toBe('v6-dev');
    expect(publicVersionLabel(5, '4.1.0')).toBe('v5');
    expect(publicVersionLabel(undefined, undefined)).toBe('unavailable');
  });
  it('diagnostics lead with product and public version and keep engineering metadata', () => {
    const text = formatDiagnostics(
      { packageName: 'com.hotatticgames.cfmcalculator', versionName: '6', versionCode: 6, targetSdk: 36, minSdk: 24, androidRelease: '16', androidApi: 36, manufacturer: 'X', model: 'Y', locale: 'en-US', buildType: 'release' },
      { sha: 'abc1234', branch: 'main', builtAt: '2026-01-01T00:00:00.000Z' }, new Date('2026-01-02T00:00:00Z'),
    );
    const lines = text.split('\n');
    expect(lines[0]).toBe("Product: Verbal's CFM Calculator");
    expect(lines[1]).toBe('Version: v6');
    expect(text).toContain('Android versionCode: 6');
    expect(text).toContain('Source commit: abc1234');
    expect(text).toContain('Target SDK: 36');
    expect(text).toMatch(/Refrigerant dataset: cfm-pt-/);
  });
});
