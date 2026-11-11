import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Lightbulb,
  Users,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';

interface CostControlRadarResponse {
  workMonth: string;
  payrollMonth: string;
  zone: 'GREEN_AMAN' | 'YELLOW_WASPADA_55JT' | 'ORANGE_KETAT_60JT' | 'RED_HARDCAP_65JT';
  budget: {
    targetMin: number;
    targetMax: number;
    hardCap: number;
    wismaCap: number;
    strictGateEnabled: boolean;
  };
  realization: {
    approvedPay: number;
    approvedHours: number;
    approvedCount: number;
    pendingPay: number;
    pendingHours: number;
    pendingCount: number;
    committedPay: number;
    remainingToTargetMin: number;
    remainingToTargetMax: number;
    remainingToHardCap: number;
  };
  burnRate: {
    elapsedDays: number;
    remainingDays: number;
    totalDays: number;
    dailyAvgPay: number;
    projectedMonthEndPay: number;
    isProjectedBoncos: boolean;
    projectedVarianceFromTargetMax: number;
    safeDailyPayForTargetMin: number;
    safeDailyPayForTargetMax: number;
    safeDailyHoursForTargetMax: number;
  };
  topSpenders: Array<{
    userId: string;
    nip: string;
    fullName: string;
    divisionName: string;
    isDayShift: boolean;
    maxHoursCap: number;
    rawApprovedHours: number;
    spklApprovedCount: number;
    spklPendingCount: number;
    calculatedPay: number;
    utilizationPct: number;
  }>;
  pendingQueue: Array<{
    id: string;
    userId: string;
    userName: string;
    userNip: string;
    date: string;
    durationHours: number;
    compensationAmount: number;
    taskDescription: string;
  }>;
  savingsRecommendations: string[];
}

const MONTH_NAMES_ID: Record<string, string> = {
  '01': 'Januari',
  '02': 'Februari',
  '03': 'Maret',
  '04': 'April',
  '05': 'Mei',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'Agustus',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Desember',
};

const formatYm = (ym: string) => {
  const [y, m] = (ym || '').split('-');
  return `${MONTH_NAMES_ID[m] || m} ${y || ''}`.trim();
};

interface Props {
  onUpdated?: () => void;
}

export const HrmOvertimeCostControlTab: React.FC<Props> = ({ onUpdated }) => {
  const defaultWorkMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [workMonth, setWorkMonth] = useState<string>(defaultWorkMonth);
  const [radar, setRadar] = useState<CostControlRadarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);

  const [targetMinInput, setTargetMinInput] = useState('55000000');
  const [targetMaxInput, setTargetMaxInput] = useState('60000000');
  const [strictGate, setStrictGate] = useState(true);

  const fetchRadar = async (wm = workMonth) => {
    setLoading(true);
    try {
      const res: any = await api.get(`/overtime/cost-control-radar?workMonth=${encodeURIComponent(wm)}`);
      if (res?.success && res.data) {
        setRadar(res.data);
        setTargetMinInput(String(res.data.budget.targetMin));
        setTargetMaxInput(String(res.data.budget.targetMax));
        setStrictGate(Boolean(res.data.budget.strictGateEnabled));
      } else {
        toast.error(res?.error || 'Gagal memuat Radar Anti-Boncos');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghubungi server Cost-Control');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRadar(workMonth);
  }, [workMonth]);

  const handleSaveTargets = async () => {
    const tMin = Number(String(targetMinInput).replace(/[^\d]/g, ''));
    const tMax = Number(String(targetMaxInput).replace(/[^\d]/g, ''));
    if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMin <= 0 || tMax < tMin) {
      toast.error('Target Bawah & Target Atas harus valid (Target Atas >= Target Bawah).');
      return;
    }
    setSavingTargets(true);
    try {
      const res: any = await api.put('/overtime/cost-control-targets', {
        workMonth,
        targetMin: tMin,
        targetMax: tMax,
        strictGateEnabled: strictGate,
      });
      if (res?.success && res.data) {
        setRadar(res.data);
        toast.success(res.message || 'Target Efisiensi Anti-Boncos berhasil disimpan.');
        if (typeof onUpdated === 'function') onUpdated();
      } else {
        toast.error(res?.error || 'Gagal menyimpan target efisiensi');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Terjadi kesalahan saat menyimpan');
    } finally {
      setSavingTargets(false);
    }
  };

  const getZoneBadge = (zone: CostControlRadarResponse['zone']) => {
    switch (zone) {
      case 'RED_HARDCAP_65JT':
        return <Badge variant="destructive" className="text-[11px]">🔴 HARD CAP TERCAPAI — BLOKIR MUTLAK</Badge>;
      case 'ORANGE_KETAT_60JT':
        return <Badge className="bg-orange-600 text-white text-[11px]">🟠 ZONA KETAT (&gt; Rp 60 Jt) — KHUSUS PIMPINAN</Badge>;
      case 'YELLOW_WASPADA_55JT':
        return <Badge className="bg-amber-500 text-white text-[11px]">🟡 ZONA WASPADA (Rp 55–60 Jt) — REM APPROVAL</Badge>;
      default:
        return <Badge className="bg-emerald-600 text-white text-[11px]">🟢 ZONA AMAN (&le; Rp 55 Jt)</Badge>;
    }
  };

  const hardCap = radar?.budget.hardCap || 65000000;
  const approvedPct = radar ? Math.min(100, (radar.realization.approvedPay / hardCap) * 100) : 0;
  const committedPct = radar ? Math.min(100, (radar.realization.committedPay / hardCap) * 100) : 0;
  const targetMinPct = radar ? Math.min(100, (radar.budget.targetMin / hardCap) * 100) : 84.6;
  const targetMaxPct = radar ? Math.min(100, (radar.budget.targetMax / hardCap) * 100) : 92.3;

  return (
    <div className="space-y-5">
      <Card className="border-emerald-500/30 bg-gradient-to-br from-card via-card to-emerald-500/5 rounded-2xl shadow-xs">
        <CardHeader className="pb-3 border-b border-border/70">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                Radar Pengendalian Biaya &amp; Anti-Boncos Lembur Shipment
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Menjaga realisasi lembur Shipment tetap di zona efisiensi <strong>Rp 55–60 Juta</strong> (di bawah budget efektif <strong>Rp {(hardCap / 1e6).toFixed(0)} Juta</strong>) melalui proyeksi <em>daily burn-rate</em>, jatah aman harian, dan penguncian ketat persetujuan.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-xl px-2.5 h-8">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="month"
                  value={workMonth}
                  onChange={(e) => e.target.value && setWorkMonth(e.target.value)}
                  className="bg-transparent text-xs font-semibold focus:outline-none cursor-pointer"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchRadar(workMonth)}
                disabled={loading}
                className="h-8 text-xs rounded-xl gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Muat Ulang
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-5">
          {radar && (
            <>
              {/* 3-Zone Traffic Light Gauge */}
              <div className="p-4 rounded-xl bg-slate-950 text-white border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Status Kerja {formatYm(radar.workMonth)} (&rarr; Payroll {formatYm(radar.payrollMonth)})
                    </span>
                    {getZoneBadge(radar.zone)}
                  </div>
                  <div className="text-xs font-mono text-slate-300">
                    Hari ke-<strong>{radar.burnRate.elapsedDays}</strong> / {radar.burnRate.totalDays} (Sisa <strong>{radar.burnRate.remainingDays} hari</strong>)
                  </div>
                </div>

                {/* Progress Track with 55M & 60M Markers */}
                <div className="space-y-1.5">
                  <div className="relative w-full h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    {/* Committed (Approved + Pending) shadow bar */}
                    <div
                      className="absolute inset-y-0 left-0 bg-amber-400/35 transition-all duration-500"
                      style={{ width: `${committedPct}%` }}
                      title={`Approved + Pending: Rp ${radar.realization.committedPay.toLocaleString('id-ID')}`}
                    />
                    {/* Approved solid bar */}
                    <div
                      className={`relative h-full transition-all duration-500 ${
                        radar.zone === 'RED_HARDCAP_65JT'
                          ? 'bg-rose-500'
                          : radar.zone === 'ORANGE_KETAT_60JT'
                          ? 'bg-orange-500'
                          : radar.zone === 'YELLOW_WASPADA_55JT'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(1.5, approvedPct)}%` }}
                    />
                    {/* Marker 55jt */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-amber-300 z-10"
                      style={{ left: `${targetMinPct}%` }}
                      title={`Target Efisiensi Bawah: Rp ${radar.budget.targetMin.toLocaleString('id-ID')}`}
                    />
                    {/* Marker 60jt */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-rose-400 z-10"
                      style={{ left: `${targetMaxPct}%` }}
                      title={`Batas Ketat Atas: Rp ${radar.budget.targetMax.toLocaleString('id-ID')}`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Rp 0</span>
                    <span className="text-amber-300 font-semibold">
                      Target Min: Rp {(radar.budget.targetMin / 1e6).toFixed(0)} Jt ({targetMinPct.toFixed(0)}%)
                    </span>
                    <span className="text-orange-300 font-semibold">
                      Batas Ketat: Rp {(radar.budget.targetMax / 1e6).toFixed(0)} Jt ({targetMaxPct.toFixed(0)}%)
                    </span>
                    <span className="text-rose-300 font-semibold">
                      Hard Cap: Rp {(radar.budget.hardCap / 1e6).toFixed(0)} Jt
                    </span>
                  </div>
                </div>

                {/* 4 KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[11px] text-slate-300">Realisasi Sah (Approved)</p>
                    <p className="text-lg font-extrabold font-mono text-white mt-0.5">
                      Rp {radar.realization.approvedPay.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {radar.realization.approvedHours} jam ({radar.realization.approvedCount} SPKL)
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[11px] text-slate-300">Antrean Pending + Total Komitmen</p>
                    <p className="text-lg font-extrabold font-mono text-amber-300 mt-0.5">
                      Rp {radar.realization.committedPay.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-amber-200/80 font-mono">
                      Pending: Rp {radar.realization.pendingPay.toLocaleString('id-ID')} ({radar.realization.pendingCount} SPKL)
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-[11px] text-slate-300 flex items-center gap-1">
                      {radar.burnRate.isProjectedBoncos ? (
                        <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      Proyeksi Akhir Bulan (Burn-Rate)
                    </p>
                    <p
                      className={`text-lg font-extrabold font-mono mt-0.5 ${
                        radar.burnRate.isProjectedBoncos ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      Rp {radar.burnRate.projectedMonthEndPay.toLocaleString('id-ID')}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Rata-rata Rp {radar.burnRate.dailyAvgPay.toLocaleString('id-ID')}/hari
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30">
                    <p className="text-[11px] text-emerald-200 font-semibold">Jatah Harian Aman (&le; Rp 60 Jt)</p>
                    <p className="text-lg font-extrabold font-mono text-emerald-300 mt-0.5">
                      Rp {radar.burnRate.safeDailyPayForTargetMax.toLocaleString('id-ID')}/hari
                    </p>
                    <p className="text-[10px] text-emerald-200/80 font-mono">
                      Maks ~<strong>{radar.burnRate.safeDailyHoursForTargetMax} jam/hari</strong> (tim Shipment)
                    </p>
                  </div>
                </div>
              </div>

              {/* Guardrail Threshold Configuration */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/30 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    {strictGate ? <Lock className="w-3.5 h-3.5 text-emerald-600" /> : <Unlock className="w-3.5 h-3.5 text-amber-600" />}
                    Pengaturan Rem Otomatis &amp; Target Efisiensi Bulanan
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Saat <strong>Strict Gate</strong> aktif, persetujuan SPKL oleh Korlap/Admin otomatis ditahan begitu total menyentuh Batas Ketat Atas (Rp 60 jt).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Target Aman (Rp):</span>
                    <Input
                      type="number"
                      step={500000}
                      value={targetMinInput}
                      onChange={(e) => setTargetMinInput(e.target.value)}
                      className="h-8 w-28 text-xs font-mono rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">Batas Ketat (Rp):</span>
                    <Input
                      type="number"
                      step={500000}
                      value={targetMaxInput}
                      onChange={(e) => setTargetMaxInput(e.target.value)}
                      className="h-8 w-28 text-xs font-mono rounded-lg"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={strictGate ? 'default' : 'outline'}
                    onClick={() => setStrictGate((v) => !v)}
                    className={`h-8 text-xs rounded-lg gap-1 ${strictGate ? 'bg-slate-800 text-white' : ''}`}
                  >
                    {strictGate ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {strictGate ? 'Strict Lock: ON' : 'Strict Lock: OFF'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSaveTargets}
                    disabled={savingTargets}
                    className="h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {savingTargets ? 'Menyimpan...' : 'Simpan Guardrail'}
                  </Button>
                </div>
              </div>

              {/* Recommendations Box */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <Lightbulb className="w-4 h-4" />
                  Rekomendasi Tindakan Penghematan Sistem ({formatYm(radar.workMonth)})
                </div>
                <ul className="space-y-1.5 text-xs text-foreground">
                  {radar.savingsRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bottom 2-Column Cost Drivers & Pending Queue */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Spenders */}
                <div className="border border-border rounded-xl overflow-hidden bg-card">
                  <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      Top Serapan Jam Lembur Shipment
                    </span>
                    <span className="text-[10px] text-muted-foreground">Batas SK: 30j Normal / 56j Day</span>
                  </div>
                  <div className="divide-y divide-border text-xs">
                    {radar.topSpenders.length === 0 ? (
                      <p className="p-6 text-center text-muted-foreground">Belum ada realisasi lembur Shipment pada bulan ini.</p>
                    ) : (
                      radar.topSpenders.map((s) => (
                        <div key={s.userId} className="px-3.5 py-2 flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-foreground">{s.fullName}</div>
                            <div className="text-[10.5px] font-mono text-muted-foreground">
                              {s.nip} • {s.rawApprovedHours}/{s.maxHoursCap}j ({s.utilizationPct}%) • {s.spklApprovedCount} SPKL
                            </div>
                          </div>
                          <div className="text-right font-mono font-bold text-foreground">
                            Rp {s.calculatedPay.toLocaleString('id-ID')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* High-Cost Pending Queue */}
                <div className="border border-border rounded-xl overflow-hidden bg-card">
                  <div className="px-3.5 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Antrean Pending SPKL Shipment ({radar.realization.pendingCount})
                    </span>
                    <span className="text-[10.5px] font-mono font-semibold text-amber-600">
                      Total: Rp {radar.realization.pendingPay.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="divide-y divide-border text-xs">
                    {radar.pendingQueue.length === 0 ? (
                      <p className="p-6 text-center text-muted-foreground">Tidak ada antrean pending Shipment pada bulan ini.</p>
                    ) : (
                      radar.pendingQueue.map((p) => (
                        <div key={p.id} className="px-3.5 py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground truncate">
                              {p.userName} ({p.userNip})
                            </div>
                            <div className="text-[10.5px] text-muted-foreground truncate">
                              {p.date} • {p.durationHours}j — {p.taskDescription}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge variant="outline" className="font-mono text-[10.5px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                              Rp {p.compensationAmount.toLocaleString('id-ID')}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
