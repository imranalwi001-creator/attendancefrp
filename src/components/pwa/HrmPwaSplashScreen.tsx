import React, { useState, useEffect } from 'react';
import defaultLogo from '@/assets/logo.png';
import { hrmService } from '@/services/hrmService';

interface HrmPwaSplashScreenProps {
  onFinish?: () => void;
  forceShow?: boolean;
}

export const HrmPwaSplashScreen: React.FC<HrmPwaSplashScreenProps> = ({ onFinish, forceShow = false }) => {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [settings] = useState(hrmService.getAppSettings());

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hrm_pwa_splash_shown') === 'true';
    const isStandalone = Boolean(
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://') ||
      new URLSearchParams(window.location.search).get('source') === 'pwa' ||
      localStorage.getItem('hrm_pwa_mode') === 'true'
    );

    if (forceShow || (!hasSeenSplash && (isStandalone || window.innerWidth <= 768))) {
      setVisible(true);
      sessionStorage.setItem('hrm_pwa_splash_shown', 'true');

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 14) + 10;
        if (currentProgress >= 100) {
          setProgress(100);
          clearInterval(interval);
          setTimeout(() => {
            setFadingOut(true);
            setTimeout(() => {
              setVisible(false);
              if (onFinish) onFinish();
            }, 320);
          }, 180);
        } else {
          setProgress(currentProgress);
        }
      }, 55);

      const safetyTimer = setTimeout(() => {
        clearInterval(interval);
        setFadingOut(true);
        setTimeout(() => {
          setVisible(false);
          if (onFinish) onFinish();
        }, 250);
      }, 1800);

      return () => {
        clearInterval(interval);
        clearTimeout(safetyTimer);
      };
    } else if (onFinish) {
      onFinish();
    }
  }, [forceShow, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-between py-12 px-6 bg-[#F7F9F8] dark:bg-[#0D1214] transition-opacity duration-300 select-none ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div />

      <div className="flex flex-col items-center text-center space-y-5">
        <div className="w-20 h-20 rounded-[24px] bg-white dark:bg-[#151D20] border border-slate-200/80 dark:border-white/10 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.1)] p-3.5 flex items-center justify-center">
          <img
            src={settings?.logoUrl || defaultLogo}
            alt="Logo PT FRP"
            className="w-full h-full object-contain"
          />
        </div>

        <div className="space-y-1">
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
            {settings?.appName || 'PT. FAWWAZ RESKI PERWIRA'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Presensi & Operasional Terpadu
          </p>
        </div>

        <div className="w-36 h-1 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#0D7A5F] transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
        Keamanan Biometrik & Geofence Aktif
      </p>
    </div>
  );
};
