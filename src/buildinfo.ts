import { registerPlugin, Capacitor } from '@capacitor/core';

declare const __BUILD_SHA__: string;
declare const __BUILD_BRANCH__: string;
declare const __BUILD_TIME__: string;

export interface NativeInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
  targetSdk: number;
  minSdk: number;
  androidRelease: string;
  androidApi: number;
  manufacturer: string;
  model: string;
  locale: string;
  buildType: string;
}

const BuildInfo = registerPlugin<{ get(): Promise<NativeInfo> }>('BuildInfo');

export const APP_NAME = "Verbal's CFM Calculator";
export const FRAMEWORK = 'Capacitor 8 (web UI) on native Android';

export async function loadNativeInfo(): Promise<NativeInfo | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return await BuildInfo.get();
  } catch {
    return null;
  }
}

export function sourceInfo() {
  return { sha: __BUILD_SHA__, branch: __BUILD_BRANCH__, builtAt: __BUILD_TIME__ };
}

/** Plain-text diagnostics. Contains no personal data, secrets or clipboard contents. */
export function formatDiagnostics(n: NativeInfo | null, src = sourceInfo(), now = new Date()): string {
  const lines = [
    `Application: ${APP_NAME}`,
    `Package: ${n?.packageName ?? 'unavailable (not running natively)'}`,
    `Version: ${n?.versionName ?? 'unavailable'}`,
    `Version code: ${n?.versionCode ?? 'unavailable'}`,
    `Source SHA: ${src.sha}`,
    `Source branch: ${src.branch}`,
    `Built: ${src.builtAt}`,
    `Framework: ${FRAMEWORK}`,
    `Android: ${n ? `${n.androidRelease} (API ${n.androidApi})` : 'unavailable'}`,
    `Device: ${n ? `${n.manufacturer} ${n.model}` : 'unavailable'}`,
    `Locale: ${n?.locale ?? navigator.language}`,
    `Target SDK: ${n?.targetSdk ?? 'unavailable'}`,
    `Min SDK: ${n?.minSdk ?? 'unavailable'}`,
    `Build type: ${n?.buildType ?? 'unavailable'}`,
    `Captured: ${now.toISOString()}`,
  ];
  return lines.join('\n');
}
