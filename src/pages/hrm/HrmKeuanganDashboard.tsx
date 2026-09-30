import React, { useState, useEffect } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService } from '@/services/hrmService';
import { FileSpreadsheet, DollarSign, Clock, Download, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

export const HrmKeuanganDashboard: React.FC = () => {
  const { user } = useHrmAuth();
  const [attendances, setAttendances] = useState(hrmService.getAttendances());
  const [users, setUsers] = useState(hrmService.getUsers());

  useEffect(() => {
    setAttendances(hrmService.getAttendances());
    setUsers(hrmService.getUsers());
  }, []);

  const totalLateMinutes = attendances.reduce((acc, a) => acc + (a.lateMinutes || 0), 0);
  const totalWorkMinutes = attendances.reduce((acc, a) => acc + (a.workDurationMinutes || 0), 0);
  const totalWorkHours = (totalWorkMinutes / 60).toFixed(1);

  // 1-Click Payroll Export
  const handleExportPayroll = () => {
    const summary = users.map((u, idx) => {
      const userAtts = attendances.filter((a) => a.userId === u.id);
      const userPresent = userAtts.filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
      const userLateCount = userAtts.filter((a) => a.status === 'terlambat').length;
      const userLateMins = userAtts.reduce((acc, a) => acc + (a.lateMinutes || 0), 0);
      const userMins = userAtts.reduce((acc, a) => acc + (a.workDurationMinutes || 0), 0);
      const userHours = (userMins / 60).toFixed(2);

      return {
        No: idx + 1,
        NIP: u.nip,
        'Nama Karyawan': u.fullName,
        Divisi: u.divisionName || '-',
        'Jumlah Hadir (Hari)': userPresent,
        'Jumlah Terlambat': userLateCount,
        'Total Keterlambatan (Menit)': userLateMins,
        'Total Jam Kerja Bersih': userHours,
        'Sisa Cuti': (u.annualLeaveQuota || 12) - (u.usedLeaveDays || 0),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(summary);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Payroll Karyawan');
    XLSX.writeFile(workbook, `Rekap_Payroll_HRM_${new Date().toISOString().slice(0, 7)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Keuangan Header Card - Clean & Uniform */}
      <div className="bg-card border border-border rounded-2xl p-6 md:p-7 text-foreground shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Portal Keuangan & Penggajian (Payroll)</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Rekapitulasi Jam Kerja & Presensi
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Data akumulasi jam kerja bersih dan keterlambatan untuk dasar perhitungan gaji karyawan.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleExportPayroll}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-sm rounded-xl gap-2"
            >
              <Download className="w-4 h-4" /> Export Format Excel (.xlsx)
            </Button>
            <Link to="/admin/laporan">
              <Button variant="outline" className="border-border hover:bg-muted text-foreground text-xs rounded-xl">
                Detail Laporan
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Financial Payroll KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Total Jam Kerja</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalWorkHours} <span className="text-xs font-normal text-muted-foreground">Jam</span></p>
          </CardContent>
        </Card>

        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Keterlambatan</p>
            <p className="text-2xl font-bold text-foreground mt-1">{totalLateMinutes} <span className="text-xs font-normal text-muted-foreground">Menit</span></p>
          </CardContent>
        </Card>

        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Karyawan Terdaftar</p>
            <p className="text-2xl font-bold text-foreground mt-1">{users.length} Orang</p>
          </CardContent>
        </Card>

        <Card className="border-border rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Status Data</p>
            <p className="text-2xl font-bold text-primary mt-1">Siap Payroll</p>
          </CardContent>
        </Card>
      </div>

      {/* Preview Payroll Table */}
      <Card className="border-border rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              Tinjauan Akumulasi Jam Kerja per Karyawan
            </CardTitle>
            <CardDescription className="text-xs">
              Ringkasan kehadiran, akumulasi keterlambatan, dan jam kerja bersih.
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={handleExportPayroll}
            variant="outline"
            className="text-xs gap-1 border-border rounded-xl"
          >
            <Download className="w-3.5 h-3.5" /> Export Excel
          </Button>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 border-y border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4">Total Hadir</th>
                <th className="py-3 px-4">Terlambat</th>
                <th className="py-3 px-4">Akumulasi Jam Kerja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => {
                const userAtts = attendances.filter((a) => a.userId === u.id);
                const userPresent = userAtts.filter((a) => a.status === 'hadir' || a.status === 'terlambat').length;
                const userLateMins = userAtts.reduce((acc, a) => acc + (a.lateMinutes || 0), 0);
                const userMins = userAtts.reduce((acc, a) => acc + (a.workDurationMinutes || 0), 0);
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-semibold text-foreground">{u.fullName}</td>
                    <td className="py-3 px-4 font-mono text-muted-foreground">{u.nip}</td>
                    <td className="py-3 px-4 text-muted-foreground">{u.divisionName || '-'}</td>
                    <td className="py-3 px-4 font-medium text-foreground">{userPresent} Hari</td>
                    <td className="py-3 px-4">
                      {userLateMins > 0 ? (
                        <span className="font-semibold text-destructive">{userLateMins} Menit</span>
                      ) : (
                        <span className="text-muted-foreground">0 Menit</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {(userMins / 60).toFixed(1)} Jam
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
