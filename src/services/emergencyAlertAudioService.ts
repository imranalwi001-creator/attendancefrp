// Enterprise Emergency Siren & Haptic Alert Service
// Synthesizes urgent alarm tones using Web Audio API and controls mobile haptic vibration
// Works offline and without external MP3/WAV dependencies

class EmergencyAlertAudioService {
  private audioCtx: AudioContext | null = null;
  private isAlarmRunning: boolean = false;
  private intervalId: any = null;
  private vibrationIntervalId: any = null;

  private initAudio() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => null);
    }
  }

  // Play a single 2-tone siren burst (high-pitch attention grabber: 880Hz to 1320Hz)
  private playSirenTone() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      // Emergency frequency sweep (880Hz -> 1320Hz -> 880Hz)
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.25);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.5);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {
      console.warn('[EmergencyAlert] Audio synthesis error:', e);
    }
  }

  // Trigger continuous siren + mobile vibration + notification
  public startEmergencyAlert(title: string = '🚨 INSTRUKSI PIMPINAN SEGERA LAPOR WAJAH', message?: string) {
    if (this.isAlarmRunning) return;
    this.isAlarmRunning = true;

    // 1. Play immediate sound
    this.playSirenTone();
    this.intervalId = setInterval(() => {
      if (this.isAlarmRunning) {
        this.playSirenTone();
      }
    }, 700);

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
