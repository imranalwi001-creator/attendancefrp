import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Trash2, Link as LinkIcon, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export function WorkspaceInvitesTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchInvites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspace_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Gagal memuat daftar undangan',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleGenerateInvite = async () => {
    if (!user) return;
    try {
      setGenerating(true);
      
      // Get admin's workspace
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single();
        
      if (!profile?.workspace_id) throw new Error('Workspace tidak ditemukan');

      const { error } = await supabase
        .from('workspace_invitations')
        .insert({
          workspace_id: profile.workspace_id,
          role: 'guru',
          created_by: user.id
        });

      if (error) throw error;
      
      toast({
        title: 'Berhasil',
        description: 'Tautan undangan baru berhasil dibuat',
      });
      
      fetchInvites();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Gagal membuat undangan',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = (token: string) => {
    const inviteLink = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(inviteLink);
    toast({
      title: 'Disalin!',
      description: 'Tautan undangan berhasil disalin ke clipboard',
    });
  };

  const handleDeleteInvite = async (id: string) => {
    try {
      const { error } = await supabase
        .from('workspace_invitations')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      setInvites(invites.filter(i => i.id !== id));
      toast({
        title: 'Berhasil',
        description: 'Undangan berhasil dihapus',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Gagal menghapus undangan',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Undang Guru Mandiri (Tarik Data)</span>
          <Button onClick={handleGenerateInvite} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Buat Tautan Undangan
          </Button>
        </CardTitle>
        <CardDescription>
          Buat tautan untuk mengundang Guru yang sudah mendaftar mandiri ke dalam sekolah Anda. 
          Semua data (Kelas, Siswa, RPP) milik Guru tersebut akan otomatis ditarik masuk ke sekolah ini.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : invites.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Belum ada tautan undangan yang dibuat.
          </div>
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => {
              const inviteLink = `${window.location.origin}/join/${invite.token}`;
              const isExpired = new Date(invite.expires_at) < new Date();
              const isAccepted = invite.status === 'accepted';
              
              return (
                <div key={invite.id} className="border p-4 rounded-lg flex items-center justify-between gap-4">
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">Undangan {invite.role}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isAccepted ? 'bg-green-100 text-green-700' :
                        isExpired ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isAccepted ? 'Telah Diterima' : isExpired ? 'Kadaluarsa' : 'Aktif'}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      Dibuat: {format(new Date(invite.created_at), 'dd MMM yyyy', { locale: idLocale })} • 
                      Kadaluarsa: {format(new Date(invite.expires_at), 'dd MMM yyyy', { locale: idLocale })}
                    </div>
                    {!isAccepted && (
                      <div className="flex items-center mt-3 gap-2">
                        <Input 
                          value={inviteLink} 
                          readOnly 
                          className="h-8 text-xs bg-muted"
                        />
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="shrink-0"
                          onClick={() => handleCopyLink(invite.token)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => handleDeleteInvite(invite.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
