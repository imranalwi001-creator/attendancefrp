import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import defaultLogo from '@/assets/logo.png';
import { hrmService } from '@/services/hrmService';
import { Lock, Eye, EyeOff, User, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export const HrmLogin: React.FC = () => {
  const { login, isAuthenticated } = useHrmAuth();
  const navigate = useNavigate();

  const [settings, setSettings] = useState(hrmService.getAppSettings());
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSettings(hrmService.getAppSettings());
    const saved = localStorage.getItem('hrm_remembered_credentials');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.identifier && parsed.password) {
          setIdentifier(parsed.identifier);
          setPassword(parsed.password);
          setRememberMe(true);
        }
      } catch {}
    }
  }, []);

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Email atau NIP harus diisi');
      return;
    }
    if (!password) {
      setError('Password harus diisi');
      return;
    }

    setLoading(true);
    try {
      const res = await login(identifier, password);
      if (res?.success) {
        if (rememberMe) {
          localStorage.setItem('hrm_remembered_credentials', JSON.stringify({ identifier, password }));
        } else {
          localStorage.removeItem('hrm_remembered_credentials');
        }
        navigate('/dashboard', { replace: true });
      } else {
        setError(res?.error || 'Email/NIP atau kata sandi tidak sesuai');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-3 sm:p-4">
      {/* Floating Theme Switcher at Top-Right */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <ThemeToggle variant="dropdown" className="bg-card/80 backdrop-blur-md shadow-xs border-border/80" />
      </div>

      <div className="w-full max-w-md space-y-4">
        <Card className="shadow-xl border border-border/80 rounded-xl sm:rounded-2xl overflow-hidden bg-card/95 backdrop-blur-sm">
          <CardHeader className="space-y-3 sm:space-y-4 text-center pb-4 sm:pb-6 px-4 sm:px-6 pt-5 sm:pt-6 bg-card relative">
            <div className="mx-auto flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-transparent p-1 transition-all">
              <img
                src={settings.logoUrl || defaultLogo}
                alt="Logo Perusahaan"
                className="h-full w-full object-contain filter drop-shadow-md dark:drop-shadow-[0_4px_16px_rgba(255,255,255,0.25)] hover:scale-105 transition-transform"
              />
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold text-foreground">
                {settings.appName || 'PT. FAWWAZ RESKI PERWIRA'}
              </CardTitle>
              <CardDescription className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
                Sistem Informasi Presensi &amp; Manajemen SDM
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2">
            {error && (
              <Alert variant="destructive" className="mb-4 py-2 text-xs">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="identifier" className="text-xs sm:text-sm font-medium">
                  Email atau NIP
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="nama@perusahaan.com atau NIP"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="pl-10 h-11 text-sm rounded-xl"
                    disabled={loading}
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-xs sm:text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 text-sm rounded-xl"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-border focus:ring-primary/20 accent-primary cursor-pointer"
                  />
                  <span>Ingat Saya (Simpan Akun di Perangkat Ini)</span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="py-4 px-4 sm:px-6 flex flex-col space-y-3 border-t border-border bg-muted/20">
            <div className="w-full text-center">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Pendaftaran akun baru dilakukan oleh Super Admin.
              </p>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
