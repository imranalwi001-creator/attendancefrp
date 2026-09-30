import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function JoinWorkspace() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('workspace_invitations')
          .select('*, workspaces(name)')
          .eq('token', token)
          .eq('status', 'pending')
          .single();
          
        if (error || !data) {
          setError('Tautan undangan tidak valid atau sudah kadaluarsa.');
          return;
        }
        
        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
          setError('Tautan undangan sudah kadaluarsa.');
          return;
        }
        
        setInvitation(data);
      } catch (err: any) {
        setError('Gagal memuat detail undangan.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!user) {
      toast.error('Anda harus login terlebih dahulu');
      navigate('/login', { state: { returnTo: `/join/${token}` } });
      return;
    }

    try {
      setProcessing(true);
      const { error } = await supabase.rpc('accept_workspace_invitation', {
        invite_token: token
      });
      
      if (error) throw error;
      
      toast.success('Berhasil bergabung dengan sekolah! Data Anda telah berhasil ditarik.');
      
      // Refresh auth context so the app knows we changed workspace
      if (refreshUser) {
        await refreshUser();
      }
      
      // Redirect to dashboard
      navigate('/app/dashboard');
      
    } catch (err: any) {
      toast.error(err.message || 'Gagal menerima undangan');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Undangan Sekolah</CardTitle>
          <CardDescription>
            Bergabung dengan ruang kerja (workspace) instansi pendidikan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 py-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <p className="text-destructive font-medium">{error}</p>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Kembali ke Beranda
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-muted p-4 rounded-lg text-center space-y-1">
                <p className="text-sm text-muted-foreground">Anda diundang untuk bergabung dengan:</p>
                <p className="text-lg font-bold text-foreground">
                  {invitation?.workspaces?.name || 'Sekolah'}
                </p>
                <p className="text-sm text-muted-foreground pt-2">
                  Sebagai: <span className="font-semibold capitalize">{invitation?.role}</span>
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 p-4 rounded-lg text-sm border border-blue-200 dark:border-blue-800">
                <strong>Catatan Penting (Tarik Data):</strong>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Data Kelas dan Siswa yang telah Anda buat di akun mandiri akan ikut dipindahkan.</li>
                  <li>Perangkat ajar dan Mata Pelajaran Anda akan menjadi bagian dari sekolah ini.</li>
                </ul>
              </div>

              {!user ? (
                <div className="space-y-3">
                  <p className="text-sm text-center text-muted-foreground">
                    Silakan login ke akun Anda untuk menerima undangan ini.
                  </p>
                  <Button 
                    className="w-full" 
                    onClick={() => navigate('/login', { state: { returnTo: `/join/${token}` } })}
                  >
                    Login ke Akun Anda
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                      {user.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">Login sebagai</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleAccept}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      'Terima Undangan & Gabung'
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => navigate('/app/dashboard')}
                    disabled={processing}
                  >
                    Batal
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
