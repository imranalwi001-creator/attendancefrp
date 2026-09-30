import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, X, Target, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TpStatusItem {
  tp_index: number;
  status: string;
  achieved_at: string | null;
}

interface TujuanPembelajaranFormProps {
  mapelId: string;
  mapelInfo: any;
  onSave: () => void;
  onCancel: () => void;
  tpStatusList?: TpStatusItem[];
}

interface TujuanItem {
  text: string;
}

export default function TujuanPembelajaranForm({
  mapelId,
  mapelInfo,
  onSave,
  onCancel,
  tpStatusList = []
}: TujuanPembelajaranFormProps) {
  const { toast } = useToast();
  const [tujuanList, setTujuanList] = useState<TujuanItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if a TP is tercapai (achieved)
  const isTpTercapai = (index: number): boolean => {
    return tpStatusList.some(tp => tp.tp_index === index && tp.status === 'tercapai');
  };

  useEffect(() => {
    if (mapelInfo) {
      // Parse tujuan_pembelajaran
      if (mapelInfo.tujuan_pembelajaran && Array.isArray(mapelInfo.tujuan_pembelajaran)) {
        setTujuanList(mapelInfo.tujuan_pembelajaran.map((item: any) => ({
          text: typeof item === 'string' ? item : item.text || ''
        })));
      }
    }
  }, [mapelInfo]);

  const handleAddTujuan = () => {
    setTujuanList([...tujuanList, { text: '' }]);
  };

  const handleRemoveTujuan = (index: number) => {
    // Prevent removal of tercapai items
    if (isTpTercapai(index)) {
      toast({
        title: "Tidak dapat dihapus",
        description: "Tujuan pembelajaran yang sudah tercapai tidak bisa dihapus",
        variant: "destructive"
      });
      return;
    }
    setTujuanList(tujuanList.filter((_, i) => i !== index));
  };

  const handleTujuanChange = (index: number, value: string) => {
    // Prevent editing of tercapai items
    if (isTpTercapai(index)) {
      return;
    }
    const newList = [...tujuanList];
    newList[index] = { text: value };
    setTujuanList(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty items
      const filteredTujuan = tujuanList.filter(item => item.text.trim() !== '');

      const dataToSave = {
        mapel_id: mapelId,
        tujuan_pembelajaran: filteredTujuan as any
      };

      if (mapelInfo?.id) {
        // Update existing
        const { error } = await supabase
          .from('mapel_info')
          .update(dataToSave)
          .eq('id', mapelInfo.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('mapel_info')
          .insert(dataToSave);

        if (error) throw error;
      }

      toast({
        title: "Berhasil",
        description: "Tujuan pembelajaran berhasil disimpan"
      });

      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        {/* Tujuan Pembelajaran Section */}
        <div className="space-y-4">
          <div className="space-y-3">
            {tujuanList.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-muted/30">
                <Target className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground mb-1">Belum ada tujuan pembelajaran</p>
                <p className="text-xs text-muted-foreground/70">Klik tombol di bawah untuk menambahkan</p>
              </div>
            ) : (
              tujuanList.map((item, index) => {
                const tercapai = isTpTercapai(index);
                return (
                  <div key={index} className={`group relative p-4 rounded-xl border transition-all duration-200 ${tercapai ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-card hover:border-primary/30 hover:shadow-sm'}`}>
                    <div className="flex gap-3 items-start">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ring-1 ${tercapai ? 'bg-green-500 text-white ring-green-400' : 'bg-primary/10 text-primary ring-primary/20'}`}>
                        {tercapai ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </div>
                      <div className="flex-1">
                        {tercapai ? (
                          <div className="min-h-[80px] px-3 py-2.5 rounded-lg bg-green-100/50 dark:bg-green-900/30 text-sm text-green-800 dark:text-green-300 flex flex-col justify-center">
                            <p className="font-medium">{item.text}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">
                                <Lock className="h-3 w-3 mr-1" />
                                Tercapai - Tidak dapat diedit
                              </Badge>
                            </div>
                          </div>
                        ) : (
                          <Textarea
                            value={item.text}
                            onChange={(e) => handleTujuanChange(index, e.target.value)}
                            placeholder="Masukkan tujuan pembelajaran..."
                            className="min-h-[80px] resize-none border-0 bg-muted/40 focus:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring transition-colors px-3 py-2.5 rounded-lg text-sm"
                            required
                          />
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveTujuan(index)}
                        disabled={tercapai}
                        className={`rounded-lg flex-shrink-0 transition-colors h-8 w-8 ${tercapai ? 'text-muted-foreground/30 cursor-not-allowed' : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <Button 
            type="button" 
            size="sm" 
            variant="outline" 
            onClick={handleAddTujuan} 
            className="w-full rounded-xl gap-2 border-dashed hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Tambah Tujuan Pembelajaran
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-2 border-t">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onCancel} 
          disabled={loading} 
          className="rounded-xl gap-2"
        >
          <X className="h-4 w-4" />
          Batal
        </Button>
        <Button 
          type="submit" 
          disabled={loading} 
          className="rounded-xl gap-2"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Menyimpan...' : 'Simpan'}
        </Button>
      </div>
    </form>
  );
}
