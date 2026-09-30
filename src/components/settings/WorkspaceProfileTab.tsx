import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Upload, Building2, Save } from 'lucide-react';
import { useInstitution } from '@/contexts/InstitutionContext';

export function WorkspaceProfileTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { workspaceType } = useInstitution();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  const [workspace, setWorkspace] = useState<{
    id: string;
    name: string;
    logo_url: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchWorkspace = async () => {
      if (!user?.workspace_id) {
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('workspaces')
          .select('id, name, logo_url')
          .eq('id', user.workspace_id)
          .single();
          
        if (error) throw error;
        setWorkspace(data);
      } catch (error) {
        console.error('Error fetching workspace:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchWorkspace();
  }, [user?.workspace_id]);

  const handleSave = async () => {
    if (!workspace || !user?.workspace_id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: workspace.name,
        })
        .eq('id', user.workspace_id);
        
      if (error) throw error;
      
      toast({
        title: 'Berhasil Disimpan',
        description: 'Profil institusi berhasil diperbarui',
      });
    } catch (error: any) {
      toast({
        title: 'Gagal Menyimpan',
        description: error.message || 'Terjadi kesalahan saat menyimpan data',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!event.target.files || event.target.files.length === 0 || !user?.workspace_id) {
        return;
      }
      
      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.workspace_id}/logo_${Math.random()}.${fileExt}`;
      
      setUploadingLogo(true);
      
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
      
      setWorkspace(prev => prev ? { ...prev, logo_url: publicUrl } : null);
      
      toast({
        title: 'Logo Diperbarui',
        description: 'Logo institusi berhasil diperbarui',
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Data profil tidak ditemukan.
      </div>
    );
  }

  const title = workspaceType === 'sekolah' ? 'Profil Sekolah' : 'Profil Guru Mandiri';
  const desc = workspaceType === 'sekolah' 
    ? 'Kelola informasi identitas sekolah Anda yang akan tampil di aplikasi dan laporan.'
    : 'Kelola identitas personal atau sekolah bayangan Anda yang akan tampil di aplikasi dan laporan cetak.';

  return (
    <Card className="border-0 shadow-sm ring-1 ring-border/50">
      <CardHeader className="border-b bg-muted/20 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-4">
          <Label className="text-base font-semibold">Logo Institusi / Personal</Label>
          <div className="flex items-start gap-6">
            <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-border flex items-center justify-center bg-muted/30 w-32 h-32 flex-shrink-0">
              {workspace.logo_url ? (
                <img src={workspace.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <Building2 className="w-12 h-12 text-muted-foreground/30" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button variant="ghost" size="sm" className="text-white hover:text-white relative">
                  {uploadingLogo ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Ubah
                    </>
                  )}
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              <p className="text-muted-foreground">Logo ini akan digunakan sebagai identitas pada aplikasi dan header laporan cetak (jika diatur).</p>
              <p className="text-muted-foreground font-medium">Format: JPG, PNG (Maks 2MB). Disarankan rasio 1:1.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="name" className="text-base font-semibold">Nama Institusi / Nama Laporan</Label>
          <Input 
            id="name"
            value={workspace.name}
            onChange={(e) => setWorkspace({ ...workspace, name: e.target.value })}
            placeholder="Contoh: SMA Negeri 1 Maju / Kelas Bapak Budi"
            className="max-w-md h-11"
          />
          <p className="text-xs text-muted-foreground">Ini adalah nama resmi yang akan merepresentasikan ruang kerja (workspace) Anda.</p>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/20 border-t justify-end py-4">
        <Button onClick={handleSave} disabled={saving} className="px-6 h-11">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Simpan Perubahan
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
