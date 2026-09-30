import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, ScrollText, Sparkles } from "lucide-react";

interface SetoranItem {
  id: string;
  kategori: "quran" | "hadist" | "doa";
  judul: string;
  tanggal: string;
  nilai: number;
  status: "lancar" | "belum_lancar" | "lanjut_besok";
  catatan?: string | null;
  audioUrl?: string | null;
  audioType?: "recording" | "drive";
}

interface EditSetoranDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setoran: SetoranItem | null;
  onSuccess: () => void;
}

export function EditSetoranDrawer({ open, onOpenChange, setoran, onSuccess }: EditSetoranDrawerProps) {
  const [nilai, setNilai] = useState("");
  const [status, setStatus] = useState("");
  const [catatan, setCatatan] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (setoran) {
      setNilai(String(setoran.nilai || ""));
      setStatus(setoran.status);
      setCatatan(setoran.catatan || "");
    }
  }, [setoran]);

  const handleSave = async () => {
    if (!setoran) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("setoran_hafalan")
        .update({
          nilai: Number(nilai) || 0,
          status,
          catatan: catatan || null,
        })
        .eq("id", setoran.id);

      if (error) throw error;
      toast.success("Data setoran berhasil diperbarui");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setIsSaving(false);
    }
  };

  if (!setoran) return null;

  const kategoriConfig = {
    hadist: { icon: ScrollText, label: "Hadist", color: "bg-blue-100 text-blue-700" },
    doa: { icon: Sparkles, label: "Doa", color: "bg-purple-100 text-purple-700" },
  };
  const config = kategoriConfig[setoran.kategori];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            Detail Setoran
            <Badge className={config.color}>{config.label}</Badge>
          </DrawerTitle>
        </DrawerHeader>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            <div>
              <Label>Judul</Label>
              <Input value={setoran.judul} disabled className="mt-1" />
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input value={new Date(setoran.tanggal).toLocaleDateString("id-ID")} disabled className="mt-1" />
            </div>
            <div>
              <Label>Nilai</Label>
              <Input type="number" value={nilai} onChange={e => setNilai(e.target.value)} className="mt-1" min={0} max={100} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lancar">Lancar</SelectItem>
                  <SelectItem value="belum_lancar">Belum Lancar</SelectItem>
                  <SelectItem value="lanjut_besok">Lanjut Besok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea value={catatan} onChange={e => setCatatan(e.target.value)} className="mt-1" rows={3} />
            </div>
          </div>
        </ScrollArea>
        <DrawerFooter>
          <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
