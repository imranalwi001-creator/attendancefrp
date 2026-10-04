import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fawwazreskiperwira.attendance',
  appName: 'HRM Attendance',
  webDir: 'dist',
  server: {
    url: 'https://fawwazreskiperwira.com',
    cleartext: false,
    androidScheme: 'https',
    errorPath: 'error.html',
    allowNavigation: [
      'fawwazreskiperwira.com',
      '*.fawwazreskiperwira.com'
    ]
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
