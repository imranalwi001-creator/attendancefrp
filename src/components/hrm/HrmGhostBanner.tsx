import React, { useState } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { Eye, ArrowLeftRight, X, ShieldAlert, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HrmGhostSwitcherModal } from './HrmGhostSwitcherModal';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const HrmGhostBanner: React.FC = () => {
  const { user, isImpersonating, stopImpersonating, originalSuperadmin } = useHrmAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const navigate = useNavigate();

  if (!isImpersonating || !user) {
    return null;
  }

  const handleExit = () => {
    stopImpersonating();
    toast.success('Kembali ke sesi Superadmin resmi', {
      description: `Selamat datang kembali, ${originalSuperadmin?.fullName || 'Superadmin'}.`,
      duration: 3500,
    });
    // Navigate back to Admin Dashboard or Monitoring
    navigate('/admin/monitoring');
  };

  return (
    <>
      <div className="sticky top-0 z-[9999] w-full bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-950 border-b border-cyan-500/40 text-white shadow-lg backdrop-blur-md px-3 py-2 select-none">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Left Info */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <div className="flex items-center gap-1 font-bold text-cyan-300 tracking-wide uppercase text-[10px] sm:text-xs">
                <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="hidden xs:inline">Mode Pantau</span>
                <span>PWA:</span>
              </div>
              <span className="font-extrabold text-white truncate max-w-[130px] sm:max-w-[200px]">
                {user.fullName}
              </span>
              <Badge className="bg-cyan-500/20 text-cyan-200 border-cyan-500/40 text-[10px] px-1.5 py-0 font-mono hidden sm:inline-flex">
                {user.nip}
              </Badge>
              <span className="text-slate-400 hidden md:inline text-[11px]">
                • Divisi: <span className="text-slate-200">{user.divisionName || 'Operasional Lapangan'}</span>
              </span>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSwitcherOpen(true)}
              className="h-7 px-2 sm:px-2.5 bg-cyan-950/60 hover:bg-cyan-900 border-cyan-500/40 text-cyan-200 hover:text-white rounded-lg text-[11px] font-semibold gap-1 transition-colors"
            >
              <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
              <span>Ganti Akun</span>
            </Button>

            <Button
              size="sm"
              onClick={handleExit}
              className="h-7 px-2 sm:px-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold gap-1 shadow-sm transition-colors"
            >
              <X className="w-3 h-3" />
              <span className="hidden sm:inline">Keluar Pantau</span>
              <span className="sm:hidden">Kembali</span>
            </Button>
          </div>
        </div>
      </div>

      <HrmGhostSwitcherModal open={switcherOpen} onOpenChange={setSwitcherOpen} />
    </>
  );
};

