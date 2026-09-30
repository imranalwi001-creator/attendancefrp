import React, { useState, useEffect } from 'react';
import { hrmService } from '@/services/hrmService';
import { Role } from '@/types/hrm';
import { ShieldCheck, Plus, Trash2, Edit2, Check, AlertCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

const AVAILABLE_PERMISSIONS = [
  { id: 'all', label: 'Akses Penuh (Full Administrator)' },
  { id: 'self_attendance', label: 'Presensi Mandiri (Clock In/Out GPS + Selfie)' },
  { id: 'apply_leave', label: 'Pengajuan Cuti, Izin & Sakit Pribadi' },
  { id: 'manage_attendance', label: 'Live Monitoring Presensi Seluruh Karyawan' },
  { id: 'approve_leave', label: 'Approval Cuti & Izin Bawahan / Seluruh Karyawan' },
  { id: 'manage_employees', label: 'Pendaftaran & Manajemen Akun Karyawan' },
  { id: 'view_reports', label: 'Lihat Rekapitulasi Laporan Kehadiran' },
  { id: 'export_reports', label: 'Export Laporan ke Excel (.xlsx) / PDF' },
  { id: 'view_payroll_reports', label: 'Akses Rekapitulasi Khusus Payroll & Potongan Gaji' },
  { id: 'manage_settings', label: 'Konfigurasi Geofencing Kantor & Jam Kerja Shift' },
];

export const HrmRolesPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [usersCountByRole, setUsersCountByRole] = useState<Record<string, number>>({});

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Form State
  const [roleName, setRoleName] = useState('');
  const [roleLabel, setRoleLabel] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const loadRoles = () => {
    const r = hrmService.getRoles();
    setRoles(r);

    const users = hrmService.getUsers();
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      const rName = u.roleName?.toLowerCase();
      counts[rName] = (counts[rName] || 0) + 1;
    });
    setUsersCountByRole(counts);
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const handleOpenAdd = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleLabel('');
    setRoleDesc('');
    setSelectedPermissions(['self_attendance', 'apply_leave']);
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleLabel(role.label);
    setRoleDesc(role.description || '');
    setSelectedPermissions(role.permissions || []);
    setFormError(null);
    setModalOpen(true);
  };

  const togglePermission = (permId: string) => {
    if (selectedPermissions.includes(permId)) {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== permId));
    } else {
      setSelectedPermissions([...selectedPermissions, permId]);
    }
  };

  const handleSave = () => {
    setFormError(null);
    if (!roleName.trim()) {
      setFormError('Identifier role (kode unik) wajib diisi');
      return;
    }
    if (!roleLabel.trim()) {
      setFormError('Nama tampilan role wajib diisi');
      return;
    }

    const cleanKey = roleName.trim().toLowerCase().replace(/\s+/g, '_');

    try {
      if (editingRole) {
        hrmService.updateRole(editingRole.id, {
          label: roleLabel,
          description: roleDesc,
          permissions: selectedPermissions,
        });
      } else {
        if (roles.some((r) => r.name.toLowerCase() === cleanKey)) {
          setFormError(`Role dengan identifier '${cleanKey}' sudah ada.`);
          return;
        }

        hrmService.addRole({
          name: cleanKey,
          label: roleLabel,
          description: roleDesc,
          permissions: selectedPermissions,
        });
      }

      setModalOpen(false);
      loadRoles();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan role.');
    }
  };

  const handleDelete = (role: Role) => {
    if (role.isSystem) {
      alert('Role sistem bawaan tidak dapat dihapus');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus role "${role.label}"?`)) {
      try {
        hrmService.deleteRole(role.id);
        loadRoles();
      } catch (err: any) {
        alert(err.message || 'Gagal menghapus role');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Manajemen Role & Hak Akses
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Kelola peran pengguna (Keuangan, HRD, Pimpinan, dll.) dengan hak akses yang terstandarisasi.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-sm gap-2"
        >
          <Plus className="w-4 h-4" />
          Tambah Role Baru
        </Button>
      </div>

      {/* Role List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {roles.map((r) => {
          const userCount = usersCountByRole[r.name.toLowerCase()] || 0;
          return (
            <Card key={r.id} className="border-border bg-card rounded-xl shadow-sm flex flex-col justify-between hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                      {r.label}
                    </CardTitle>
                    <code className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md mt-1.5 inline-block">
                      role: {r.name}
                    </code>
                  </div>

                  {r.isSystem ? (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-muted/40 text-muted-foreground border-border rounded-md">
                      <Lock className="w-2.5 h-2.5" /> Bawaan
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] rounded-md">
                      Kustom
                    </Badge>
                  )}
                </div>

                <CardDescription className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {r.description || 'Tidak ada deskripsi.'}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="p-3 bg-muted/30 rounded-xl border border-border space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Pengguna Aktif:</span>
                    <span className="font-semibold text-foreground">{userCount} Orang</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Hak Akses:</span>
                    <span className="font-semibold text-foreground">
                      {r.permissions.includes('all') ? 'Akses Penuh' : `${r.permissions.length} Izin`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(r)}
                    className="h-8 w-8 p-0 rounded-lg text-primary border-primary/20 hover:bg-primary/10 transition-colors"
                    title="Ubah Hak Akses Role"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>

                  {!r.isSystem && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(r)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="Hapus Role"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add / Edit Role Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              {editingRole ? `Ubah Role: ${editingRole.label}` : 'Tambah Role Baru'}
            </DialogTitle>
            <DialogDescription>
              Tentukan nama role dan sesuaikan izin hak akses yang berlaku di aplikasi.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 my-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="roleName" className="text-xs font-semibold">
                  Identifier Role (Kode Sistem)
                </Label>
                <Input
                  id="roleName"
                  placeholder="misal: keuangan"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  disabled={!!editingRole}
                  className="text-xs font-mono rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="roleLabel" className="text-xs font-semibold">
                  Nama Tampilan Role
                </Label>
                <Input
                  id="roleLabel"
                  placeholder="misal: Manajer Keuangan"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="roleDesc" className="text-xs font-semibold">
                Deskripsi Tugas / Wewenang
              </Label>
              <Textarea
                id="roleDesc"
                rows={2}
                placeholder="Deskripsi singkat fungsi peran ini..."
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-semibold text-foreground">
                Pilih Hak Akses (Permissions):
              </Label>
              <div className="space-y-2">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const isChecked = selectedPermissions.includes(perm.id);
                  return (
                    <div
                      key={perm.id}
                      onClick={() => togglePermission(perm.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                          : 'border-border bg-card text-foreground hover:border-border/80'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md mt-0.5 flex items-center justify-center border transition-colors ${
                          isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-card'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="flex-1">{perm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
              {editingRole ? 'Simpan Perubahan' : 'Buat Role Baru'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
