import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService } from '@/services/hrmService';
import { api } from '@/services/apiClient';
import { UserProfile, isOfficialFrEmployee } from '@/types/hrm';
import {
  Search,
  Smartphone,
  ShieldCheck,
  User,
  Building2,
  Sparkles,
  ArrowRight,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface HrmGhostSwitcherModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const HrmGhostSwitcherModal: React.FC<HrmGhostSwitcherModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { user: currentUser, impersonateUser, isImpersonating } = useHrmAuth();
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      loadEmployees();
    }
  }, [open]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      // 1. Fetch from PostgreSQL Backend API
      const res = await api.get<{ success: boolean; data?: any[]; users?: any[] }>('/users');
      const apiUsers = res?.data || res?.users;
      if (Array.isArray(apiUsers) && apiUsers.length > 0) {
        const mapped = apiUsers
          .filter((u: any) => isOfficialFrEmployee(u.nip || u.user_nip || ''))
          .map((u: any) => ({
            id: u.id,
            nip: u.nip || u.user_nip || '',
            fullName: u.fullName || u.full_name || u.name || 'Karyawan',
            email: u.email || '',
            phone: u.phone || '',
            roleId: u.roleId || u.role_id || '',
            roleName: u.roleName || u.role_name || 'karyawan',
            divisionId: u.divisionId || u.division_id || '',
            divisionName: u.divisionName || u.division_name || 'Operasional Lapangan',
            shiftId: u.shiftId || u.shift_id || '',
            avatarUrl: u.avatarUrl || u.avatar_url || '',
            faceEnrolledPhoto: u.faceEnrolledPhoto || u.face_enrolled_photo || '',
            annualLeaveQuota: Number(u.annualLeaveQuota || u.annual_leave_quota || 12),
            usedLeaveDays: Number(u.usedLeaveDays || u.used_leave_days || 0),
            isActive: u.isActive !== undefined ? u.isActive : (u.is_active !== undefined ? u.is_active : true),
            createdAt: u.createdAt || u.created_at || new Date().toISOString(),
          } as UserProfile));
        setEmployees(mapped);
      } else {
        // Fallback local storage
        const local = hrmService.getUsers().filter((u) => isOfficialFrEmployee(u));
        setEmployees(local);
      }
    } catch (_) {
      const local = hrmService.getUsers().filter((u) => isOfficialFrEmployee(u));
      setEmployees(local);
    } finally {
      setLoading(false);
    }
  };

  // Distinct divisions for filter tabs
  const divisions = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.divisionName) set.add(e.divisionName);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return employees.filter((e) => {
      const matchSearch =
        !q ||
        e.fullName.toLowerCase().includes(q) ||
        e.nip.toLowerCase().includes(q) ||
        (e.divisionName || '').toLowerCase().includes(q);

      const matchDiv = selectedDivision === 'all' || e.divisionName === selectedDivision;

      return matchSearch && matchDiv;
    });
  }, [employees, searchQuery, selectedDivision]);

  const handleSelectEmployee = (target: UserProfile) => {
    impersonateUser(target);
    onOpenChange(false);
    toast.success(`Mode Pantau Aktif: Sedang mengamati akun ${target.fullName} (${target.nip})`, {
      description: 'Device binding asli karyawan tetap aman dan tidak berubah.',
      duration: 4000,
    });
    // Redirect to PWA attendance view so the employee's PWA interface opens instantly
    navigate('/presensi');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-950 border border-cyan-500/30 text-white shadow-2xl rounded-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-cyan-500/20 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Superadmin Ghost Mode</span>
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] uppercase font-bold">
                  Mode Pantau PWA
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Pilih akun karyawan untuk melihat tampilan PWA persis seperti di HP mereka tanpa perlu password &amp; tanpa merusak ikatan perangkat.
              </DialogDescription>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-3.5">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, NIP (cth: FR07060), atau divisi..."
              className="pl-9 h-10 bg-slate-900/90 border-slate-700/80 text-white placeholder:text-slate-500 rounded-xl text-xs focus-visible:ring-cyan-500/50"
            />
          </div>

          {/* Division quick filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 text-[11px]">
            <button
              onClick={() => setSelectedDivision('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                selectedDivision === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Semua Divisi ({employees.length})
            </button>
            {divisions.map((div) => {
              const count = employees.filter((e) => e.divisionName === div).length;
              return (
                <button
                  key={div}
                  onClick={() => setSelectedDivision(div)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0 ${
                    selectedDivision === div
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {div} ({count})
                </button>
              );
            })}
          </div>
        </DialogHeader>

        {/* Employee List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-800/40">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>Memuat daftar 80 karyawan resmi PT FRP...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-1">
              <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-300">Tidak ada karyawan ditemukan</p>
              <p className="text-[11px] text-slate-500">Coba gunakan kata kunci pencarian yang lain.</p>
            </div>
          ) : (
            filteredEmployees.map((emp) => {
              const isCurrentlyViewing = currentUser?.id === emp.id && isImpersonating;
              const photo = emp.avatarUrl || emp.faceEnrolledPhoto;
              return (
                <div
                  key={emp.id}
                  className={`pt-2 first:pt-0 flex items-center justify-between p-2.5 rounded-xl transition-all ${
                    isCurrentlyViewing
                      ? 'bg-cyan-950/40 border border-cyan-500/50'
                      : 'hover:bg-slate-900/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center text-cyan-300 font-bold text-xs">
                      {photo ? (
                        <img
                          src={photo}
                          alt={emp.fullName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{emp.fullName.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-white truncate">{emp.fullName}</span>
                        <Badge className="bg-slate-800 text-cyan-300 border-slate-700 text-[10px] px-1.5 py-0 font-mono">
                          {emp.nip}
                        </Badge>
                        {isCurrentlyViewing && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] px-1.5 py-0 font-bold">
                            Sedang Dipantau
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                        <span className="truncate flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{emp.divisionName || 'Operasional Lapangan'}</span>
                        </span>
                        <span>•</span>
                        <span>Sisa Cuti: {Math.max(0, emp.annualLeaveQuota - emp.usedLeaveDays)} Hari</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    size="sm"
                    disabled={isCurrentlyViewing}
                    onClick={() => handleSelectEmployee(emp)}
                    className={`h-8 px-3 text-xs font-bold rounded-xl gap-1 shrink-0 ${
                      isCurrentlyViewing
                        ? 'bg-slate-800 text-slate-400 cursor-default'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{isCurrentlyViewing ? 'Aktif' : 'Pantau PWA'}</span>
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Hardware fingerprint HP karyawan asli tetap aman dan tidak tertimpa.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white text-xs h-7 px-2.5 rounded-lg"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

