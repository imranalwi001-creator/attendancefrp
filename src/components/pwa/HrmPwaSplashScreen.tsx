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
        currentProgress += Math.floor(Math.random() * 8) + 5;
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
            }, 500);
          }, 300);
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
      }, 60);

      // Hard safety timer: pastikan splash screen hilang dalam 2.5 detik apa pun yang terjadi
      const safetyTimer = setTimeout(() => {
        clearInterval(interval);
        setFadingOut(true);
        setTimeout(() => {
          setVisible(false);
          if (onFinish) onFinish();
        }, 300);
      }, 2500);

      return () => {
        clearInterval(interval);
        clearTimeout(safetyTimer);
      };
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
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ─── GRID BACKGROUND FUTURISTIK ─── */}
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

      {/* ─── ELEMEN UTAMA TENGAH ─── */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Lingkaran Luar dengan Radar Glowing Ring */}
        <div className="relative flex items-center justify-center w-56 h-56 sm:w-64 sm:h-64">
          {/* Cincin Luar Berputar Halus */}
          <div className="absolute inset-0 rounded-full border border-teal-400/35 animate-[spin_10s_linear_infinite]" />
          
          {/* Cincin Kedua dengan Dash Gradient */}
          <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-teal-300/90 border-r-teal-300/40 animate-[spin_4s_linear_infinite]" />
          
          {/* Soft inner glow ring */}
          <div className="absolute inset-6 rounded-full bg-teal-400/15 blur-md pointer-events-none" />

          {/* Logo Menyatu Tanpa Bingkai Kotak, Tetap Tajam & Jelas dengan Aksen Glow */}
          <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
            <img
              src={settings?.logoUrl || defaultLogo}
              alt="Logo FRP"
              className="w-28 h-28 sm:w-32 sm:h-32 object-contain filter drop-shadow-[0_0_24px_rgba(45,212,191,0.75)]"
            />
            {/* Badge Tahun di Bawah Logo */}
            <span className="mt-2 text-xs sm:text-sm font-bold tracking-widest text-teal-300 uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
              2026
            </span>
          </div>
        </div>

        {/* ─── BRANDING: NAMA PT. FAWWAZ RESKI PERWIRA (UKURAN STANDAR & FONT ANTI-SLOP) ─── */}
        <div className="mt-8 flex flex-col items-center justify-center text-center space-y-2 px-4 w-full max-w-md mx-auto">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)] text-center leading-snug">
            {settings?.appName || 'PT. FAWWAZ RESKI PERWIRA'}
          </h1>

          <p className="text-xs sm:text-sm font-semibold tracking-wider text-teal-100 uppercase text-center">
            Sistem Informasi Presensi & Manajemen SDM
          </p>
        </div>

        {/* ─── PROGRESS BAR LOADING ─── */}
        <div className="mt-10 flex flex-col items-center space-y-3">
          {/* Progress Track */}
          <div className="w-52 sm:w-60 h-2 rounded-full bg-slate-900/85 border border-teal-500/40 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-400 via-emerald-300 to-cyan-300 shadow-[0_0_12px_rgba(45,212,191,0.85)] transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status Text (Ukuran Standar) */}
          <p className="text-sm tracking-normal text-teal-100 font-medium">
            {statusText}
          </p>
        </div>
      </div>

      {/* Footer subtle brand */}
      <div className="absolute bottom-6 text-xs text-teal-100/60 font-medium tracking-wider uppercase">
        Enterprise PWA Edition • Encrypted Security
      </div>
    </div>
  );
};
