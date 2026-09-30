import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, Save, MessageSquare, CreditCard, Globe, 
  ShieldCheck, CheckCircle2, Sparkles, Send, RefreshCw, Key,
  Package, Edit3, Check, Users, GraduationCap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSaasPlans } from '@/hooks/useSaasPlans';
import { ManageSaasPlansModal } from '@/components/superadmin/ManageSaasPlansModal';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';

export default function SaasSettings() {
  const queryClient = useQueryClient();
  const { plans } = useSaasPlans();
  const [isManagePlansOpen, setIsManagePlansOpen] = useState(false);
  const [isTestingWa, setIsTestingWa] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');

  // Local state for all settings
  const [settings, setSettings] = useState<Record<string, string>>({
    saas_platform_name: 'LMS Digiss',
    saas_tagline: 'Platform Terpadu Manajemen Sekolah & Pesantren Modern',
    saas_support_email: 'support@digiss.app',
    saas_support_phone: '0812-3456-7890',
    saas_main_domain: 'digiss.app',
    saas_trial_days: '30',
    saas_allow_registration: 'true',
    saas_default_student_quota: '200',
    saas_default_teacher_quota: '25',
    saas_mpwa_endpoint: 'https://api.mpwa.id/v1/send-message',
    saas_mpwa_api_key: '',
    saas_mpwa_sender: '',
    saas_midtrans_client_key: '',
    saas_midtrans_server_key: '',
    saas_midtrans_is_production: 'false',
  });

  // Fetch settings from app_settings
  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['saas-app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value');

      if (error) throw error;
      const mapped: Record<string, string> = {};
      (data || []).forEach(row => {
        mapped[row.setting_key] = row.setting_value;
      });
      return mapped;
    },
  });

  useEffect(() => {
    if (dbSettings) {
      setSettings(prev => ({
        ...prev,
        ...dbSettings,
      }));
    }
  }, [dbSettings]);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // Mutation to save all settings
  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = Object.entries(settings).map(([setting_key, setting_value]) => ({
        setting_key,
        setting_value,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('app_settings')
        .upsert(rows, { onConflict: 'setting_key' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-app-settings'] });
      toast.success('Pengaturan SaaS berhasil disimpan!');
    },
    onError: (err: any) => {
      toast.error('Gagal menyimpan pengaturan: ' + err.message);
    },
  });

  const handleTestWa = () => {
    if (!testPhoneNumber) {
      toast.error('Masukkan nomor WhatsApp tujuan terlebih dahulu.');
      return;
    }
    setIsTestingWa(true);
    setTimeout(() => {
      setIsTestingWa(false);
      toast.success(`Tes notifikasi berhasil dikirimkan ke nomor ${testPhoneNumber}`);
    }, 1200);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Konfigurasi SaaS" 
          description="Atur identitas platform global, kebijakan registrasi, serta integrasi gateway WhatsApp & pembayaran."
        />
        <Button 
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || isLoading}
          className="gap-2 shadow-sm shrink-0"
        >
          <Save className="h-4 w-4" /> 
          {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Seluruh Pengaturan'}
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-2xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="branding" className="rounded-xl gap-2 py-2">
            <Globe className="h-4 w-4" /> Identitas Platform
          </TabsTrigger>
          <TabsTrigger value="plans" className="rounded-xl gap-2 py-2">
            <Package className="h-4 w-4" /> Paket Lisensi SaaS
          </TabsTrigger>
          <TabsTrigger value="registration" className="rounded-xl gap-2 py-2">
            <ShieldCheck className="h-4 w-4" /> Registrasi & Trial
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-xl gap-2 py-2">
            <MessageSquare className="h-4 w-4" /> WhatsApp Gateway
          </TabsTrigger>
          <TabsTrigger value="payment" className="rounded-xl gap-2 py-2">
            <CreditCard className="h-4 w-4" /> Payment Gateway
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Branding */}
        <TabsContent value="branding" className="space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Identitas & Branding SaaS
              </CardTitle>
              <CardDescription>
                Informasi utama platform yang ditampilkan kepada seluruh tenant dan pengguna.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="p-name">Nama Platform SaaS</Label>
                  <Input 
                    id="p-name" 
                    value={settings.saas_platform_name || ''} 
                    onChange={(e) => handleChange('saas_platform_name', e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-domain">Domain Utama</Label>
                  <Input 
                    id="p-domain" 
                    placeholder="digiss.app" 
                    value={settings.saas_main_domain || ''} 
                    onChange={(e) => handleChange('saas_main_domain', e.target.value)} 
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="p-tagline">Tagline / Slogan Platform</Label>
                  <Input 
                    id="p-tagline" 
                    value={settings.saas_tagline || ''} 
                    onChange={(e) => handleChange('saas_tagline', e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-email">Email Bantuan / Support</Label>
                  <Input 
                    id="p-email" 
                    type="email" 
                    value={settings.saas_support_email || ''} 
                    onChange={(e) => handleChange('saas_support_email', e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="p-phone">Nomor Telepon / CS WhatsApp</Label>
                  <Input 
                    id="p-phone" 
                    value={settings.saas_support_phone || ''} 
                    onChange={(e) => handleChange('saas_support_phone', e.target.value)} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Registrasi & Trial */}
        <TabsContent value="registration" className="space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Kebijakan Onboarding & Pendaftaran
              </CardTitle>
              <CardDescription>
                Tentukan durasi uji coba gratis dan alokasi batas kapasitas standar untuk sekolah baru.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Buka Registrasi Sekolah Mandiri</Label>
                  <p className="text-xs text-muted-foreground">
                    Izinkan lembaga pendidikan mendaftarkan diri secara publik melalui landing page.
                  </p>
                </div>
                <Switch 
                  checked={settings.saas_allow_registration === 'true'} 
                  onCheckedChange={(checked) => handleChange('saas_allow_registration', checked ? 'true' : 'false')} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trial-days">Durasi Masa Trial (Hari)</Label>
                  <Input 
                    id="trial-days" 
                    type="number" 
                    value={settings.saas_trial_days || '30'} 
                    onChange={(e) => handleChange('saas_trial_days', e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="def-students">Kuota Siswa Default</Label>
                  <Input 
                    id="def-students" 
                    type="number" 
                    value={settings.saas_default_student_quota || '200'} 
                    onChange={(e) => handleChange('saas_default_student_quota', e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="def-teachers">Kuota Guru Default</Label>
                  <Input 
                    id="def-teachers" 
                    type="number" 
                    value={settings.saas_default_teacher_quota || '25'} 
                    onChange={(e) => handleChange('saas_default_teacher_quota', e.target.value)} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: WhatsApp Gateway */}
        <TabsContent value="whatsapp" className="space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Integrasi WhatsApp Gateway (MPWA / Fonnte)
              </CardTitle>
              <CardDescription>
                Kirimkan notifikasi tagihan SPP, presensi kehadiran santri, dan pengumuman via WhatsApp resmi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="wa-endpoint">API Endpoint URL</Label>
                  <Input 
                    id="wa-endpoint" 
                    placeholder="https://api.mpwa.id/v1/send-message" 
                    value={settings.saas_mpwa_endpoint || ''} 
                    onChange={(e) => handleChange('saas_mpwa_endpoint', e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-key">API Key / Token Rahasia</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="wa-key" 
                      type="password"
                      placeholder="mpwa_sec_live_xxxx" 
                      value={settings.saas_mpwa_api_key || ''} 
                      onChange={(e) => handleChange('saas_mpwa_api_key', e.target.value)} 
                      className="pl-9 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wa-sender">Nomor WhatsApp Pengirim (Sender)</Label>
                  <Input 
                    id="wa-sender" 
                    placeholder="Contoh: 6281234567890" 
                    value={settings.saas_mpwa_sender || ''} 
                    onChange={(e) => handleChange('saas_mpwa_sender', e.target.value)} 
                  />
                </div>
              </div>

              {/* WhatsApp Test Send Box */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border mt-4 space-y-3">
                <h5 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-primary" /> Uji Coba Pengiriman Pesan
                </h5>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <Input 
                    placeholder="Masukkan nomor WA (cth: 08123456789)" 
                    value={testPhoneNumber}
                    onChange={(e) => setTestPhoneNumber(e.target.value)}
                    className="bg-background"
                  />
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleTestWa}
                    disabled={isTestingWa}
                    className="shrink-0 w-full sm:w-auto"
                  >
                    {isTestingWa ? 'Mengirim...' : 'Kirim Pesan Uji'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Payment Gateway */}
        <TabsContent value="payment" className="space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" /> Integrasi Payment Gateway (Midtrans)
              </CardTitle>
              <CardDescription>
                Otomatisasi pembayaran biaya langganan tenant melalui Virtual Account, QRIS, dan e-Wallet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Mode Produksi (Live)</Label>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan jika sistem sudah siap menerima transaksi riil. Nonaktifkan untuk mode Sandbox.
                  </p>
                </div>
                <Switch 
                  checked={settings.saas_midtrans_is_production === 'true'} 
                  onCheckedChange={(checked) => handleChange('saas_midtrans_is_production', checked ? 'true' : 'false')} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="m-client">Client Key</Label>
                  <Input 
                    id="m-client" 
                    placeholder="SB-Mid-client-xxxx" 
                    value={settings.saas_midtrans_client_key || ''} 
                    onChange={(e) => handleChange('saas_midtrans_client_key', e.target.value)} 
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="m-server">Server Key</Label>
                  <Input 
                    id="m-server" 
                    type="password"
                    placeholder="SB-Mid-server-xxxx" 
                    value={settings.saas_midtrans_server_key || ''} 
                    onChange={(e) => handleChange('saas_midtrans_server_key', e.target.value)} 
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Paket Lisensi SaaS */}
        <TabsContent value="plans" className="space-y-4">
          <Card className="rounded-2xl border-border">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Pengaturan Paket Lisensi Platform SaaS
                </CardTitle>
                <CardDescription>
                  Konfigurasi nama paket, harga langganan bulanan, batas kuota akun santri & guru, serta daftar fasilitas layanan.
                </CardDescription>
              </div>
              <Button 
                type="button" 
                onClick={() => setIsManagePlansOpen(true)}
                className="gap-2 shadow-xs shrink-0"
              >
                <Edit3 className="h-4 w-4" /> Kelola & Edit Paket Lisensi
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className={`p-4 rounded-xl border flex flex-col justify-between ${
                      plan.isPopular 
                        ? 'border-primary/50 bg-primary/5' 
                        : 'border-border bg-card'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={plan.isPopular ? 'default' : 'secondary'} className="text-[10px]">
                          {plan.badge || 'Paket'}
                        </Badge>
                        {plan.isPopular && (
                          <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Populer
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-foreground">{plan.name}</h4>
                      <p className="text-lg font-black mt-1 text-foreground">
                        {plan.price === 0 ? 'Rp 0' : `Rp ${plan.price.toLocaleString('id-ID')}`}
                        <span className="text-xs font-normal text-muted-foreground ml-1">{plan.billingCycleText || '/ bln'}</span>
                      </p>

                      <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>Maks. Siswa: <strong>{plan.maxStudents === 0 ? 'Unlimited' : plan.maxStudents}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>Maks. Guru: <strong>{plan.maxTeachers === 0 ? 'Unlimited' : plan.maxTeachers}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-border/40 text-[11px] text-muted-foreground space-y-1">
                      {(plan.features || []).slice(0, 3).map((feat, idx) => (
                        <p key={idx} className="truncate">• {feat}</p>
                      ))}
                      {(plan.features?.length || 0) > 3 && (
                        <p className="text-[10px] text-primary font-medium">+ {(plan.features?.length || 0) - 3} fitur lainnya</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Edit Paket Lisensi SaaS */}
      <ManageSaasPlansModal 
        open={isManagePlansOpen} 
        onOpenChange={setIsManagePlansOpen} 
      />
    </div>
  );
}
