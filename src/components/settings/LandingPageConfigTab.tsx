import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';

export interface LandingPageSettings {
  id?: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_text: string;
  school_features_title: string;
  school_features_desc: string;
  teacher_features_title: string;
  teacher_features_desc: string;
  student_features_title: string;
  student_features_desc: string;
  parent_features_title: string;
  parent_features_desc: string;
  footer_text: string;
}

export function LandingPageConfigTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<LandingPageSettings>({
    hero_title: 'Sistem Informasi Akademik Terpadu untuk Pesantren',
    hero_subtitle: 'Digitalisasi manajemen sekolah, guru, siswa, dan orang tua dalam satu platform modern yang terintegrasi penuh.',
    hero_cta_text: 'Masuk ke Sistem',
    school_features_title: 'Manajemen Otomatis untuk Sekolah',
    school_features_desc: 'Kelola tagihan, data santri, dan laporan dengan mudah dan cepat.',
    teacher_features_title: 'Kemudahan untuk Guru',
    teacher_features_desc: 'Input nilai, rekap absen, dan buat ujian CBT tanpa hambatan.',
    student_features_title: 'Portal untuk Siswa',
    student_features_desc: 'Akses raport, jadwal, dan progres hafalan secara real-time.',
    parent_features_title: 'Pantauan Orang Tua',
    parent_features_desc: 'Monitor perkembangan anak dari rumah dengan presisi.',
    footer_text: '© 2026 LMS Boarding School. Hak Cipta Dilindungi.',
  });

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_page_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings(data as LandingPageSettings);
      }
    } catch (error) {
      console.error('Error fetching landing page settings:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat pengaturan landing page (mungkin tabel belum dibuat).',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (field: keyof LandingPageSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settings.id) {
        const { error } = await supabase
          .from('landing_page_settings')
          .update(settings)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('landing_page_settings')
          .insert([settings]);
        if (error) throw error;
        // Refetch to get the ID
        await fetchSettings();
      }

      toast({
        title: 'Berhasil',
        description: 'Pengaturan landing page berhasil disimpan',
      });
    } catch (error) {
      console.error('Error saving landing page settings:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan pengaturan landing page',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pengaturan Landing Page</h2>
          <p className="text-muted-foreground">Sesuaikan teks yang ditampilkan pada halaman utama aplikasi (SaaS Style).</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan Perubahan
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hero Section</CardTitle>
            <CardDescription>Teks utama pada bagian atas landing page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Judul Utama (Headline)</label>
              <Input 
                value={settings.hero_title} 
                onChange={(e) => handleChange('hero_title', e.target.value)} 
                placeholder="Contoh: Sistem Informasi Akademik..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Teks Pendukung (Subtitle)</label>
              <Textarea 
                value={settings.hero_subtitle} 
                onChange={(e) => handleChange('hero_subtitle', e.target.value)} 
                placeholder="Digitalisasi manajemen sekolah..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Teks Tombol Aksi (CTA)</label>
              <Input 
                value={settings.hero_cta_text} 
                onChange={(e) => handleChange('hero_cta_text', e.target.value)} 
                placeholder="Masuk ke Sistem"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fitur Bento Grid</CardTitle>
            <CardDescription>Atur teks untuk masing-masing pilar pengguna.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 h-[400px] overflow-y-auto pr-2 scrollbar-soft">
            <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/10">
              <h4 className="font-semibold text-primary">🏫 Sekolah / Admin</h4>
              <Input value={settings.school_features_title} onChange={(e) => handleChange('school_features_title', e.target.value)} placeholder="Judul Sekolah" className="mb-2" />
              <Textarea value={settings.school_features_desc} onChange={(e) => handleChange('school_features_desc', e.target.value)} placeholder="Deskripsi Sekolah" rows={2} />
            </div>

            <div className="space-y-2 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10 dark:bg-emerald-500/10">
              <h4 className="font-semibold text-emerald-600 dark:text-emerald-400">👨‍🏫 Guru</h4>
              <Input value={settings.teacher_features_title} onChange={(e) => handleChange('teacher_features_title', e.target.value)} placeholder="Judul Guru" className="mb-2" />
              <Textarea value={settings.teacher_features_desc} onChange={(e) => handleChange('teacher_features_desc', e.target.value)} placeholder="Deskripsi Guru" rows={2} />
            </div>

            <div className="space-y-2 p-3 bg-blue-500/5 rounded-lg border border-blue-500/10 dark:bg-blue-500/10">
              <h4 className="font-semibold text-blue-600 dark:text-blue-400">🎓 Siswa</h4>
              <Input value={settings.student_features_title} onChange={(e) => handleChange('student_features_title', e.target.value)} placeholder="Judul Siswa" className="mb-2" />
              <Textarea value={settings.student_features_desc} onChange={(e) => handleChange('student_features_desc', e.target.value)} placeholder="Deskripsi Siswa" rows={2} />
            </div>

            <div className="space-y-2 p-3 bg-purple-500/5 rounded-lg border border-purple-500/10 dark:bg-purple-500/10">
              <h4 className="font-semibold text-purple-600 dark:text-purple-400">👨‍👩‍👧 Orang Tua</h4>
              <Input value={settings.parent_features_title} onChange={(e) => handleChange('parent_features_title', e.target.value)} placeholder="Judul Orang Tua" className="mb-2" />
              <Textarea value={settings.parent_features_desc} onChange={(e) => handleChange('parent_features_desc', e.target.value)} placeholder="Deskripsi Orang Tua" rows={2} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Footer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-md">
            <label className="text-sm font-medium">Teks Hak Cipta</label>
            <Input 
              value={settings.footer_text} 
              onChange={(e) => handleChange('footer_text', e.target.value)} 
              placeholder="© 2026..."
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
