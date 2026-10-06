// Enterprise Emergency Siren & Haptic Alert Service
// Synthesizes urgent alarm tones using Web Audio API and controls mobile haptic vibration
// Works offline and without external MP3/WAV dependencies

class EmergencyAlertAudioService {
  private audioCtx: AudioContext | null = null;
  private isAlarmRunning: boolean = false;
  private intervalId: any = null;
  private vibrationIntervalId: any = null;
  private autoTimeoutId: any = null;

  // Sound synthesis permanently disabled: Notifikasi hanya bergetar tanpa bunyi
  private playSirenTone() {
    // Silent mode enforced: no sound synthesis
  }

  // Trigger continuous mobile vibration + notification (Vibration ONLY, without sound)
  public startEmergencyAlert(title: string = '🚨 INSTRUKSI PIMPINAN SEGERA LAPOR WAJAH', message?: string) {
    if (this.isAlarmRunning) return;
    this.isAlarmRunning = true;

    // 1. Audio sound intentionally omitted per requirement: HANYA BERGETAR TANPA BUNYI

    // 2. Continuous Haptic Vibration (Android PWA supported)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([600, 200, 600, 200, 1000]);
        this.vibrationIntervalId = setInterval(() => {
          if (this.isAlarmRunning) {
            navigator.vibrate([600, 200, 600, 200, 1000]);
          }
        }, 3000);
      } catch (err) {
        console.warn('[EmergencyAlert] Vibration failed:', err);
      }
    }

    // 3. Native Browser / OS Push Notification Banner
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body: message || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.',
            icon: '/logo.png',
            badge: '/logo.png',
            tag: 'spot-check-emergency',
            requireInteraction: true,
          });
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              new Notification(title, {
                body: message || 'Pimpinan meminta Anda segera melakukan verifikasi scan wajah di pos tugas.',
                icon: '/logo.png',
                badge: '/logo.png',
                tag: 'spot-check-emergency',
                requireInteraction: true,
              });
            }
          });
        }
      } catch (err) {
        console.warn('[EmergencyAlert] Notification failed:', err);
      }
    }

    // 4. Auto-timeout safety: Automatically silence siren after 15 seconds to prevent continuous buzzing
    if (this.autoTimeoutId) clearTimeout(this.autoTimeoutId);
    this.autoTimeoutId = setTimeout(() => {
      this.stopEmergencyAlert();
    }, 15000);
  }

  // Stop sound and vibration immediately
  public stopEmergencyAlert() {
    this.isAlarmRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.vibrationIntervalId) {
      clearInterval(this.vibrationIntervalId);
      this.vibrationIntervalId = null;
    }
    if (this.autoTimeoutId) {
      clearTimeout(this.autoTimeoutId);
      this.autoTimeoutId = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0); // Stop vibration immediately
      } catch {
        // ignore
      }
    }
  }

  public isAlertActive(): boolean {
    return this.isAlarmRunning;
  }
}

export const emergencyAlertService = new EmergencyAlertAudioService();
