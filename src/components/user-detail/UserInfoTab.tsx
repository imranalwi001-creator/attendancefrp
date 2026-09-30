import { useState } from 'react';
import { ContentCard, ContentCardBody } from '@/components/ui/content-card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { mockMapel } from '@/mocks/data';
import { Role } from '@/types';
import { ProfileInfoCard, ProfileField } from '@/components/profile';
import { UserInfoTabProps } from './types';
import { Edit, X, Save, Lock, UserCircle, GraduationCap } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    guru: 'Guru / Wali Kelas',
    walikelas: 'Wali Kelas',
    Pembina: 'Pembina',
    santri: 'Santri',
    orangtua: 'Orang Tua'
  };
  return labels[role] || role;
};

const getRoleBadgeVariant = (role: string) => {
  const variants: Record<string, any> = {
    admin: 'role-admin',
    guru: 'role-guru',
    walikelas: 'role-walikelas',
    Pembina: 'role-pembina',
    santri: 'role-santri',
    orangtua: 'role-orangtua'
  };
  return variants[role] || 'outline';
};

// Inline edit security settings component
function SecuritySettingsCard({
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isChangingPassword,
  handleChangePassword,
  disableEdit = false
}: {
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  isChangingPassword: boolean;
  handleChangePassword: () => void;
  disableEdit?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  const handleCancel = () => {
    setNewPassword('');
    setConfirmPassword('');
    setIsEditing(false);
  };

  const handleSave = async () => {
    await handleChangePassword();
    setIsEditing(false);
  };

  return (
    <ContentCard>
      <ExtractionCardHeader
        icon={<Lock className="h-4 w-4 text-primary" />}
        title="Pengaturan Keamanan"
        actions={
          !isEditing && !disableEdit ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="rounded-xl gap-2"
            >
              <Edit className="h-4 w-4" />
              Ubah Password
            </Button>
          ) : undefined
        }
      />
      <ContentCardBody>
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-border/50 bg-muted/30 space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium text-muted-foreground">
                  Password Baru
                </Label>
                <Input 
                  id="new-password" 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Masukkan password baru" 
                  className="rounded-lg border-0 bg-background" 
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Minimal 6 karakter</p>
              </div>

              <div className="p-4 rounded-2xl border border-border/50 bg-muted/30 space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium text-muted-foreground">
                  Konfirmasi Password
                </Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="Ulangi password baru" 
                  className="rounded-lg border-0 bg-background" 
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSave} 
                disabled={isChangingPassword || !newPassword || !confirmPassword} 
                className="rounded-xl gap-2"
              >
                <Save className="h-4 w-4" />
                {isChangingPassword ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isChangingPassword}
                className="rounded-xl gap-2"
              >
                <X className="h-4 w-4" />
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl border border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Password</p>
                <p className="text-sm text-muted-foreground">••••••••••</p>
              </div>
            </div>
          </div>
        )}
      </ContentCardBody>
    </ContentCard>
  );
}

// Inline edit general info component for staff/guru
function GeneralInfoCard({
  user,
  formData,
  setFormData,
  kelasList,
  userKelas,
  onSave,
  disableEdit = false
}: {
  user: UserInfoTabProps['user'];
  formData: UserInfoTabProps['formData'];
  setFormData: UserInfoTabProps['setFormData'];
  kelasList: UserInfoTabProps['kelasList'];
  userKelas: UserInfoTabProps['userKelas'];
  onSave: () => Promise<void>;
  disableEdit?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalData, setOriginalData] = useState(formData);

  const handleEdit = () => {
    setOriginalData({ ...formData });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ContentCard>
      <ExtractionCardHeader
        icon={<UserCircle className="h-4 w-4 text-primary" />}
        title="Informasi Umum"
        actions={
          !isEditing && !disableEdit ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="rounded-xl gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          ) : undefined
        }
      />
      <ContentCardBody>
        <div className="space-y-6">
          <div className="space-y-4">
            <div id="form_digiss" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">Email</Label>
                {isEditing ? (
                  <Input 
                    id="email" 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({ ...formData, email: e.target.value })} 
                    className="rounded-lg border-0 bg-background font-semibold" 
                  />
                ) : (
                  <p className="text-base font-semibold text-foreground">{formData.email || '-'}</p>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="employeeId" className="text-sm font-medium text-muted-foreground">ID Pegawai / NIP</Label>
                {isEditing ? (
                  <Input 
                    id="employeeId" 
                    value={formData.employeeId} 
                    onChange={e => setFormData({ ...formData, employeeId: e.target.value })} 
                    className="rounded-lg border-0 bg-background font-semibold" 
                  />
                ) : (
                  <p className="text-base font-semibold text-foreground">{formData.employeeId || '-'}</p>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">Nama Lengkap</Label>
                {isEditing ? (
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    className="rounded-lg border-0 bg-background font-semibold" 
                  />
                ) : (
                  <p className="text-base font-semibold text-foreground">{formData.name}</p>
                )}
              </div>

              <div className="flex flex-col justify-center space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="role" className="text-sm font-medium text-muted-foreground">Peran Pengguna</Label>
                {isEditing ? (
                  <Select 
                    value={formData.role} 
                    onValueChange={value => setFormData({ ...formData, role: value as Role })}
                  >
                    <SelectTrigger className="rounded-lg border-0 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrator</SelectItem>
                      <SelectItem value="guru">Guru / Wali Kelas</SelectItem>
                      <SelectItem value="walikelas">Wali Kelas</SelectItem>
                      <SelectItem value="Pembina">Pembina</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={getRoleBadgeVariant(formData.role)} className="w-fit">
                    {getRoleLabel(formData.role)}
                  </Badge>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="status" className="text-sm font-medium text-muted-foreground">Status Akun</Label>
                {isEditing ? (
                  <Select 
                    value={formData.status} 
                    onValueChange={value => setFormData({ ...formData, status: value as 'aktif' | 'nonaktif' | 'cuti' | 'alumni' })}
                  >
                    <SelectTrigger className="rounded-lg border-0 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="nonaktif">Nonaktif</SelectItem>
                      <SelectItem value="cuti">Cuti</SelectItem>
                      <SelectItem value="alumni">Alumni</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base font-semibold text-foreground capitalize">{formData.status}</p>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label className="text-sm font-medium text-muted-foreground">Tanggal Pendaftaran</Label>
                <p className="text-base font-semibold text-foreground">
                  {user?.createdAt ? format(new Date(user.createdAt), 'dd MMMM yyyy', { locale: localeId }) : '-'}
                </p>
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="jenisKelamin" className="text-sm font-medium text-muted-foreground">Jenis Kelamin</Label>
                {isEditing ? (
                  <Select 
                    value={formData.jenisKelamin} 
                    onValueChange={value => setFormData({ ...formData, jenisKelamin: value })}
                  >
                    <SelectTrigger className="rounded-lg border-0 bg-background">
                      <SelectValue placeholder="Pilih jenis kelamin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                      <SelectItem value="Perempuan">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base font-semibold text-foreground">{formData.jenisKelamin || '-'}</p>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="tempatTanggalLahir" className="text-sm font-medium text-muted-foreground">Tempat, Tanggal Lahir</Label>
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <Input 
                      id="tempatLahir" 
                      placeholder="Tempat lahir"
                      value={formData.tempatLahir} 
                      onChange={e => setFormData({ ...formData, tempatLahir: e.target.value })} 
                      className="rounded-lg border-0 bg-background font-semibold" 
                    />
                    <DatePicker
                      value={formData.tanggalLahir}
                      onChange={(v) => setFormData({ ...formData, tanggalLahir: v })}
                      placeholder="Tanggal lahir"
                    />
                  </div>
                ) : (
                  <p className="text-base font-semibold text-foreground">
                    {formData.tempatLahir && formData.tanggalLahir 
                      ? `${formData.tempatLahir}, ${format(new Date(formData.tanggalLahir), 'dd MMMM yyyy', { locale: localeId })}`
                      : formData.tempatLahir || (formData.tanggalLahir ? format(new Date(formData.tanggalLahir), 'dd MMMM yyyy', { locale: localeId }) : '-')}
                  </p>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="nik" className="text-sm font-medium text-muted-foreground">NIK (Nomor Induk Kependudukan)</Label>
                {isEditing ? (
                  <Input 
                    id="nik" 
                    value={formData.nik} 
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                      setFormData({ ...formData, nik: value });
                    }} 
                    placeholder="16 digit NIK"
                    maxLength={16}
                    className="rounded-lg border-0 bg-background font-semibold" 
                  />
                ) : (
                  <p className="text-base font-semibold text-foreground">{formData.nik || '-'}</p>
                )}
              </div>

              <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30 md:col-span-2">
                <Label htmlFor="alamatStaff" className="text-sm font-medium text-muted-foreground">Alamat</Label>
                {isEditing ? (
                  <Input 
                    id="alamatStaff" 
                    value={formData.alamatStaff} 
                    onChange={e => setFormData({ ...formData, alamatStaff: e.target.value })} 
                    placeholder="Alamat lengkap"
                    className="rounded-lg border-0 bg-background font-semibold" 
                  />
                ) : (
                  <p className="text-base font-semibold text-foreground">{formData.alamatStaff || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {formData.role === 'walikelas' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-border/50 bg-muted/30">
                <Label htmlFor="kelasId-staff" className="text-sm font-medium text-muted-foreground">Kelas</Label>
                {isEditing ? (
                  <Select 
                    value={formData.kelasId} 
                    onValueChange={value => setFormData({ ...formData, kelasId: value })}
                  >
                    <SelectTrigger className="mt-2 rounded-lg border-0 bg-background">
                      <SelectValue placeholder="Pilih kelas" />
                    </SelectTrigger>
                    <SelectContent>
                      {kelasList.map(k => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.nama} - {k.tingkat} ({k.tahun_ajaran})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-base font-semibold text-foreground">
                    {userKelas ? `${userKelas.nama} - ${userKelas.tingkat}` : '-'}
                  </p>
                )}
              </div>
            </div>
          )}

          {isEditing && (
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="rounded-xl gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-xl gap-2"
              >
                <X className="h-4 w-4" />
                Batal
              </Button>
            </div>
          )}
        </div>
      </ContentCardBody>
    </ContentCard>
  );
}

// Inline edit info card for santri
function SantriInfoCard({
  user,
  formData,
  setFormData,
  kelasList,
  userKelas,
  onSave,
  disableEdit = false
}: {
  user: UserInfoTabProps['user'];
  formData: UserInfoTabProps['formData'];
  setFormData: UserInfoTabProps['setFormData'];
  kelasList: UserInfoTabProps['kelasList'];
  userKelas: UserInfoTabProps['userKelas'];
  onSave: () => Promise<void>;
  disableEdit?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalData, setOriginalData] = useState(formData);

  const handleEdit = () => {
    setOriginalData({ ...formData });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave();
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ContentCard>
      <ExtractionCardHeader
        icon={<GraduationCap className="h-4 w-4 text-primary" />}
        title="Informasi Santri"
        actions={
          !isEditing && !disableEdit ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="rounded-xl gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          ) : undefined
        }
      />
      <ContentCardBody>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">Nama Lengkap</Label>
              {isEditing ? (
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.name}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label htmlFor="status" className="text-sm font-medium text-muted-foreground">Status Akun</Label>
              {isEditing ? (
                <Select 
                  value={formData.status} 
                  onValueChange={value => setFormData({ ...formData, status: value as 'aktif' | 'nonaktif' | 'cuti' | 'alumni' })}
                >
                  <SelectTrigger className="rounded-lg border-0 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Nonaktif</SelectItem>
                    <SelectItem value="cuti">Cuti</SelectItem>
                    <SelectItem value="alumni">Alumni</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-base font-semibold text-foreground capitalize">{formData.status}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label htmlFor="nisn" className="text-sm font-medium text-muted-foreground">NISN</Label>
              {isEditing ? (
                <Input 
                  id="nisn" 
                  value={formData.nisn} 
                  onChange={e => setFormData({ ...formData, nisn: e.target.value })} 
                  placeholder="Nomor Induk Siswa Nasional"
                  className="rounded-lg border-0 bg-background font-semibold" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.nisn || '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label htmlFor="nis" className="text-sm font-medium text-muted-foreground">NIS</Label>
              {isEditing ? (
                <Input 
                  id="nis" 
                  value={formData.nis} 
                  onChange={e => setFormData({ ...formData, nis: e.target.value })} 
                  placeholder="Nomor Induk Sekolah"
                  className="rounded-lg border-0 bg-background font-semibold" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.nis || '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label htmlFor="kelasId" className="text-sm font-medium text-muted-foreground">Kelas</Label>
              {isEditing ? (
                <Select 
                  value={formData.kelasId} 
                  onValueChange={value => setFormData({ ...formData, kelasId: value })}
                >
                  <SelectTrigger className="rounded-lg border-0 bg-background">
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {kelasList.map(k => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.nama} - {k.tingkat} ({k.tahun_ajaran})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-base font-semibold text-foreground">
                  {kelasList.find(k => k.id === formData.kelasId)?.nama || '-'}
                </p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label className="text-sm font-medium text-muted-foreground">Wali Kelas</Label>
              <p className="text-base font-semibold text-foreground">
                {userKelas?.wali_kelas?.profiles?.name || '-'}
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label htmlFor="birthDate" className="text-sm font-medium text-muted-foreground">Tanggal Lahir</Label>
              {isEditing ? (
                <DatePicker
                  value={formData.birthDate}
                  onChange={(v) => setFormData({ ...formData, birthDate: v })}
                  placeholder="Tanggal lahir"
                />
              ) : (
                <p className="text-base font-semibold text-foreground">
                  {formData.birthDate ? format(new Date(formData.birthDate), 'dd MMMM yyyy', { locale: localeId }) : '-'}
                </p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30">
              <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">Email</Label>
              {isEditing ? (
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email} 
                  onChange={e => setFormData({ ...formData, email: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.email || '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-2xl border border-border/50 bg-muted/30 md:col-span-2">
              <Label htmlFor="address" className="text-sm font-medium text-muted-foreground">Alamat</Label>
              {isEditing ? (
                <Input 
                  id="address" 
                  value={formData.address} 
                  onChange={e => setFormData({ ...formData, address: e.target.value })} 
                  placeholder="Alamat lengkap"
                  className="rounded-lg border-0 bg-background font-semibold" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.address || '-'}</p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="rounded-xl gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-xl gap-2"
              >
                <X className="h-4 w-4" />
                Batal
              </Button>
            </div>
          )}
        </div>
      </ContentCardBody>
    </ContentCard>
  );
}

export function UserInfoTab({
  user,
  formData,
  setFormData,
  isEditMode,
  kelasList,
  userKelas,
  userMapel,
  toggleMapel,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  isChangingPassword,
  handleChangePassword,
  onSave,
  disableEdit = false
}: UserInfoTabProps & { onSave: () => Promise<void> }) {
  return (
    <div className="space-y-6">
      {formData.role === 'santri' ? (
        <SantriInfoCard
          user={user}
          formData={formData}
          setFormData={setFormData}
          kelasList={kelasList}
          userKelas={userKelas}
          onSave={onSave}
          disableEdit={disableEdit}
        />
      ) : (
        <GeneralInfoCard
          user={user}
          formData={formData}
          setFormData={setFormData}
          kelasList={kelasList}
          userKelas={userKelas}
          onSave={onSave}
          disableEdit={disableEdit}
        />
      )}

      <SecuritySettingsCard
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        isChangingPassword={isChangingPassword}
        handleChangePassword={handleChangePassword}
        disableEdit={disableEdit}
      />
    </div>
  );
}
