import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { Division, UserProfile } from '@/types/hrm';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  AlertCircle,
  MapPin,
  Crosshair,
  ExternalLink,
  CheckCircle2,
  User,
  Shield,
  Mail,
  Phone,
  QrCode,
  Copy,
  Check,
  Timer,
  Monitor,
  Calendar,
  CalendarDays,
  Download,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  generateSmartRoster,
  DEFAULT_SHIFTS,
  GenerationResult,
  EmployeeScheduleTarget,
} from '@/services/rosterSchedulerService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import QRCode from 'qrcode';

export const HrmDivisionsPage: React.FC = () => {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [divisionEmployeesMap, setDivisionEmployeesMap] = useState<Record<string, UserProfile[]>>({});

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiv, setEditingDiv] = useState<Division | null>(null);

  // Terminal Barcode Modal
  const [terminalModalOpen, setTerminalModalOpen] = useState(false);
  const [selectedTerminalDiv, setSelectedTerminalDiv] = useState<Division | null>(null);
  const [terminalQrData, setTerminalQrData] = useState<{ code: string; expiresAt: number; remainingSeconds: number } | null>(null);
  const [terminalQrImageUrl, setTerminalQrImageUrl] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState(false);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [leader, setLeader] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number>(-6.225);
  const [longitude, setLongitude] = useState<number>(106.809);
  const [radiusMeters, setRadiusMeters] = useState<number>(150);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Employee List Modal for specific division
  const [viewEmployeesDiv, setViewEmployeesDiv] = useState<Division | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);

  // Smart Roster AI Modal State
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [rosterSelectedDivId, setRosterSelectedDivId] = useState<string>('all');
  const [rosterMonth, setRosterMonth] = useState<number>(new Date().getMonth() + 1);
  const [rosterYear, setRosterYear] = useState<number>(new Date().getFullYear());
  const [rosterQuotaPagi, setRosterQuotaPagi] = useState<number>(2);
  const [rosterQuotaSiang, setRosterQuotaSiang] = useState<number>(2);
  const [rosterQuotaMalam, setRosterQuotaMalam] = useState<number>(1);
  const [rosterMaxStreak, setRosterMaxStreak] = useState<number>(5);
  const [rosterResult, setRosterResult] = useState<GenerationResult | null>(null);

  const handleRunRosterScheduler = () => {
    let targetEmployees: EmployeeScheduleTarget[] = [];
    if (rosterSelectedDivId === 'all') {
      targetEmployees = users.map((u) => ({
        id: u.id,
        name: u.fullName,
        position: u.roleName,
        divisionId: u.divisionId,
      }));
    } else {
      const emps = divisionEmployeesMap[rosterSelectedDivId] || [];
      targetEmployees = emps.map((u) => ({
        id: u.id,
        name: u.fullName,
        position: u.roleName,
        divisionId: u.divisionId,
      }));
    }

    const res = generateSmartRoster({
      month: rosterMonth,
      year: rosterYear,
      employees: targetEmployees,
      requiredPerShift: {
        pagi: rosterQuotaPagi,
        siang: rosterQuotaSiang,
        malam: rosterQuotaMalam,
      },
      maxConsecutiveWorkDays: rosterMaxStreak,
    });
    setRosterResult(res);
  };

  const handleExportRosterCsv = () => {
    if (!rosterResult) return;
    const days = Array.from({ length: rosterResult.daysInMonth }, (_, i) => i + 1);
    const headers = ['Nama Karyawan', ...days.map((d) => `Tgl ${d}`), 'Total Jam', 'Hari Kerja', 'Shift Malam'];
    const rows = rosterResult.rosters.map((r) => {
      const dayValues = days.map((d) => {
        const dateStr = `${rosterResult.year}-${String(rosterResult.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return r.assignments[dateStr]?.shiftCode || 'OFF';
      });
      return [r.employeeName, ...dayValues, r.totalWorkHours, r.totalWorkDays, r.totalNightShifts];
    });
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roster_shift_${rosterResult.month}_${rosterResult.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const loadData = () => {
    const divs = hrmService.getDivisions();
    setDivisions(divs);

    const users = hrmService.getUsers();
    const map: Record<string, UserProfile[]> = {};
    divs.forEach((d) => {
      map[d.id] = users.filter((u) => u.divisionId === d.id);
    });
    setDivisionEmployeesMap(map);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update dynamic terminal barcode every second when terminal modal is open
  useEffect(() => {
    if (!terminalModalOpen || !selectedTerminalDiv) return;

    const updateQr = () => {
      const qr = hrmService.getDynamicOfficeQrCode(selectedTerminalDiv.id);
      setTerminalQrData(qr);
    };

    updateQr();
    const interval = setInterval(updateQr, 1000);
    return () => clearInterval(interval);
  }, [terminalModalOpen, selectedTerminalDiv]);

  // Generate square 2D QR Code image
  useEffect(() => {
    if (!terminalModalOpen || !terminalQrData?.code) return;
    QRCode.toDataURL(terminalQrData.code, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setTerminalQrImageUrl(url))
      .catch((err) => console.error('Failed generating terminal QR code:', err));
  }, [terminalQrData?.code, terminalModalOpen]);

  const handleOpenTerminal = (d: Division) => {
    setSelectedTerminalDiv(d);
    setTerminalQrData(hrmService.getDynamicOfficeQrCode(d.id));
    setCopiedToken(false);
    setTerminalModalOpen(true);
  };

  const handleCopyToken = () => {
    if (terminalQrData) {
      navigator.clipboard.writeText(terminalQrData.code);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleOpenAdd = () => {
    const defaultOffice = hrmService.getOfficeLocation();
    setEditingDiv(null);
    setCode('');
    setName('');
    setDesc('');
    setLeader('');
    setLocationName('');
    setAddress(defaultOffice?.address || '');
    setLatitude(defaultOffice?.latitude || -6.225);
    setLongitude(defaultOffice?.longitude || 106.809);
    setRadiusMeters(150);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (d: Division) => {
    setEditingDiv(d);
    setCode(d.code);
    setName(d.name);
    setDesc(d.description || '');
    setLeader(d.leaderName || '');
    setLocationName(d.locationName || `Gedung Kantor Divisi ${d.name}`);
    setAddress(d.address || '');
    setLatitude(typeof d.latitude === 'number' ? d.latitude : -6.225);
    setLongitude(typeof d.longitude === 'number' ? d.longitude : 106.809);
    setRadiusMeters(d.radiusMeters || 150);
    setError(null);
    setModalOpen(true);
  };

  const handleGetCoordinates = () => {
    if (!navigator.geolocation) {
      alert('Geolokasi tidak didukung oleh browser Anda.');
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setGettingLocation(false);
      },
      (err) => {
        alert('Gagal mengambil titik GPS: ' + err.message);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (!code.trim()) {
      setError('Kode divisi wajib diisi (misal: IT, HRD, FIN)');
      return;
    }
    if (!name.trim()) {
      setError('Nama divisi wajib diisi');
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<Division> = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: desc.trim(),
        leaderName: leader.trim(),
        locationName: locationName.trim() || `Lokasi Divisi ${name.trim()}`,
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters: Number(radiusMeters) || 150,
      };

      if (editingDiv) {
        await hrmService.updateDivision(editingDiv.id, payload);
      } else {
        await hrmService.addDivision(payload as any);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan divisi ke database');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Division) => {
    const emps = divisionEmployeesMap[d.id] || [];
    if (emps.length > 0) {
      alert(`Divisi "${d.name}" tidak dapat dihapus karena masih memiliki ${emps.length} karyawan terdaftar.`);
      return;
    }
    if (confirm(`Hapus divisi "${d.name}"? Data akan dihapus permanen dari database.`)) {
      try {
        await hrmService.deleteDivision(d.id);
        loadData();
      } catch (err: any) {
        alert('Gagal menghapus divisi: ' + (err.message || 'Terjadi kesalahan database'));
      }
    }
  };

  const handleViewEmployees = (d: Division) => {
    setViewEmployeesDiv(d);
    setEmployeeModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Manajemen Divisi & Departemen
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Kelola struktur departemen dan penempatan unit kerja karyawan.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => {
              setRosterSelectedDivId('all');
              setRosterModalOpen(true);
              handleRunRosterScheduler();
            }}
            className="rounded-xl gap-2 font-medium border-border hover:bg-muted text-foreground shadow-xs text-xs h-9"
          >
            <CalendarDays className="w-4 h-4 text-primary" />
            Jadwal Shift
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Tambah Divisi
          </Button>
        </div>
      </div>

      {/* Division Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {divisions.map((d) => {
          const emps = divisionEmployeesMap[d.id] || [];
          const hasCoordinates = typeof d.latitude === 'number' && typeof d.longitude === 'number';

          return (
            <Card key={d.id} className="border-border bg-card rounded-xl shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md uppercase">
                      {d.code}
                    </span>
                    <CardTitle className="text-base font-semibold text-foreground mt-2">
                      {d.name}
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewEmployees(d)}
                    className="flex items-center gap-1.5 text-xs text-foreground bg-muted/40 h-7 px-2.5 rounded-lg border-border hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>{emps.length} Karyawan</span>
                  </Button>
                </div>

                <CardDescription className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {d.description || 'Tidak ada keterangan khusus.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Geofencing Location Coordinates Box */}
                <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{d.locationName || `Lokasi Divisi ${d.name}`}</span>
                    </div>
                    {hasCoordinates && (
                      <a
                        href={`https://www.google.com/maps?q=${d.latitude},${d.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                        title="Buka Peta"
                      >
                        Peta <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  {hasCoordinates ? (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                      <span>
                        {d.latitude?.toFixed(4)}, {d.longitude?.toFixed(4)}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-background border-border text-foreground font-sans px-1.5 py-0">
                        Radius {d.radiusMeters || 150}m
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Koordinat belum diatur (menggunakan kantor pusat)
                    </p>
                  )}
                </div>

                {/* Employees Preview in this Division */}
                <div className="border-t border-border pt-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Staf Divisi ({emps.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleViewEmployees(d)}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Lihat Semua
                    </button>
                  </div>

                  {emps.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">Belum ada karyawan di divisi ini</p>
                  ) : (
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {emps.slice(0, 4).map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center gap-1 bg-muted/40 border border-border px-2 py-1 rounded-lg text-[11px] truncate max-w-[120px]"
                          title={`${emp.fullName} (${emp.nip})`}
                        >
                          {emp.avatarUrl ? (
                            <img src={emp.avatarUrl} alt={emp.fullName} className="w-4 h-4 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[9px] shrink-0">
                              {emp.fullName.charAt(0)}
                            </div>
                          )}
                          <span className="truncate text-foreground font-medium">{emp.fullName.split(' ')[0]}</span>
                        </div>
                      ))}
                      {emps.length > 4 && (
                        <span className="text-[10px] text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded-md">
                          +{emps.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions: Terminal & Smart Roster */}
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenTerminal(d)}
                    className="gap-1.5 rounded-xl border-primary/30 text-primary hover:bg-primary/10 hover:text-primary font-semibold text-xs h-8 shadow-xs"
                    title="Buka Layar Terminal Barcode Dinamis untuk Divisi ini"
                  >
                    <QrCode className="w-3.5 h-3.5 text-primary" />
                    Terminal QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRosterSelectedDivId(d.id);
                      setRosterModalOpen(true);
                      const emps = divisionEmployeesMap[d.id] || [];
                      const res = generateSmartRoster({
                        month: rosterMonth,
                        year: rosterYear,
                        employees: emps.map((u) => ({ id: u.id, name: u.fullName, position: u.roleName })),
                        requiredPerShift: { pagi: rosterQuotaPagi, siang: rosterQuotaSiang, malam: rosterQuotaMalam },
                        maxConsecutiveWorkDays: rosterMaxStreak,
                      });
                      setRosterResult(res);
                    }}
                    className="gap-1.5 rounded-xl border-border text-foreground hover:bg-muted font-medium text-xs h-8 shadow-xs"
                    title="Buat Jadwal Roster Shift untuk Divisi ini"
                  >
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                    Jadwal Shift
                  </Button>
                </div>

                {/* Division Leader & Action Buttons */}
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                    Kepala: <span className="font-semibold text-foreground">{d.leaderName || '-'}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(d)}
                      className="h-8 w-8 p-0 rounded-lg text-primary border-primary/20 hover:bg-primary/10 transition-colors"
                      title="Ubah Data & Koordinat GPS Divisi"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(d)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Hapus Divisi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Dialog with Per-Division Geofencing Coordinates */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editingDiv ? `Ubah Divisi & Titik GPS: ${editingDiv.name}` : 'Tambah Divisi & Titik Koordinat'}
            </DialogTitle>
            <DialogDescription>
              Tentukan identitas divisi beserta titik koordinat GPS khusus untuk absensi karyawan di divisi ini.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 my-2">
            {/* Identity Group */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="code" className="text-xs font-semibold">
                  Kode Divisi
                </Label>
                <Input
                  id="code"
                  placeholder="IT"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-xs uppercase font-mono rounded-xl"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <Label htmlFor="name" className="text-xs font-semibold">
                  Nama Divisi
                </Label>
                <Input
                  id="name"
                  placeholder="Teknologi Informasi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="leader" className="text-xs font-semibold">
                Nama Kepala Divisi (Opsional)
              </Label>
              <Input
                id="leader"
                placeholder="misal: Rian Pratama, S.Kom"
                value={leader}
                onChange={(e) => setLeader(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="desc" className="text-xs font-semibold">
                Deskripsi
              </Label>
              <Textarea
                id="desc"
                placeholder="Fungsi dan tanggung jawab divisi..."
                rows={2}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            {/* GEOFENCING & COORDINATES SECTION */}
            <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  Titik Koordinat Lokasi Divisi (Geofencing)
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGetCoordinates}
                  disabled={gettingLocation}
                  className="h-7 text-xs gap-1.5 border-border rounded-lg"
                >
                  <Crosshair className="w-3 h-3 text-primary" />
                  {gettingLocation ? 'Mencari...' : 'Deteksi GPS Saya'}
                </Button>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Nama Lokasi / Gedung Divisi</Label>
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Contoh: Gedung Rektorat Lt. 2 / Kantor Cabang Barat"
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Alamat Kantor Divisi</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. Thamrin No. 10..."
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Latitude (Lintang)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    className="text-xs font-mono rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Longitude (Bujur)</Label>
                  <Input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    className="text-xs font-mono rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Radius Batas Presensi (Meter)</Label>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={radiusMeters}
                  onChange={(e) => setRadiusMeters(Number(e.target.value))}
                  className="text-xs rounded-xl"
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Karyawan divisi ini wajib berada dalam radius {radiusMeters} meter dari titik koordinat ini untuk presensi.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
            >
              {saving ? 'Menyimpan ke Database...' : 'Simpan Divisi & Koordinat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Division Employees Viewer Modal */}
      <Dialog open={employeeModalOpen} onOpenChange={setEmployeeModalOpen}>
        <DialogContent className="max-w-xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Daftar Karyawan: {viewEmployeesDiv?.name}
            </DialogTitle>
            <DialogDescription>
              Karyawan yang saat ini terdaftar dan bernaung di divisi {viewEmployeesDiv?.name} ({viewEmployeesDiv?.code}).
            </DialogDescription>
          </DialogHeader>

          {/* Division Location Info Bar */}
          {viewEmployeesDiv && (
            <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">{viewEmployeesDiv.locationName || 'Lokasi Divisi'}</p>
                  <p className="text-[11px]">
                    {viewEmployeesDiv.latitude?.toFixed(4)}, {viewEmployeesDiv.longitude?.toFixed(4)} (Radius {viewEmployeesDiv.radiusMeters || 150}m)
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                {(divisionEmployeesMap[viewEmployeesDiv.id] || []).length} Karyawan
              </Badge>
            </div>
          )}

          <div className="space-y-2.5 my-2">
            {viewEmployeesDiv && (divisionEmployeesMap[viewEmployeesDiv.id] || []).length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs">
                Belum ada karyawan yang ditempatkan pada divisi ini.
              </div>
            ) : (
              viewEmployeesDiv &&
              (divisionEmployeesMap[viewEmployeesDiv.id] || []).map((emp) => (
                <div
                  key={emp.id}
                  className="p-3 bg-card border border-border rounded-xl flex items-center justify-between gap-3 hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {emp.avatarUrl ? (
                      <img
                        src={emp.avatarUrl}
                        alt={emp.fullName}
                        className="w-10 h-10 rounded-full object-cover border border-primary/20 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                        {emp.fullName.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground text-xs truncate">{emp.fullName}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-foreground border-border uppercase">
                          {emp.roleName || 'karyawan'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        <span className="font-mono">NIP: {emp.nip}</span>
                        <span>•</span>
                        <span className="truncate">{emp.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge
                      variant="outline"
                      className={
                        emp.isActive
                          ? 'bg-primary/10 text-primary border-primary/20 text-[10px]'
                          : 'bg-muted text-muted-foreground border-border text-[10px]'
                      }
                    >
                      {emp.isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setEmployeeModalOpen(false)} className="rounded-xl">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── TERMINAL BARCODE MODAL PER-DIVISI (DYNAMIC 10-SECOND ROTATION) ─── */}
      <Dialog open={terminalModalOpen} onOpenChange={setTerminalModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <Monitor className="w-5 h-5 text-primary" />
                Terminal Barcode: {selectedTerminalDiv?.name}
              </DialogTitle>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] animate-pulse">
                🟢 Live Dynamic Token
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Monitor terminal lobi khusus Divisi {selectedTerminalDiv?.name}. Token berputar otomatis tiap 10 detik.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Visual Barcode / QR Display Box */}
            <div className="p-6 bg-slate-900 text-white rounded-2xl flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-3">
                SCAN DENGAN HP KARYAWAN
              </span>

              {/* Real 2D Square QR Code Graphic */}
              <div className="p-3 bg-white rounded-2xl shadow-lg border-4 border-emerald-500/40 inline-flex items-center justify-center transition-transform hover:scale-[1.02]">
                {terminalQrImageUrl ? (
                  <img
                    src={terminalQrImageUrl}
                    alt="QR Code Terminal Divisi"
                    className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-xl text-slate-400 text-xs font-medium">
                    Membuat Kode QR...
                  </div>
                )}
              </div>

              {/* Text Token Fallback */}
              <div className="text-center mt-3.5 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Token Alternatif (Input Manual):
                </span>
                <div className="text-lg sm:text-xl font-mono font-bold tracking-widest text-emerald-400 bg-black/40 px-4 py-1.5 rounded-xl border border-emerald-500/30 select-all inline-block">
                  {terminalQrData?.code || 'MEMUAT...'}
                </div>
              </div>

              {/* Progress timer bar */}
              <div className="w-full max-w-[260px] mt-3.5 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3 text-emerald-400" /> Rotasi Otomatis
                  </span>
                  <span className="font-mono font-bold text-white">
                    {terminalQrData?.remainingSeconds || 0} detik tersisa
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-1000 ease-linear rounded-full"
                    style={{
                      width: `${(((terminalQrData?.remainingSeconds || 10) / 10) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Division Geolocation Info */}
            <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Titik Koordinat Divisi:</span>
                <span className="font-mono font-semibold text-foreground">
                  {selectedTerminalDiv?.latitude?.toFixed(5) || -6.225}, {selectedTerminalDiv?.longitude?.toFixed(5) || 106.809}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Radius Geofence:</span>
                <span className="font-semibold text-foreground">
                  {selectedTerminalDiv?.radiusMeters || 150} Meter
                </span>
              </div>
              <div className="pt-1 border-t border-border/60 text-[11px] text-muted-foreground truncate">
                📍 {selectedTerminalDiv?.address || 'Alamat Kantor'}
              </div>
            </div>

            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-900 dark:text-blue-200">
              💡 Pasang tablet/layar ini di area resepsionis divisi. Karyawan wajib melakukan selfie terlebih dahulu sebelum memindai barcode ini.
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCopyToken}
              className="rounded-xl text-xs gap-1.5 h-9"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedToken ? 'Tersalin!' : 'Salin Token'}
            </Button>
            <Button
              onClick={() => setTerminalModalOpen(false)}
              className="rounded-xl text-xs h-9 font-semibold"
            >
              Tutup Terminal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── SMART ROSTER AI GENERATOR MODAL ─── */}
      <Dialog open={rosterModalOpen} onOpenChange={setRosterModalOpen}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[92vh] flex flex-col p-6 rounded-2xl border border-border shadow-2xl overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border/80 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Matriks Penjadwalan Shift Karyawan
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Optimasi penjadwalan shift mematuhi regulasi UU Ketenagakerjaan: minimal 11 jam istirahat antar-shift, proteksi turnaround malam-ke-pagi, dan pemerataan beban kerja.
                </DialogDescription>
              </div>

              {rosterResult && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs gap-1 py-1">
                    <ShieldCheck size={13} /> {rosterResult.audit.laborLawCompliance ? '100% Patuh UU' : 'Perlu Penyesuaian'}
                  </Badge>
                  <Badge variant="outline" className="font-mono text-xs py-1">
                    Pemerataan: {rosterResult.audit.fairnessIndex}%
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportRosterCsv}
                    className="rounded-xl text-xs gap-1.5 h-8 border-border"
                  >
                    <Download size={13} /> Export CSV
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Controls Bar */}
          <div className="py-3 shrink-0 grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-muted/20 p-3 rounded-xl border border-border/70 text-xs">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-[11px] font-semibold text-muted-foreground">Pilih Divisi</Label>
              <Select value={rosterSelectedDivId} onValueChange={setRosterSelectedDivId}>
                <SelectTrigger className="rounded-xl text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Divisi ({users.length} Karyawan)</SelectItem>
                  {divisions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({(divisionEmployeesMap[d.id] || []).length} Staf)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Bulan</Label>
              <Select value={String(rosterMonth)} onValueChange={(v) => setRosterMonth(Number(v))}>
                <SelectTrigger className="rounded-xl text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(
                    (m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {m}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Target / Shift</Label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  title="Shift Pagi"
                  value={rosterQuotaPagi}
                  onChange={(e) => setRosterQuotaPagi(Math.max(1, Number(e.target.value)))}
                  className="rounded-xl text-xs h-8 px-1.5 text-center font-mono"
                  placeholder="P"
                />
                <Input
                  type="number"
                  title="Shift Siang"
                  value={rosterQuotaSiang}
                  onChange={(e) => setRosterQuotaSiang(Math.max(1, Number(e.target.value)))}
                  className="rounded-xl text-xs h-8 px-1.5 text-center font-mono"
                  placeholder="S"
                />
                <Input
                  type="number"
                  title="Shift Malam"
                  value={rosterQuotaMalam}
                  onChange={(e) => setRosterQuotaMalam(Math.max(0, Number(e.target.value)))}
                  className="rounded-xl text-xs h-8 px-1.5 text-center font-mono"
                  placeholder="M"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">Maks. Hari Beruntun</Label>
              <Input
                type="number"
                value={rosterMaxStreak}
                onChange={(e) => setRosterMaxStreak(Math.max(2, Number(e.target.value)))}
                className="rounded-xl text-xs h-8 font-mono text-center"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleRunRosterScheduler}
                className="w-full rounded-xl text-xs h-8 font-semibold gap-1.5 shadow-xs"
              >
                <Calendar size={13} /> Susun Jadwal
              </Button>
            </div>
          </div>

          {/* Roster Calendar Matrix */}
          <div className="flex-1 overflow-auto border border-border/80 rounded-xl my-2">
            {!rosterResult || rosterResult.rosters.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs">
                Klik tombol <strong>Susun Jadwal</strong> untuk menyusun matriks shift secara otomatis.
              </div>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/60 border-b border-border text-[11px]">
                    <th className="sticky left-0 bg-muted/95 z-20 px-3 py-2 text-left font-bold min-w-[170px] border-r border-border">
                      Karyawan
                    </th>
                    {Array.from({ length: rosterResult.daysInMonth }, (_, i) => i + 1).map((d) => (
                      <th key={d} className="px-1 py-1.5 text-center font-mono min-w-[32px] border-r border-border/40">
                        {d}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-bold bg-muted/80 min-w-[65px] border-r border-border/60">
                      Total Jam
                    </th>
                    <th className="px-2 py-2 text-center font-bold bg-muted/80 min-w-[60px] border-r border-border/60">
                      Hari Kerja
                    </th>
                    <th className="px-2 py-2 text-center font-bold bg-muted/80 min-w-[60px]">
                      Shift Malam
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                  {rosterResult.rosters.map((r) => (
                    <tr key={r.employeeId} className="hover:bg-muted/20 transition-colors">
                      <td className="sticky left-0 bg-card z-10 px-3 py-2 font-sans font-semibold text-foreground border-r border-border truncate">
                        {r.employeeName}
                      </td>
                      {Array.from({ length: rosterResult.daysInMonth }, (_, i) => i + 1).map((d) => {
                        const dateStr = `${rosterResult.year}-${String(rosterResult.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const asg = r.assignments[dateStr];
                        const code = asg?.shiftCode || 'OFF';

                        let badgeCls = 'bg-muted text-muted-foreground/60';
                        if (code === 'P') badgeCls = 'bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold';
                        else if (code === 'S') badgeCls = 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold';
                        else if (code === 'M') badgeCls = 'bg-purple-500/25 text-purple-700 dark:text-purple-300 font-extrabold';

                        return (
                          <td key={d} className="p-0.5 text-center border-r border-border/30">
                            <span className={`inline-block w-full py-1 rounded text-[10px] ${badgeCls}`}>
                              {code}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-center font-bold text-foreground border-r border-border/60 bg-muted/10">
                        {r.totalWorkHours} Jam
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-foreground border-r border-border/60 bg-muted/10">
                        {r.totalWorkDays} Hari
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold text-purple-600 bg-muted/10">
                        {r.totalNightShifts} Kali
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Legend & Compliance Footer */}
          <div className="pt-2 border-t border-border/70 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-[11px] font-semibold">Keterangan Shift:</span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" /> P (Pagi 07:00-15:00)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" /> S (Siang 15:00-23:00)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-purple-600" /> M (Malam 23:00-07:00)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-muted-foreground/40" /> OFF (Libur)
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRosterModalOpen(false)}
              className="rounded-xl text-xs h-8"
            >
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
