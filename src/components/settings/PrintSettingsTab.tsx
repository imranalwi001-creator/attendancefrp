import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Save, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function PrintSettingsTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolAddress: '',
    kopSuratLine1: 'PEMERINTAH PROVINSI',
    kopSuratLine2: 'DINAS PENDIDIKAN',
    kopSuratLine3: 'NAMA INSTITUSI',
    kopSuratAddress: 'Alamat lengkap institusi',
    signatureName: '',
    signatureNip: '',
    signaturePosition: 'Kepala Sekolah',
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.workspace_id) {
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('logo_url, print_settings')
          .eq('id', user.workspace_id)
          .single();
          
        if (error) throw error;
        
        if (data.logo_url) setLogoUrl(data.logo_url);
        if (data.print_settings) {
          // Merge default values with saved settings
          setFormData(prev => ({ ...prev, ...(data.print_settings as any) }));
        }
      } catch (error) {
        console.error('Error fetching print settings:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [user?.workspace_id]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.workspace_id) return;
    
    try {
      setUploadingLogo(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.workspace_id}/kop_logo_${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('workspace_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('workspace_assets')
        .getPublicUrl(filePath);
        
      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ logo_url: publicUrl })
        .eq('id', user.workspace_id);
        
      if (updateError) throw updateError;
      
      setLogoUrl(publicUrl);
      
      toast({
        title: 'Logo Diperbarui',
        description: 'Logo kop surat berhasil diperbarui',
      });
    } catch (error: any) {
      toast({
        title: 'Gagal Upload',
        description: error.message || 'Terjadi kesalahan saat mengunggah logo',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!user?.workspace_id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ print_settings: formData })
        .eq('id', user.workspace_id);
        
      if (error) throw error;
      
      toast({
        title: 'Berhasil',
        description: 'Pengaturan laporan & cetak berhasil disimpan.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Gagal menyimpan pengaturan.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 animate-fade-in">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Identitas & Kop Surat</CardTitle>
            <CardDescription>Atur teks kop surat yang akan muncul di setiap dokumen yang dicetak.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Logo Institusi (Header Kiri)</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/20 overflow-hidden relative">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground/50" />
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full" disabled={uploadingLogo} />
                  <p className="text-xs text-muted-foreground mt-1.5">Format: JPG, PNG, max 2MB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kopSuratLine1">Baris 1 (Misal: Pemerintah Provinsi/Yayasan)</Label>
              <Input 
                id="kopSuratLine1" 
                value={formData.kopSuratLine1} 
                onChange={(e) => handleChange('kopSuratLine1', e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="kopSuratLine2">Baris 2 (Misal: Dinas Pendidikan)</Label>
              <Input 
                id="kopSuratLine2" 
                value={formData.kopSuratLine2} 
                onChange={(e) => handleChange('kopSuratLine2', e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="kopSuratLine3">Baris 3 (Nama Institusi)</Label>
              <Input 
                id="kopSuratLine3" 
                value={formData.kopSuratLine3} 
                onChange={(e) => handleChange('kopSuratLine3', e.target.value)} 
                className="font-bold"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="kopSuratAddress">Alamat Lengkap & Kontak</Label>
              <Textarea 
                id="kopSuratAddress" 
                value={formData.kopSuratAddress} 
                onChange={(e) => handleChange('kopSuratAddress', e.target.value)} 
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Tanda Tangan Pengesahan</CardTitle>
            <CardDescription>Nama dan jabatan yang akan menandatangani laporan di bagian bawah.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signaturePosition">Jabatan (Misal: Kepala Sekolah)</Label>
              <Input 
                id="signaturePosition" 
                value={formData.signaturePosition} 
                onChange={(e) => handleChange('signaturePosition', e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signatureName">Nama Terang</Label>
              <Input 
                id="signatureName" 
                value={formData.signatureName} 
                onChange={(e) => handleChange('signatureName', e.target.value)} 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="signatureNip">NIP / NIK (Opsional)</Label>
              <Input 
                id="signatureNip" 
                value={formData.signatureNip} 
                onChange={(e) => handleChange('signatureNip', e.target.value)} 
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/20 border-t py-4 justify-end">
            <Button onClick={handleSave} disabled={saving} className="px-6">
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Pengaturan
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Live Preview */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center text-primary">
              <FileText className="w-4 h-4 mr-2" />
              Preview Kop Surat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-white p-6 rounded-md shadow-sm border text-center relative flex items-center justify-center min-h-[120px]">
              {logoUrl && (
                <div className="absolute left-6 top-1/2 -translate-y-1/2">
                  <img src={logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
                </div>
              )}
              <div className="flex-1 max-w-[80%] mx-auto">
                <p className="text-[10px] sm:text-xs font-semibold leading-tight">{formData.kopSuratLine1 || 'BARIS 1'}</p>
                <p className="text-[11px] sm:text-sm font-bold leading-tight mt-0.5">{formData.kopSuratLine2 || 'BARIS 2'}</p>
                <h3 className="text-[13px] sm:text-base font-black leading-tight mt-1">{formData.kopSuratLine3 || 'NAMA INSTITUSI'}</h3>
                <p className="text-[9px] sm:text-[10px] mt-1.5 px-4">{formData.kopSuratAddress || 'Alamat Institusi'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
