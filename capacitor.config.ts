import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hotatticgames.cfmcalculator',
  appName: "Verbal's CFM Calculator",
  webDir: 'dist',
  // Same colour as the native splash frame and the studio card: no white/black flash while the WebView starts.
  backgroundColor: '#0f0c0b',
  android: { allowMixedContent: false },
};

export default config;
