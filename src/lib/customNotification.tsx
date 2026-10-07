import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { CheckCircle2, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

/**
 * Play a gentle, professional Web Audio synthesizer chime
 */
function playAudioChime(type: 'success' | 'warning' | 'error' | 'info') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(440, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.setValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.22);
    }
  } catch (_) {
    // Ignore audio autoplay restrictions
  }
}

/**
 * Trigger tactile mobile haptic feedback
 */
function triggerHaptic(type: 'success' | 'warning' | 'error' | 'info') {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'success') {
        navigator.vibrate([60, 40, 60]);
      } else if (type === 'warning') {
        navigator.vibrate([150, 80, 150]);
      } else if (type === 'error') {
        navigator.vibrate([250, 100, 250, 100, 350]);
      } else {
        navigator.vibrate(80);
      }
    } catch (_) {}
  }
}

export const customNotify = {
  success: (title: string, message?: string, options?: { duration?: number }) => {
    playAudioChime('success');
    triggerHaptic('success');

    sonnerToast.custom((t) => (
      <div className="flex items-start gap-3 w-full max-w-md p-3.5 rounded-2xl bg-card border border-emerald-500/30 shadow-xl shadow-emerald-500/5 text-foreground backdrop-blur-md">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-foreground truncate">{title}</h4>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              FRP Sukses
            </span>
          </div>
          {message && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{message}</p>}
        </div>
      </div>
    ), { duration: options?.duration || 3500 });
  },

  error: (title: string, message?: string, options?: { duration?: number }) => {
    playAudioChime('error');
    triggerHaptic('error');

    sonnerToast.custom((t) => (
      <div className="flex items-start gap-3 w-full max-w-md p-3.5 rounded-2xl bg-card border border-rose-500/40 shadow-xl shadow-rose-500/10 text-foreground backdrop-blur-md">
        <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
          <AlertOctagon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 truncate">{title}</h4>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
              Perhatian
            </span>
          </div>
          {message && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{message}</p>}
        </div>
      </div>
    ), { duration: options?.duration || 4500 });
  },

  warning: (title: string, message?: string, options?: { duration?: number }) => {
    playAudioChime('warning');
    triggerHaptic('warning');

    sonnerToast.custom((t) => (
      <div className="flex items-start gap-3 w-full max-w-md p-3.5 rounded-2xl bg-card border border-amber-500/40 shadow-xl shadow-amber-500/10 text-foreground backdrop-blur-md">
        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate">{title}</h4>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              Peringatan
            </span>
          </div>
          {message && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{message}</p>}
        </div>
      </div>
    ), { duration: options?.duration || 4000 });
  },

  info: (title: string, message?: string, options?: { duration?: number }) => {
    playAudioChime('info');
    triggerHaptic('info');

    sonnerToast.custom((t) => (
      <div className="flex items-start gap-3 w-full max-w-md p-3.5 rounded-2xl bg-card border border-primary/30 shadow-xl shadow-primary/5 text-foreground backdrop-blur-md">
        <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-foreground truncate">{title}</h4>
            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-primary/10 text-primary shrink-0">
              HRM Info
            </span>
          </div>
          {message && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{message}</p>}
        </div>
      </div>
    ), { duration: options?.duration || 3500 });
  },
};
