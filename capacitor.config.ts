import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fawwazreskiperwira.attendance',
  appName: 'HRM Attendance',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
