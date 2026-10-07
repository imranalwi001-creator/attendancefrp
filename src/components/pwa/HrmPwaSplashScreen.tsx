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
  const [statusText, setStatusText] = useState('Synchronizing workspace');
  const [settings] = useState(hrmService.getAppSettings());

  useEffect(() => {
    // Cek apakah splash screen perlu ditampilkan
    // Ditampilkan jika forceShow = true atau jika belum pernah ditampilkan dalam sesi ini
    const hasSeenSplash = sessionStorage.getItem('hrm_pwa_splash_shown') === 'true';

    // Periksa apakah berjalan di PWA standalone atau mobile
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

      // Animasi progress bar bertahap 0 -> 100%
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 8) + 4;
        if (currentProgress >= 100) {
          currentProgress = 100;
          setProgress(100);
          setStatusText('Workspace synchronized');
          clearInterval(interval);

          // Tahan sejenak lalu fade out mulus
          setTimeout(() => {
            setFadingOut(true);
            setTimeout(() => {
              setVisible(false);
              if (onFinish) onFinish();
            }, 600);
          }, 350);
        } else {
          setProgress(currentProgress);
          if (currentProgress > 70) {
            setStatusText('Memuat sistem presensi...');
          } else if (currentProgress > 40) {
            setStatusText('Synchronizing workspace');
          } else {
            setStatusText('Menginisialisasi modul...');
          }
        }
      }, 70);

      return () => clearInterval(interval);
    } else {
      if (onFinish) onFinish();
    }
  }, [forceShow, onFinish]);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden transition-all duration-600 select-none ${
        fadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 45%, #0b3438 0%, #062225 45%, #041416 100%)',
      }}
    >
      {/* ─── GRID BACKGROUND FUTURISTIK PERSIS LAMPIRAN 4 ─── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(45, 212, 191, 0.18) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(45, 212, 191, 0.18) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Ambient radial glow di tengah */}
      <div className="absolute w-96 h-96 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />

      {/* ─── ELEMEN UTAMA TENGAH (LINGKARAN GLOW + KOTAK LOGO PERSIS LAMPIRAN 4) ─── */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Lingkaran Luar dengan Radar Glowing Ring */}
        <div className="relative flex items-center justify-center w-52 h-52 sm:w-60 sm:h-60">
          {/* Cincin Luar Berputar Halus (Rotating Glow Ring) */}
          <div className="absolute inset-0 rounded-full border border-teal-400/30 animate-[spin_10s_linear_infinite]" />
          
          {/* Cincin Kedua dengan Dash Gradient (Aksen Radar Persis Lampiran 4) */}
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-teal-300/80 border-r-teal-300/30 animate-[spin_4s_linear_infinite]" />
          
          {/* Soft inner glow ring */}
          <div className="absolute inset-6 rounded-full bg-teal-400/10 blur-md pointer-events-none" />

          {/* Kotak App Icon Persegi di Tengah Lingkaran (Mirip Icon Kolabo 2026 di Lampiran 4) */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 p-3 flex flex-col items-center justify-center border border-teal-400/40 shadow-[0_0_35px_rgba(20,184,166,0.35)] backdrop-blur-md">
            {/* Logo Monogram */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
              <img
                src={settings?.logoUrl || defaultLogo}
                alt="Logo FRP"
                className="w-full h-full object-contain filter drop-shadow-[0_2px_10px_rgba(45,212,191,0.5)]"
              />
            </div>
            {/* Badge Tahun / Versi di Bawah Logo */}
            <span className="mt-1 text-[10px] font-mono font-bold tracking-widest text-teal-300/90 uppercase">
              2026
            </span>
          </div>
        </div>

        {/* ─── BRANDING: NAMA PT. FAWWAZ RESKI PERWIRA (BERADA TEPAT DI TENGAH SIMETRIS TANPA LOGO SAMPING) ─── */}
        <div className="mt-8 flex flex-col items-center justify-center text-center space-y-2 px-4 w-full max-w-sm mx-auto">
          <h1 className="text-xl sm:text-2xl font-black tracking-wider text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] text-center leading-snug">
            {settings?.appName || 'PT. FAWWAZ RESKI PERWIRA'}
          </h1>

          <p className="text-[11px] font-semibold tracking-widest text-teal-200/80 uppercase text-center">
            Sistem Informasi Presensi & Manajemen SDM
          </p>
        </div>

        {/* ─── PROGRESS BAR LOADING PERSIS LAMPIRAN 4 ─── */}
        <div className="mt-10 flex flex-col items-center space-y-3">
          {/* Progress Track */}
          <div className="w-48 sm:w-56 h-1.5 rounded-full bg-slate-900/80 border border-teal-500/30 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-300 shadow-[0_0_10px_rgba(45,212,191,0.8)] transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status Text (Persis "Synchronizing workspace" di Lampiran 4) */}
          <p className="text-xs font-mono tracking-wide text-teal-200/80 font-medium">
            {statusText}
          </p>
        </div>
      </div>

      {/* Footer subtle brand */}
      <div className="absolute bottom-6 text-[10px] text-teal-100/40 font-mono tracking-widest uppercase">
        Enterprise PWA Edition • Encrypted Security
      </div>
    </div>
  );
};
