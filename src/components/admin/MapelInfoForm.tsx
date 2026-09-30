import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save, X, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MapelInfoFormProps {
  mapelId: string;
  mapelInfo: any;
  onSave: () => void;
  onCancel: () => void;
}

interface CapaianItem {
  text: string;
}

export default function MapelInfoForm({
  mapelId,
  mapelInfo,
  onSave,
  onCancel
}: MapelInfoFormProps) {
  const { toast } = useToast();
  const [capaianList, setCapaianList] = useState<CapaianItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mapelInfo) {
      // Parse capaian_pembelajaran
      if (mapelInfo.capaian_pembelajaran && Array.isArray(mapelInfo.capaian_pembelajaran)) {
        setCapaianList(mapelInfo.capaian_pembelajaran.map((item: any) => ({
          text: typeof item === 'string' ? item : item.text || ''
        })));
      }
    }
  }, [mapelInfo]);

  const handleAddCapaian = () => {
    setCapaianList([...capaianList, { text: '' }]);
  };

  const handleRemoveCapaian = (index: number) => {
    setCapaianList(capaianList.filter((_, i) => i !== index));
  };

  const handleCapaianChange = (index: number, value: string) => {
    const newList = [...capaianList];
    newList[index] = { text: value };
    setCapaianList(newList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Filter out empty items
      const filteredCapaian = capaianList.filter(item => item.text.trim() !== '');

      const dataToSave = {
        mapel_id: mapelId,
        capaian_pembelajaran: filteredCapaian as any
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
        description: "Capaian pembelajaran berhasil disimpan"
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
        {/* Capaian Pembelajaran Section */}
        <div className="space-y-4">
          <div className="space-y-3">
            {capaianList.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed rounded-xl bg-muted/30">
                <Target className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground mb-1">Belum ada capaian pembelajaran</p>
                <p className="text-xs text-muted-foreground/70">Klik tombol di bawah untuk menambahkan</p>
              </div>
            ) : (
              capaianList.map((item, index) => (
                <div key={index} className="group relative p-4 rounded-xl border bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200">
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ring-1 ring-primary/20">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <Textarea
                        value={item.text}
                        onChange={(e) => handleCapaianChange(index, e.target.value)}
                        placeholder="Masukkan capaian pembelajaran..."
                        className="min-h-[80px] resize-none border-0 bg-muted/40 focus:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring transition-colors px-3 py-2.5 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveCapaian(index)}
                      className="rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0 transition-colors h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <Button 
            type="button" 
            size="sm" 
            variant="outline" 
            onClick={handleAddCapaian} 
            className="w-full rounded-xl gap-2 border-dashed hover:border-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Tambah Capaian Pembelajaran
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
