import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService, getTodayDateStr } from '@/services/hrmService';
import { AttendanceRecord, LeaveRequest } from '@/types/hrm';
import { UserCheck, Clock, FileCheck2, Users, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

interface HrmHrdDashboardProps {
  onSwitchToPwa?: () => void;
}

export const HrmHrdDashboard: React.FC<HrmHrdDashboardProps> = ({ onSwitchToPwa }) => {
  const { user } = useHrmAuth();
  const [todayAttendances, setTodayAttendances] = useState<AttendanceRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);

  useEffect(() => {
    const today = getTodayDateStr();
    const atts = hrmService.getAttendances(today);
    setTodayAttendances(atts);

    const leaves = hrmService.getLeaves();
    setPendingLeaves(leaves.filter((l) => l.status === 'pending'));

    setTotalEmployees(hrmService.getUsers().length);
  }, []);

  const hadirCount = todayAttendances.filter((a) => a.status === 'hadir').length;
  const telatCount = todayAttendances.filter((a) => a.status === 'terlambat').length;
  const belumHadirCount = Math.max(0, totalEmployees - (hadirCount + telatCount));

  return (
    <div className="space-y-6">
      {/* Header Banner - Clean Uniform Card */}
      <div className="bg-card border border-border rounded-2xl p-6 md:p-7 text-foreground shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Portal Manajemen Operasional HRD</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Dashboard Kehadiran Harian
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Pantau kepatuhan jam kerja karyawan, proses pengajuan cuti & izin yang tertunda, dan verifikasi absensi hari ini.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSwitchToPwa && (
              <Button
                variant="outline"
                onClick={onSwitchToPwa}
                className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs rounded-xl"
              >
                📱 Buka Presensi PWA
              </Button>
            )}
            <Link to="/admin/approval">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-sm rounded-xl">
                Proses Izin ({pendingLeaves.length})
              </Button>
            </Link>
            <Link to="/admin/monitoring">
              <Button variant="outline" className="border-border hover:bg-muted text-foreground text-xs rounded-xl">
                Live Monitoring
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Daily Metrics - Clean Uniform Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Hadir Tepat Waktu</p>
            <p className="text-2xl font-bold text-foreground mt-1">{hadirCount} Orang</p>
          </CardContent>
        </Card>

        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Terlambat Masuk</p>
            <p className="text-2xl font-bold text-foreground mt-1">{telatCount} Orang</p>
          </CardContent>
        </Card>

        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Belum Presensi</p>
            <p className="text-2xl font-bold text-foreground mt-1">{belumHadirCount} Orang</p>
          </CardContent>
        </Card>

        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Permohonan Izin</p>
            <p className="text-2xl font-bold text-foreground mt-1">{pendingLeaves.length} Antrian</p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Recent Check-ins */}
      <Card className="border-border rounded-xl shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Presensi Terbaru Hari Ini ({getTodayDateStr()})
            </CardTitle>
            <CardDescription className="text-xs">
              Daftar staf yang telah melakukan clock in hari ini.
            </CardDescription>
          </div>
          <Link to="/admin/monitoring">
            <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg">
              Lihat Semua <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          {todayAttendances.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              Belum ada karyawan yang presensi hari ini.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {todayAttendances.slice(0, 5).map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                      {a.userName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{a.userName}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{a.userNip} • {a.divisionName}</p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div>
                      <p className="font-mono font-bold text-foreground">{a.clockIn} WIB</p>
                      <p className="text-[10px] text-muted-foreground">Pulang: {a.clockOut || '--:--'}</p>
                    </div>
                    {a.status === 'terlambat' ? (
                      <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                        Telat {a.lateMinutes}m
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                        Tepat Waktu
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
