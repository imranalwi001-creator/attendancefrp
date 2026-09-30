import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Materi } from '@/types';
import { Save, Upload, X, Plus, FileText, Image, Video, Link, ChevronDown, Check, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ContentBlock from './ContentBlock';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { MateriAiStudio } from './MateriAiStudio';
import { useAuth } from '@/contexts/AuthContext';


interface TujuanPembelajaranItem {
  text: string;
}

interface TpStatus {
  tp_index: number;
  status: 'tercapai' | 'belum_tercapai';
}

interface UnachievedTpFromSession {
  tpIndex: number;
  sessionCount: number; // How many sessions had this TP unachieved
}

interface MateriFormProps {
  materi?: Materi;
  mapelId: string;
  semester: 'ganjil' | 'genap';
  onBack: () => void;
  onSave: (materi: Partial<Materi>) => void;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  loading?: boolean;
  renderFooter?: boolean;
  readOnly?: boolean;
  // Pre-cached data for performance optimization
  cachedTujuanPembelajaran?: TujuanPembelajaranItem[];
  cachedTpStatus?: TpStatus[];
}

export default function MateriForm({ materi, mapelId, semester, onBack, onSave, onSaveDraft, onPublish, loading: externalLoading, renderFooter = true, readOnly = false, cachedTujuanPembelajaran, cachedTpStatus }: MateriFormProps) {
  const { user } = useAuth();
  const canUseAi = !readOnly && ['guru', 'walikelas', 'pembina', 'guru_ekskul'].includes(String(user?.role || '').toLowerCase());

  const parseKonten = (konten: any) => {
    if (!konten) return [];
    if (Array.isArray(konten)) return konten;
    try {
      return JSON.parse(konten);
    } catch {
      return [];
    }
  };

  const normalizeTpIds = (raw: any): number[] => {
    if (!raw) return [];

    // Most common expected type: number[]
    if (Array.isArray(raw)) {
      return raw
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n));
    }

    // Sometimes PostgREST/metadata can arrive as JSON string e.g. "[0,1]" or "{0,1}"
    if (typeof raw === 'string') {
      const s = raw.trim();
      if (!s) return [];

      // JSON array string
      if (s.startsWith('[') && s.endsWith(']')) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            return parsed.map((v) => Number(v)).filter((n) => Number.isFinite(n));
          }
        } catch { /* ignore */ }
      }

      // Postgres array string: "{0,1,2}"
      if (s.startsWith('{') && s.endsWith('}')) {
        const inner = s.slice(1, -1).trim();
        if (!inner) return [];
        return inner
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((n) => Number.isFinite(n));
      }

      // Single numeric string
      const asNum = Number(s);
      return Number.isFinite(asNum) ? [asNum] : [];
    }

    return [];
  };

  const getInitialFormData = () => ({
    bab: (materi as any)?.deskripsi || materi?.bab || '',
    judul: materi?.judul || '',
    status: materi?.status || 'aktif',
    konten: parseKonten((materi as any)?.konten) as { tipe: 'text' | 'image' | 'video' | 'link'; value: string }[],
    tujuan_pembelajaran_ids: normalizeTpIds((materi as any)?.tujuan_pembelajaran_ids),
  });

  const [formData, setFormData] = useState(getInitialFormData());
  const [originalData, setOriginalData] = useState<typeof formData | null>(null);
  const lastMateriIdRef = useRef<string | null>(null);

  const [tujuanPembelajaranList, setTujuanPembelajaranList] = useState<TujuanPembelajaranItem[]>(cachedTujuanPembelajaran || []);
  const [tpStatusList, setTpStatusList] = useState<TpStatus[]>(cachedTpStatus || []);
  const [usedPertemuan, setUsedPertemuan] = useState<string[]>([]);
  const [usedTpIds, setUsedTpIds] = useState<number[]>([]); // TP yang sudah digunakan materi lain
  const [unachievedFromSessions, setUnachievedFromSessions] = useState<UnachievedTpFromSession[]>([]); // TP belum tercapai dari sesi sebelumnya
  const [hasAttendanceData, setHasAttendanceData] = useState(readOnly); // In readOnly mode, assume it has attendance data

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  // Sync state saat `materi` prop berubah (sheet dibuka dulu, data lengkap menyusul)
  useEffect(() => {
    const materiId = materi?.id ?? null;
    if (lastMateriIdRef.current === materiId) return;
    lastMateriIdRef.current = materiId;

    const initial = getInitialFormData();
    setFormData(initial);
    setOriginalData(materi ? initial : null);
  }, [materi]);

  // Check if form has changes (dirty state)
  const hasChanges = (): boolean => {
    if (!materi) return true; // New materi is always "dirty"
    if (!originalData) return false;
    
    if (originalData.bab !== formData.bab) return true;
    if (originalData.judul !== formData.judul) return true;
    if (originalData.status !== formData.status) return true;
    if (JSON.stringify(originalData.konten) !== JSON.stringify(formData.konten)) return true;
    if (JSON.stringify(originalData.tujuan_pembelajaran_ids) !== JSON.stringify(formData.tujuan_pembelajaran_ids)) return true;
    
    return false;
  };

  const isDirty = hasChanges();

  // Check if this materi has attendance data (sesi_pembelajaran) - skip in readOnly mode
  useEffect(() => {
    if (readOnly) return; // Skip fetch in readOnly mode
    
    const checkAttendanceData = async () => {
      if (!materi?.id) {
        setHasAttendanceData(false);
        return;
      }
      
      try {
        // Check if there's any sesi_pembelajaran linked to this materi
        const { data, error } = await supabase
          .from('sesi_pembelajaran')
          .select('id, metadata')
          .not('metadata', 'is', null);

        if (error) throw error;

        // Check if any session has this materi_id in metadata
        const hasData = data?.some(session => {
          const metadata = session.metadata as any;
          return metadata?.materi_id === materi.id;
        }) || false;
        
        setHasAttendanceData(hasData);
      } catch (error) {
        console.error('Error checking attendance data:', error);
        setHasAttendanceData(false);
      }
    };

    checkAttendanceData();
  }, [materi?.id, readOnly]);

  // Fetch pertemuan dan TP yang sudah digunakan oleh materi lain - skip in readOnly mode
  useEffect(() => {
    if (readOnly) return; // Skip fetch in readOnly mode
    
    const fetchUsedData = async () => {
      if (!mapelId) return;
      
      try {
        const { data, error } = await supabase
          .from('materi')
          .select('id, deskripsi, tujuan_pembelajaran_ids')
          .eq('mapel_id', mapelId)
          .eq('semester', semester);

        if (error) throw error;

        if (data) {
          // Filter out the current materi being edited
          const otherMateri = data.filter(m => m.id !== materi?.id);
          
          // Get used pertemuan
          const usedList = otherMateri
            .map(m => m.deskripsi)
            .filter((desc): desc is string => !!desc && desc.startsWith('Pertemuan'));
          setUsedPertemuan(usedList);
          
          // Get used TP IDs from other materi
          const usedTps = otherMateri
            .flatMap(m => normalizeTpIds((m as any).tujuan_pembelajaran_ids))
            .filter((id): id is number => id !== null && id !== undefined);
          setUsedTpIds([...new Set(usedTps)]); // Remove duplicates
        }
      } catch (error) {
        console.error('Error fetching used data:', error);
      }
    };

    fetchUsedData();
  }, [mapelId, semester, materi?.id, readOnly]);

  // Check if a pertemuan is already used
  const isPertemuanUsed = (pertemuan: string): boolean => {
    return usedPertemuan.includes(pertemuan);
  };

  // Helper to check if TP is already achieved
  const isTpTercapai = (index: number): boolean => {
    return tpStatusList.some(s => s.tp_index === index && s.status === 'tercapai');
  };

  // Helper to check if TP is already used by other materi
  const isTpUsedByOther = (index: number): boolean => {
    return usedTpIds.includes(index);
  };

  // Helper to check if TP is unachieved from previous sessions
  const isTpUnachievedFromSession = (index: number): boolean => {
    return unachievedFromSessions.some(u => u.tpIndex === index);
  };

  // Check if all TPs are tercapai
  const allTpsTercapai = tujuanPembelajaranList.length > 0 && 
    tujuanPembelajaranList.every((_, index) => isTpTercapai(index));

  // Should hide the TP dropdown
  const shouldHideTpDropdown = allTpsTercapai && hasAttendanceData;

  // Fetch TP yang belum tercapai dari sesi-sesi sebelumnya
  useEffect(() => {
    if (readOnly) return;
    
    const fetchUnachievedFromSessions = async () => {
      if (!mapelId) {
        console.log('[MateriForm] No mapelId for unachieved TP fetch');
        return;
      }
      
      try {
        console.log('[MateriForm] Fetching unachieved TPs for mapelId:', mapelId);
        
        // 1. Ambil jadwal_id untuk mapel ini
        const { data: jadwalData, error: jadwalError } = await supabase
          .from('jadwal')
          .select('id')
          .eq('mapel_id', mapelId);
        
        if (jadwalError) {
          console.error('[MateriForm] Error fetching jadwal:', jadwalError);
          return;
        }
        
        if (!jadwalData?.length) {
          console.log('[MateriForm] No jadwal found for mapel');
          return;
        }
        
        const jadwalIds = jadwalData.map(j => j.id);
        console.log('[MateriForm] Found jadwal IDs:', jadwalIds);
        
        // 2. Cari sesi yang sudah selesai dengan materi_id
        const { data: completedSessions, error: sessionError } = await supabase
          .from('sesi_pembelajaran')
          .select('id, metadata')
          .in('jadwal_id', jadwalIds)
          .eq('status', 'selesai');
        
        if (sessionError) {
          console.error('[MateriForm] Error fetching sessions:', sessionError);
          return;
        }
        
        if (!completedSessions?.length) {
          console.log('[MateriForm] No completed sessions found');
          return;
        }
        
        console.log('[MateriForm] Found completed sessions:', completedSessions.length);
        
        // 3. Filter sesi yang memiliki materi_id di metadata
        const sessionsWithMateri = completedSessions.filter(s => {
          const metadata = s.metadata as { materi_id?: string } | null;
          return metadata?.materi_id;
        });
        
        if (!sessionsWithMateri.length) {
          console.log('[MateriForm] No sessions with materi_id in metadata');
          return;
        }
        
        console.log('[MateriForm] Sessions with materi:', sessionsWithMateri.length);
        
        // 4. Ambil data materi untuk setiap sesi
        const materiIds = [...new Set(sessionsWithMateri.map(s => {
          const metadata = s.metadata as { materi_id: string };
          return metadata.materi_id;
        }))];
        
        console.log('[MateriForm] Materi IDs from sessions:', materiIds);
        
        const { data: materiList, error: materiError } = await supabase
          .from('materi')
          .select('id, tujuan_pembelajaran_ids')
          .in('id', materiIds);
        
        if (materiError) {
          console.error('[MateriForm] Error fetching materi:', materiError);
          return;
        }
        
        if (!materiList?.length) {
          console.log('[MateriForm] No materi found');
          return;
        }
        
        console.log('[MateriForm] Materi list:', materiList);
        
        // 5. Kumpulkan SEMUA TP yang pernah ada di materi & SEMUA TP yang sudah tercapai
        const allMateriTpIndexes = new Set<number>();
        const allAchievedTpIndexes = new Set<number>();
        
        sessionsWithMateri.forEach(session => {
          const metadata = session.metadata as { materi_id: string; tujuan_tercapai_ids?: number[] };
          const materiId = metadata.materi_id;
          const materiData = materiList.find(m => m.id === materiId);
          
          if (!materiData?.tujuan_pembelajaran_ids) return;
          
          const materiTpIds = materiData.tujuan_pembelajaran_ids as number[];
          const achievedTpIds = (metadata.tujuan_tercapai_ids || []) as number[];
          
          console.log('[MateriForm] Session analysis:', {
            sessionId: session.id,
            materiId,
            materiTpIds,
            achievedTpIds
          });
          
          // Kumpulkan semua TP dari materi
          materiTpIds.forEach(tpId => allMateriTpIndexes.add(tpId));
          
          // Kumpulkan semua TP yang sudah tercapai di sesi manapun
          achievedTpIds.forEach(tpId => allAchievedTpIndexes.add(tpId));
        });
        
        console.log('[MateriForm] All materi TP indexes:', [...allMateriTpIndexes]);
        console.log('[MateriForm] All achieved TP indexes:', [...allAchievedTpIndexes]);
        
        // 6. TP belum tercapai = TP yang ada di materi TAPI tidak pernah tercapai di sesi manapun
        const unachievedList: UnachievedTpFromSession[] = [];
        allMateriTpIndexes.forEach(tpId => {
          if (!allAchievedTpIndexes.has(tpId)) {
            unachievedList.push({
              tpIndex: tpId,
              sessionCount: 1
            });
          }
        });
        
        console.log('[MateriForm] Unachieved TPs:', unachievedList);
        
        setUnachievedFromSessions(unachievedList);
      } catch (error) {
        console.error('Error fetching unachieved TPs from sessions:', error);
      }
    };
    
    fetchUnachievedFromSessions();
  }, [mapelId, readOnly]);

  // Fetch Tujuan Pembelajaran dan status dari mapel_info dan tujuan_pembelajaran_status
  // Skip if cached data is provided or in readOnly mode with cached data
  useEffect(() => {
    // If cached data is provided and sufficient, skip fetching
    if (cachedTujuanPembelajaran && cachedTujuanPembelajaran.length > 0) {
      setTujuanPembelajaranList(cachedTujuanPembelajaran);
    }
    if (cachedTpStatus && cachedTpStatus.length > 0) {
      setTpStatusList(cachedTpStatus);
    }
    
    // Skip fetching if we have cached data
    if (cachedTujuanPembelajaran && cachedTpStatus) return;
    
    const fetchTujuanPembelajaran = async () => {
      if (!mapelId) {
        console.log('[MateriForm] No mapelId provided');
        return;
      }
      
      console.log('[MateriForm] Fetching tujuan pembelajaran for mapelId:', mapelId);
      
      try {
        // Fetch tujuan pembelajaran only if not cached
        if (!cachedTujuanPembelajaran) {
          const { data, error } = await supabase
            .from('mapel_info')
            .select('tujuan_pembelajaran')
            .eq('mapel_id', mapelId)
            .maybeSingle();

          console.log('[MateriForm] Response:', { data, error });

          if (error) throw error;

          if (data?.tujuan_pembelajaran) {
            const tpData = data.tujuan_pembelajaran;
            let items: TujuanPembelajaranItem[] = [];
            
            if (Array.isArray(tpData)) {
              items = tpData.map((item: any) => ({
                text: typeof item === 'string' ? item : item?.text || ''
              }));
            }
            
            console.log('[MateriForm] Parsed items:', items);
            setTujuanPembelajaranList(items);
          } else {
            console.log('[MateriForm] No tujuan_pembelajaran data found');
            setTujuanPembelajaranList([]);
          }
        }

        // Fetch TP status from tujuan_pembelajaran_status only if not cached
        if (!cachedTpStatus) {
          const { data: academicYear } = await supabase
            .from('academic_years')
            .select('id')
            .eq('is_active', true)
            .single();

          if (academicYear) {
            const { data: statusData } = await supabase
              .from('tujuan_pembelajaran_status')
              .select('tp_index, status')
              .eq('mapel_id', mapelId)
              .eq('semester', semester)
              .eq('academic_year_id', academicYear.id);

            if (statusData) {
              setTpStatusList(statusData as TpStatus[]);
            }
          }
        }
      } catch (error) {
        console.error('[MateriForm] Error fetching tujuan pembelajaran:', error);
      }
    };

    fetchTujuanPembelajaran();
  }, [mapelId, semester, cachedTujuanPembelajaran, cachedTpStatus]);

  const handleAddContent = (tipe: 'text' | 'image' | 'video' | 'link') => {
    setFormData({
      ...formData,
      konten: [...formData.konten, { tipe, value: '' }],
    });
  };

  const handleAppendTextBlock = (html: string) => {
    if (!html) return;
    setFormData((prev) => ({
      ...prev,
      konten: [...prev.konten, { tipe: 'text', value: html }],
    }));
  };

  const handleContentChange = (index: number, value: string) => {
    const newKonten = [...formData.konten];
    newKonten[index].value = value;
    setFormData({ ...formData, konten: newKonten });
  };

  const handleRemoveContent = (index: number) => {
    const newKonten = formData.konten.filter((_, i) => i !== index);
    setFormData({ ...formData, konten: newKonten });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newKonten = [...formData.konten];
    const draggedItem = newKonten[draggedIndex];
    
    newKonten.splice(draggedIndex, 1);
    newKonten.splice(index, 0, draggedItem);
    
    setFormData({ ...formData, konten: newKonten });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    // Prevent double submission
    if (loading || externalLoading) return;
    
    if (!formData.bab || !formData.judul) {
      toast({
        title: "Form tidak lengkap",
        description: "Harap isi Bab dan Judul Materi.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const normalizedTpIds = normalizeTpIds(formData.tujuan_pembelajaran_ids);
      const materiData = {
        mapel_id: mapelId,
        judul: formData.judul,
        deskripsi: formData.bab,
        tipe_konten: 'mixed',
        konten: JSON.stringify(formData.konten),
        status: formData.status,
        semester: semester,
        urutan: 0,
        tujuan_pembelajaran_ids: normalizedTpIds,
      };

      console.log('[MateriForm] Saving materi payload:', {
        mapel_id: mapelId,
        judul: formData.judul,
        status: formData.status,
        semester,
        tujuan_pembelajaran_ids_raw: formData.tujuan_pembelajaran_ids,
        tujuan_pembelajaran_ids_normalized: normalizedTpIds,
      });

      if (materi?.id) {
        const { error } = await supabase
          .from('materi')
          .update(materiData)
          .eq('id', materi.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('materi')
          .insert([materiData]);

        if (error) throw error;
      }

      toast({
        title: "Materi berhasil disimpan",
        description: `"${formData.judul}" telah disimpan dengan status ${formData.status}.`,
      });

      onSave({
        ...materi,
        mapelId,
        bab: formData.bab,
        judul: formData.judul,
        status: formData.status as 'draft' | 'aktif' | 'arsip',
        konten: formData.konten,
        createdAt: materi?.createdAt || new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[MateriForm] Save error object:', error);
      toast({
        title: "Error",
        description: error?.message || error?.details || "Gagal menyimpan materi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    // Prevent double submission
    if (loading || externalLoading) return;
    
    if (!formData.bab || !formData.judul) {
      toast({
        title: "Form tidak lengkap",
        description: "Harap isi Bab dan Judul Materi.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const normalizedTpIds = normalizeTpIds(formData.tujuan_pembelajaran_ids);
      const materiData = {
        mapel_id: mapelId,
        judul: formData.judul,
        deskripsi: formData.bab,
        tipe_konten: 'mixed',
        konten: JSON.stringify(formData.konten),
        status: 'aktif',
        semester: semester,
        urutan: 0,
        tujuan_pembelajaran_ids: normalizedTpIds,
      };

      console.log('[MateriForm] Publishing materi payload:', {
        mapel_id: mapelId,
        judul: formData.judul,
        semester,
        tujuan_pembelajaran_ids_raw: formData.tujuan_pembelajaran_ids,
        tujuan_pembelajaran_ids_normalized: normalizedTpIds,
      });

      if (materi?.id) {
        const { error } = await supabase
          .from('materi')
          .update(materiData)
          .eq('id', materi.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('materi')
          .insert([materiData]);

        if (error) throw error;
      }

      toast({
        title: "Materi dipublikasikan",
        description: `"${formData.judul}" sekarang aktif dan dapat dilihat santri.`,
      });

      onSave({
        ...materi,
        mapelId,
        bab: formData.bab,
        judul: formData.judul,
        status: 'aktif',
        konten: formData.konten,
        createdAt: materi?.createdAt || new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[MateriForm] Publish error object:', error);
      toast({
        title: "Error",
        description: error?.message || error?.details || "Gagal mempublikasikan materi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Form Utama */}
      <Card className="rounded-2xl border border-border/50 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b px-6 py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            Informasi Materi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bab" className="text-sm font-semibold">Bab / Topik {!readOnly && <span className="text-destructive">*</span>}</Label>
                {readOnly ? (
                  <div className="px-3 py-2 rounded-xl border border-border/50 bg-muted/30 text-sm">
                    {formData.bab || '-'}
                  </div>
                ) : (
                  <Select 
                    value={formData.bab} 
                    onValueChange={(value) => setFormData({ ...formData, bab: value })}
                  >
                    <SelectTrigger className="rounded-xl border-border/50 focus:border-primary">
                      <SelectValue placeholder="Pilih pertemuan" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 17 }, (_, i) => {
                        const pertemuanValue = `Pertemuan ${i + 1}`;
                        const isUsed = isPertemuanUsed(pertemuanValue);
                        return (
                          <SelectItem 
                            key={i + 1} 
                            value={pertemuanValue}
                            disabled={isUsed}
                            className={isUsed ? "opacity-50" : ""}
                          >
                            <div className="flex items-center gap-2">
                              <span>Pertemuan {i + 1}</span>
                              {isUsed && (
                                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                                  Sudah Dilaksanakan
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-sm font-semibold">Status</Label>
                {readOnly ? (
                  <div className="px-3 py-2 rounded-xl border border-border/50 bg-muted/30 text-sm">
                    <Badge variant={formData.status === 'aktif' ? 'default' : formData.status === 'arsip' ? 'outline' : 'secondary'}>
                      {formData.status === 'aktif' ? 'Aktif' : formData.status === 'arsip' ? 'Arsip' : 'Draft'}
                    </Badge>
                  </div>
                ) : (
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({ ...formData, status: value as 'draft' | 'aktif' | 'arsip' })}
                  >
                    <SelectTrigger className="rounded-xl border-border/50 focus:border-primary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="aktif">Aktif</SelectItem>
                      <SelectItem value="arsip">Arsip</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tujuan_pembelajaran" className="text-sm font-semibold">
                Tujuan Pembelajaran {!readOnly && <span className="text-destructive">*</span>}
              </Label>
              {!shouldHideTpDropdown && !readOnly && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        "w-full justify-between rounded-xl border-border/50 focus:border-primary font-normal",
                        formData.tujuan_pembelajaran_ids.length === 0 && "text-muted-foreground"
                      )}
                    >
                      {formData.tujuan_pembelajaran_ids.length === 0
                        ? "Pilih tujuan pembelajaran"
                        : `${formData.tujuan_pembelajaran_ids.length} tujuan dipilih`}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="min-w-[var(--radix-popover-trigger-width)] p-0 rounded-xl bg-popover" align="start">
                    <div
                      className="h-60 overflow-y-auto overscroll-contain p-2 space-y-1"
                      onWheel={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      {tujuanPembelajaranList.length === 0 ? (
                        <div className="py-3 px-4 text-sm text-muted-foreground text-center">
                          Belum ada tujuan pembelajaran
                        </div>
                      ) : (
                        tujuanPembelajaranList
                          .map((item, index) => ({ item, index }))
                          .filter(({ index }) => {
                            // Tampilkan TP jika:
                            // 1. Sudah tercapai (boleh dipilih ulang untuk review)
                            // 2. Belum tercapai (selalu boleh dipilih, walau sudah dialokasikan ke materi lain)
                            // 3. Sudah dipilih di form ini (kasus edit)
                            const isAchieved = isTpTercapai(index);
                            const isSelectedInForm = formData.tujuan_pembelajaran_ids.includes(index);

                            // Selalu tampilkan TP yang belum tercapai agar guru bisa memilihnya ulang
                            // bila materi sebelumnya belum berhasil mengantarkan TP itu tercapai.
                            if (!isAchieved) return true;

                            // TP tercapai tetap ditampilkan
                            return isAchieved || isSelectedInForm;
                          })
                          // Sort: unachieved from sessions first, then others
                          .sort((a, b) => {
                            const aUnachieved = isTpUnachievedFromSession(a.index);
                            const bUnachieved = isTpUnachievedFromSession(b.index);
                            const aTercapai = isTpTercapai(a.index);
                            const bTercapai = isTpTercapai(b.index);
                            
                            // Unachieved from sessions come first
                            if (aUnachieved && !bUnachieved) return -1;
                            if (!aUnachieved && bUnachieved) return 1;
                            // Then tercapai goes last
                            if (aTercapai && !bTercapai) return 1;
                            if (!aTercapai && bTercapai) return -1;
                            return a.index - b.index;
                          })
                          .map(({ item, index }) => {
                            const tercapai = isTpTercapai(index);
                            const unachievedFromSession = isTpUnachievedFromSession(index);
                            return (
                              <div
                                key={index}
                                className={cn(
                                  "flex items-center space-x-2 p-2 rounded-lg cursor-pointer",
                                  tercapai 
                                    ? "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50" 
                                    : unachievedFromSession
                                    ? "bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 border border-orange-200 dark:border-orange-800/50"
                                    : "hover:bg-muted"
                                )}
                                onClick={() => {
                                  const newIds = formData.tujuan_pembelajaran_ids.includes(index)
                                    ? formData.tujuan_pembelajaran_ids.filter(id => id !== index)
                                    : [...formData.tujuan_pembelajaran_ids, index];
                                  setFormData({ ...formData, tujuan_pembelajaran_ids: newIds });
                                }}
                              >
                                <Checkbox
                                  checked={formData.tujuan_pembelajaran_ids.includes(index)}
                                  onCheckedChange={(checked) => {
                                    const newIds = checked
                                      ? [...formData.tujuan_pembelajaran_ids, index]
                                      : formData.tujuan_pembelajaran_ids.filter(id => id !== index);
                                    setFormData({ ...formData, tujuan_pembelajaran_ids: newIds });
                                  }}
                                />
                                <span className="text-sm flex-1">
                                  {item.text}
                                </span>
                                {tercapai ? (
                                  <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800 text-xs shrink-0">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Tercapai
                                  </Badge>
                                ) : unachievedFromSession && (
                                  <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400 border-orange-200 dark:border-orange-800 text-xs shrink-0">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Belum Tercapai
                                  </Badge>
                                )}
                              </div>
                            );
                          })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {(() => {
                // Only show TPs that are selected for this materi (originally set when creating)
                const displayIds = [...formData.tujuan_pembelajaran_ids].sort((a, b) => a - b);
                
                if (displayIds.length === 0) return null;
                
                return (
                  <div className="flex flex-col gap-1.5 mt-2">
                    {displayIds.map((id, index) => {
                      const tercapai = isTpTercapai(id);
                      const isSelected = formData.tujuan_pembelajaran_ids.includes(id);
                      return (
                        <span
                          key={id}
                          className={cn(
                            "inline-flex items-center gap-2 px-2 py-1.5 text-sm rounded-md",
                            tercapai 
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" 
                              : "bg-primary/10 text-primary"
                          )}
                        >
                          <span className="font-semibold">{index + 1}.</span>
                          <span className="flex-1">{tujuanPembelajaranList[id]?.text}</span>
                          {tercapai && (
                            <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800 text-xs shrink-0">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Tercapai
                            </Badge>
                          )}
                          <X
                            className="h-3 w-3 cursor-pointer hover:text-destructive shrink-0"
                            onClick={() => {
                              setFormData({
                                ...formData,
                                tujuan_pembelajaran_ids: formData.tujuan_pembelajaran_ids.filter(i => i !== id)
                              });
                            }}
                          />
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="judul" className="text-sm font-semibold">Judul Materi {!readOnly && <span className="text-destructive">*</span>}</Label>
              {readOnly ? (
                <div className="px-3 py-2 rounded-xl border border-border/50 bg-muted/30 text-sm font-medium">
                  {formData.judul || '-'}
                </div>
              ) : (
                <Input
                  id="judul"
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  placeholder="Masukkan judul materi yang jelas dan deskriptif"
                  className="rounded-xl border-border/50 focus:border-primary transition-colors"
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Konten Dinamis */}
      <Card className="rounded-2xl border border-border/50 shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-muted/30 to-muted/10 border-b px-6 py-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            Konten Materi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {canUseAi && (
              <MateriAiStudio
                mapelId={mapelId}
                semester={semester}
                judul={formData.judul}
                bab={formData.bab}
                konten={formData.konten}
                onAppendTextBlock={handleAppendTextBlock}
              />
            )}

            {/* Tombol Tambah Konten - hide in readOnly mode */}
            {!readOnly && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddContent('text')}
                className="group rounded-xl h-auto py-3 px-4 justify-start gap-3 border-2 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30 dark:hover:border-blue-700 transition-all duration-200 hover:shadow-md"
              >
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Tambah Teks</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddContent('image')}
                className="group rounded-xl h-auto py-3 px-4 justify-start gap-3 border-2 hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-950/30 dark:hover:border-green-700 transition-all duration-200 hover:shadow-md"
              >
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50 group-hover:bg-green-200 dark:group-hover:bg-green-800 transition-colors">
                  <Image className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-semibold text-green-700 dark:text-green-300">Tambah Gambar</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddContent('video')}
                className="group rounded-xl h-auto py-3 px-4 justify-start gap-3 border-2 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/30 dark:hover:border-purple-700 transition-all duration-200 hover:shadow-md"
              >
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/50 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 transition-colors">
                  <Video className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Tambah Video</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddContent('link')}
                className="group rounded-xl h-auto py-3 px-4 justify-start gap-3 border-2 hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-orange-950/30 dark:hover:border-orange-700 transition-all duration-200 hover:shadow-md"
              >
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/50 group-hover:bg-orange-200 dark:group-hover:bg-orange-800 transition-colors">
                  <Link className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">Tambah Link</span>
              </Button>
              </div>
            )}

            {formData.konten.length > 0 && <Separator className="my-2" />}

            {/* Blok Konten */}
            {formData.konten.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/20">
                <div className="p-3 rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium mb-1">
                  {readOnly ? 'Tidak ada konten' : 'Belum ada konten'}
                </p>
                {!readOnly && (
                  <p className="text-xs text-muted-foreground">
                    Klik tombol di atas untuk menambahkan konten
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {formData.konten.map((item, index) => (
                  <ContentBlock
                    key={index}
                    tipe={item.tipe}
                    value={item.value}
                    index={index}
                    onChange={(value) => handleContentChange(index, value)}
                    onRemove={() => handleRemoveContent(index)}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons - only render if renderFooter is true */}
      {renderFooter && (
        <Card className="rounded-2xl border border-border/50 shadow-md bg-gradient-to-r from-muted/20 to-muted/10">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <Button 
                variant="outline" 
                onClick={onBack}
                className="rounded-xl w-full md:w-auto order-2 md:order-1 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto order-1 md:order-2">
                <Button 
                  variant="secondary"
                  onClick={onSaveDraft || handleSave}
                  className="rounded-xl w-full md:w-auto shadow-sm hover:shadow-md transition-all"
                  disabled={externalLoading !== undefined ? externalLoading : loading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {(externalLoading !== undefined ? externalLoading : loading) ? 'Menyimpan...' : 'Simpan Draft'}
                </Button>
                <Button 
                  onClick={onPublish || handlePublish}
                  className="rounded-xl w-full md:w-auto shadow-md hover:shadow-lg transition-all bg-primary hover:bg-primary/90"
                  disabled={externalLoading !== undefined ? externalLoading : loading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {(externalLoading !== undefined ? externalLoading : loading) ? 'Menyimpan...' : 'Publikasikan'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden trigger buttons for external footer */}
      {!renderFooter && (
        <>
          <input 
            type="hidden" 
            data-materi-is-dirty 
            value={isDirty.toString()} 
          />
          <button 
            type="button" 
            data-materi-save-draft 
            onClick={() => {
              if (loading || externalLoading) return;
              handleSave();
              // Update original data after save
              setTimeout(() => setOriginalData({ ...formData }), 100);
            }} 
            className="hidden" 
            aria-hidden="true"
          />
          <button 
            type="button" 
            data-materi-publish 
            onClick={() => {
              if (loading || externalLoading) return;
              handlePublish();
            }} 
            className="hidden" 
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
