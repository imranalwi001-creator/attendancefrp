import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, Plus, Search, Filter, MoreVertical, CheckCircle2, 
  Clock, AlertTriangle, Trash2, Edit3, Eye, ShieldAlert, GraduationCap,
  Users, School, Phone, Mail, Globe, MapPin, Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSaasPlans } from '@/hooks/useSaasPlans';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export interface WorkspaceTenant {
  id: string;
  name: string;
  type: 'sekolah' | 'mandiri';
  education_level: 'paud' | 'sd' | 'smp' | 'sma' | 'smk' | 'pesantren';
  status: 'active' | 'trial' | 'suspended' | 'expired';
  subdomain?: string | null;
  subscription_plan: 'trial' | 'starter' | 'pro' | 'enterprise';
  trial_ends_at?: string | null;
  subscription_ends_at?: string | null;
  max_students?: number | null;
  max_teachers?: number | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  created_at: string;
}

export default function Tenants() {
  const queryClient = useQueryClient();
  const { plans } = useSaasPlans();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterJenjang, setFilterJenjang] = useState<string>('all');

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<WorkspaceTenant | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'sekolah' | 'mandiri'>('sekolah');
  const [formLevel, setFormLevel] = useState<'paud' | 'sd' | 'smp' | 'sma' | 'smk' | 'pesantren'>('pesantren');
  const [formSubdomain, setFormSubdomain] = useState('');
  const [formPlan, setFormPlan] = useState<'trial' | 'starter' | 'pro' | 'enterprise'>('pro');
  const [formStatus, setFormStatus] = useState<'active' | 'trial' | 'suspended' | 'expired'>('active');
  const [formMaxStudents, setFormMaxStudents] = useState(300);
  const [formMaxTeachers, setFormMaxTeachers] = useState(30);
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');

  // Fetch tenants
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['superadmin-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as WorkspaceTenant[];
    },
  });

  // Create mutation
  const createTenantMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const ownerId = userData?.user?.id;
      if (!ownerId) throw new Error('Pengguna tidak terautentikasi.');

      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: formName,
          type: formType,
          education_level: formLevel,
          subdomain: formSubdomain || null,
          subscription_plan: formPlan,
          status: formStatus,
          max_students: formMaxStudents,
          max_teachers: formMaxTeachers,
          contact_email: formEmail || null,
          contact_phone: formPhone || null,
          address: formAddress || null,
          owner_id: ownerId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Tenant baru berhasil ditambahkan');
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('Gagal menambahkan tenant: ' + err.message);
    },
  });

  // Update mutation
  const updateTenantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTenant) return;
      const { data, error } = await supabase
        .from('workspaces')
        .update({
          name: formName,
          type: formType,
          education_level: formLevel,
          subdomain: formSubdomain || null,
          subscription_plan: formPlan,
          status: formStatus,
          max_students: formMaxStudents,
          max_teachers: formMaxTeachers,
          contact_email: formEmail || null,
          contact_phone: formPhone || null,
          address: formAddress || null,
        })
        .eq('id', selectedTenant.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      toast.success('Informasi tenant berhasil diperbarui');
      setIsEditOpen(false);
      setSelectedTenant(null);
    },
    onError: (err: any) => {
      toast.error('Gagal memperbarui tenant: ' + err.message);
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: 'active' | 'suspended' | 'trial' }) => {
      const { error } = await supabase
        .from('workspaces')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      toast.success(`Status tenant diubah menjadi ${variables.newStatus.toUpperCase()}`);
    },
    onError: (err: any) => {
      toast.error('Gagal mengubah status: ' + err.message);
    },
  });

  // Delete mutation
  const deleteTenantMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success('Tenant berhasil dihapus');
      setIsDeleteOpen(false);
      setSelectedTenant(null);
    },
    onError: (err: any) => {
      toast.error('Gagal menghapus tenant: ' + err.message);
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormType('sekolah');
    setFormLevel('pesantren');
    setFormSubdomain('');
    setFormPlan('pro');
    setFormStatus('active');
    setFormMaxStudents(300);
    setFormMaxTeachers(30);
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
  };

  const openEditModal = (tenant: WorkspaceTenant) => {
    setSelectedTenant(tenant);
    setFormName(tenant.name);
    setFormType(tenant.type || 'sekolah');
    setFormLevel(tenant.education_level || 'pesantren');
    setFormSubdomain(tenant.subdomain || '');
    setFormPlan(tenant.subscription_plan || 'trial');
    setFormStatus(tenant.status || 'active');
    setFormMaxStudents(tenant.max_students || 200);
    setFormMaxTeachers(tenant.max_teachers || 20);
    setFormEmail(tenant.contact_email || '');
    setFormPhone(tenant.contact_phone || '');
    setFormAddress(tenant.address || '');
    setIsEditOpen(true);
  };

  // Filtered tenants
  const filteredTenants = tenants.filter((tenant) => {
    const matchSearch = 
      tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tenant.subdomain && tenant.subdomain.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tenant.contact_email && tenant.contact_email.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus = filterStatus === 'all' || tenant.status === filterStatus;
    const matchJenjang = filterJenjang === 'all' || tenant.education_level === filterJenjang;

    return matchSearch && matchStatus && matchJenjang;
  });

  // Calculate stats
  const totalCount = tenants.length;
  const activeCount = tenants.filter(t => t.status === 'active').length;
  const trialCount = tenants.filter(t => t.status === 'trial').length;
  const suspendedCount = tenants.filter(t => t.status === 'suspended').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Aktif</Badge>;
      case 'trial':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1.5"><Clock className="h-3 w-3" /> Masa Trial</Badge>;
      case 'suspended':
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 gap-1.5"><AlertTriangle className="h-3 w-3" /> Ditangguhkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLevelBadge = (level: string) => {
    const colorMap: Record<string, string> = {
      pesantren: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400',
      sd: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400',
      smp: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400',
      sma: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400',
      smk: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400',
      paud: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-400',
    };
    return (
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${colorMap[level] || 'bg-muted text-muted-foreground'}`}>
        {level.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Daftar Tenants / Sekolah" 
          description="Kelola seluruh instansi, paket lisensi, dan batasan kuota pada platform SaaS Anda."
        />
        <Button 
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="gap-2 shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> Tambah Tenant Baru
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Instansi</p>
              <h3 className="text-2xl font-bold mt-1">{totalCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Tenant Aktif</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">{activeCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Masa Trial</p>
              <h3 className="text-2xl font-bold mt-1 text-amber-600">{trialCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Ditangguhkan</p>
              <h3 className="text-2xl font-bold mt-1 text-rose-600">{suspendedCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama sekolah, subdomain, atau email PIC..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-none shadow-none focus-visible:ring-1"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="trial">Masa Trial</SelectItem>
              <SelectItem value="suspended">Ditangguhkan</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterJenjang} onValueChange={setFilterJenjang}>
            <SelectTrigger className="w-full sm:w-[150px] bg-background">
              <SelectValue placeholder="Jenjang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Jenjang</SelectItem>
              <SelectItem value="pesantren">Pesantren</SelectItem>
              <SelectItem value="sd">SD/MI</SelectItem>
              <SelectItem value="smp">SMP/MTs</SelectItem>
              <SelectItem value="sma">SMA</SelectItem>
              <SelectItem value="smk">SMK</SelectItem>
              <SelectItem value="paud">PAUD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Instansi / Sekolah</th>
                <th className="px-5 py-3.5">Jenjang</th>
                <th className="px-5 py-3.5">Paket & Lisensi</th>
                <th className="px-5 py-3.5">Kapasitas Kuota</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Memuat data tenant sekolah...
                  </td>
                </tr>
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    Tidak ada tenant yang sesuai dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                          {tenant.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{tenant.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono text-primary/90">{tenant.subdomain || 'no-subdomain'}.digiss.app</span>
                            {tenant.type === 'mandiri' && (
                              <span className="bg-secondary px-1.5 py-0.2 rounded text-[10px] font-medium">Mandiri</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {getLevelBadge(tenant.education_level)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <span className="capitalize font-medium text-xs bg-muted px-2 py-0.5 rounded-md text-foreground">
                          {tenant.subscription_plan}
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Mulai: {new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>Maks {tenant.max_students || 200} Siswa</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <GraduationCap className="h-3.5 w-3.5" />
                          <span>Maks {tenant.max_teachers || 25} Guru</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(tenant.status)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Aksi Tenant</DropdownMenuLabel>
                          <DropdownMenuItem 
                            onClick={() => { setSelectedTenant(tenant); setIsDetailOpen(true); }}
                            className="gap-2 cursor-pointer"
                          >
                            <Eye className="h-4 w-4" /> Detail Tenant
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => openEditModal(tenant)}
                            className="gap-2 cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" /> Edit Informasi
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {tenant.status === 'active' ? (
                            <DropdownMenuItem 
                              onClick={() => toggleStatusMutation.mutate({ id: tenant.id, newStatus: 'suspended' })}
                              className="gap-2 text-rose-600 cursor-pointer"
                            >
                              <AlertTriangle className="h-4 w-4" /> Tangguhkan Tenant
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => toggleStatusMutation.mutate({ id: tenant.id, newStatus: 'active' })}
                              className="gap-2 text-emerald-600 cursor-pointer"
                            >
                              <CheckCircle2 className="h-4 w-4" /> Aktifkan Tenant
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => { setSelectedTenant(tenant); setIsDeleteOpen(true); }}
                            className="gap-2 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" /> Hapus Tenant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah Tenant */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Tambah Tenant / Sekolah Baru
            </DialogTitle>
            <DialogDescription>
              Daftarkan sekolah atau lembaga pendidikan baru ke dalam platform SaaS LMS Digiss.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Nama Instansi / Sekolah <span className="text-rose-500">*</span></Label>
              <Input 
                id="name" 
                placeholder="Contoh: Pesantren Modern Al-Hikmah" 
                value={formName} 
                onChange={(e) => setFormName(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Jenjang Pendidikan</Label>
              <Select value={formLevel} onValueChange={(val: any) => setFormLevel(val)}>
                <SelectTrigger id="level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pesantren">Pesantren</SelectItem>
                  <SelectItem value="sd">SD / MI</SelectItem>
                  <SelectItem value="smp">SMP / MTs</SelectItem>
                  <SelectItem value="sma">SMA</SelectItem>
                  <SelectItem value="smk">SMK</SelectItem>
                  <SelectItem value="paud">PAUD / TK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain Akses</Label>
              <div className="flex items-center">
                <Input 
                  id="subdomain" 
                  placeholder="alhikmah" 
                  value={formSubdomain} 
                  onChange={(e) => setFormSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="rounded-r-none font-mono text-sm"
                />
                <span className="bg-muted px-3 py-2 text-xs border border-l-0 border-input rounded-r-md text-muted-foreground">
                  .digiss.app
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Paket Lisensi</Label>
              <Select 
                value={formPlan} 
                onValueChange={(val: any) => {
                  setFormPlan(val);
                  const selected = plans.find(p => p.id === val);
                  if (selected) {
                    if (selected.maxStudents > 0) setFormMaxStudents(selected.maxStudents);
                    if (selected.maxTeachers > 0) setFormMaxTeachers(selected.maxTeachers);
                  }
                }}
              >
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Pilih paket lisensi..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status Awal</Label>
              <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif Langsung</SelectItem>
                  <SelectItem value="trial">Masa Trial</SelectItem>
                  <SelectItem value="suspended">Ditangguhkan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="students">Batas Maks Siswa</Label>
              <Input 
                id="students" 
                type="number" 
                value={formMaxStudents} 
                onChange={(e) => setFormMaxStudents(Number(e.target.value))} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teachers">Batas Maks Guru/Staff</Label>
              <Input 
                id="teachers" 
                type="number" 
                value={formMaxTeachers} 
                onChange={(e) => setFormMaxTeachers(Number(e.target.value))} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Kontak PIC</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@alhikmah.sch.id" 
                value={formEmail} 
                onChange={(e) => setFormEmail(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Nomor WhatsApp PIC</Label>
              <Input 
                id="phone" 
                placeholder="081234567890" 
                value={formPhone} 
                onChange={(e) => setFormPhone(e.target.value)} 
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Alamat Lembaga</Label>
              <Input 
                id="address" 
                placeholder="Jl. Raya No. 123, Kota / Kabupaten..." 
                value={formAddress} 
                onChange={(e) => setFormAddress(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button 
              onClick={() => createTenantMutation.mutate()} 
              disabled={!formName.trim() || createTenantMutation.isPending}
            >
              {createTenantMutation.isPending ? 'Menyimpan...' : 'Simpan & Aktifkan Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Tenant */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5 text-primary" /> Edit Data Tenant
            </DialogTitle>
            <DialogDescription>
              Perbarui konfigurasi paket, kuota, atau status tenant {selectedTenant?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-name">Nama Instansi / Sekolah</Label>
              <Input 
                id="edit-name" 
                value={formName} 
                onChange={(e) => setFormName(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-level">Jenjang Pendidikan</Label>
              <Select value={formLevel} onValueChange={(val: any) => setFormLevel(val)}>
                <SelectTrigger id="edit-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pesantren">Pesantren</SelectItem>
                  <SelectItem value="sd">SD / MI</SelectItem>
                  <SelectItem value="smp">SMP / MTs</SelectItem>
                  <SelectItem value="sma">SMA</SelectItem>
                  <SelectItem value="smk">SMK</SelectItem>
                  <SelectItem value="paud">PAUD / TK</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-subdomain">Subdomain Akses</Label>
              <div className="flex items-center">
                <Input 
                  id="edit-subdomain" 
                  value={formSubdomain} 
                  onChange={(e) => setFormSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="rounded-r-none font-mono text-sm"
                />
                <span className="bg-muted px-3 py-2 text-xs border border-l-0 border-input rounded-r-md text-muted-foreground">
                  .digiss.app
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-plan">Paket Lisensi</Label>
              <Select value={formPlan} onValueChange={(val: any) => setFormPlan(val)}>
                <SelectTrigger id="edit-plan">
                  <SelectValue placeholder="Pilih paket lisensi..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status Tenant</Label>
              <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="trial">Masa Trial</SelectItem>
                  <SelectItem value="suspended">Ditangguhkan</SelectItem>
                  <SelectItem value="expired">Kedaluwarsa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-students">Batas Siswa</Label>
              <Input 
                id="edit-students" 
                type="number" 
                value={formMaxStudents} 
                onChange={(e) => setFormMaxStudents(Number(e.target.value))} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-teachers">Batas Guru/Staff</Label>
              <Input 
                id="edit-teachers" 
                type="number" 
                value={formMaxTeachers} 
                onChange={(e) => setFormMaxTeachers(Number(e.target.value))} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email Kontak PIC</Label>
              <Input 
                id="edit-email" 
                type="email" 
                value={formEmail} 
                onChange={(e) => setFormEmail(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-phone">Nomor WhatsApp PIC</Label>
              <Input 
                id="edit-phone" 
                value={formPhone} 
                onChange={(e) => setFormPhone(e.target.value)} 
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-address">Alamat Lembaga</Label>
              <Input 
                id="edit-address" 
                value={formAddress} 
                onChange={(e) => setFormAddress(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Batal</Button>
            <Button 
              onClick={() => updateTenantMutation.mutate()} 
              disabled={!formName.trim() || updateTenantMutation.isPending}
            >
              {updateTenantMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Detail Tenant */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Detail Instansi
            </DialogTitle>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <div>
                  <h4 className="font-bold text-base">{selectedTenant.name}</h4>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    ID: {selectedTenant.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {getStatusBadge(selectedTenant.status)}
                  {getLevelBadge(selectedTenant.education_level)}
                  <Badge variant="outline" className="capitalize">{selectedTenant.subscription_plan}</Badge>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4 text-primary shrink-0" />
                  <span>Subdomain: <strong className="text-foreground">{selectedTenant.subdomain || '-'}.digiss.app</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4 text-primary shrink-0" />
                  <span>Email: <strong className="text-foreground">{selectedTenant.contact_email || '-'}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <span>Telepon: <strong className="text-foreground">{selectedTenant.contact_phone || '-'}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span>Alamat: <strong className="text-foreground">{selectedTenant.address || '-'}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4 text-primary shrink-0" />
                  <span>Kuota Siswa: <strong className="text-foreground">Maks {selectedTenant.max_students || 200}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                  <span>Kuota Guru: <strong className="text-foreground">Maks {selectedTenant.max_teachers || 25}</strong></span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Hapus */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="h-5 w-5" /> Hapus Tenant Ini?
            </DialogTitle>
            <DialogDescription>
              Tindakan ini akan menghapus workspace <strong>{selectedTenant?.name}</strong> beserta konfigurasi terkait secara permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Batal</Button>
            <Button 
              variant="destructive"
              onClick={() => selectedTenant && deleteTenantMutation.mutate(selectedTenant.id)}
              disabled={deleteTenantMutation.isPending}
            >
              {deleteTenantMutation.isPending ? 'Menghapus...' : 'Ya, Hapus Permanen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
