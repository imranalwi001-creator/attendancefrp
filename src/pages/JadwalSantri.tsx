import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Clock, MapPin, User, BookOpen, Printer, Calendar, Book, Layers, Coffee, Moon, Pause } from 'lucide-react';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { useLearningBlocks } from '@/hooks/useLearningBlocks';

type JadwalTipe = 'pelajaran' | 'istirahat' | 'tidur_siang' | 'break' | 'piket' | 'piket_makan' | 'piket_masjid';

// Jadwal tipe configuration for display
const JADWAL_TIPE_CONFIG: Record<JadwalTipe, { label: string; icon: React.ReactNode; bgColor: string; textColor: string }> = {
  pelajaran: { label: 'Mata Pelajaran', icon: <Book className="h-5 w-5 sm:h-6 sm:w-6" />, bgColor: 'bg-primary/10', textColor: 'text-primary' },
  istirahat: { label: 'Istirahat', icon: <Coffee className="h-5 w-5 sm:h-6 sm:w-6" />, bgColor: 'bg-amber-500/10', textColor: 'text-amber-600' },
  tidur_siang: { label: 'Tidur Siang', icon: <Moon className="h-5 w-5 sm:h-6 sm:w-6" />, bgColor: 'bg-blue-400/10', textColor: 'text-blue-500' },
  break: { label: 'Break', icon: <Pause className="h-5 w-5 sm:h-6 sm:w-6" />, bgColor: 'bg-slate-400/10', textColor: 'text-slate-500' },
  piket: { label: 'Piket', icon: <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />, bgColor: 'bg-green-500/10', textColor: 'text-green-600' },
  piket_makan: { label: 'Piket Makan', icon: <Coffee className="h-5 w-5 sm:h-6 sm:w-6" />, bgColor: 'bg-orange-500/10', textColor: 'text-orange-600' },
  piket_masjid: { label: 'Piket Masjid', icon: <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />, bgColor: 'bg-teal-500/10', textColor: 'text-teal-600' },
};

interface JadwalItem {
  id: string;
  hari: string;
  jam_mulai: string;
  jam_selesai: string;
  ruangan: string | null;
  pengampu_id: string;
  tipe: JadwalTipe;
  label: string | null;
  mapel: {
    id: string;
    nama: string;
  } | null;
  pengampu: {
    id: string;
    name: string;
  };
}

const ALL_HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const JadwalSantri = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester, isLoading: isLoadingAY } = useAcademicYear();
  const currentSemester = getCurrentSemester();
  
  // Learning blocks hook
  const { 
    activeBlock, 
    isBlockSystem, 
    isLoading: isLoadingBlocks,
    formatBlockLabel
  } = useLearningBlocks();
  
  const [jadwalList, setJadwalList] = useState<JadwalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [kelasId, setKelasId] = useState<string | null>(null);
  const [kelasNama, setKelasNama] = useState<string>('');
  const [childrenOptions, setChildrenOptions] = useState<Array<{ id: string; name: string; kelas_id: string | null; kelas_nama: string }>>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [activeDay, setActiveDay] = useState<string>('Senin');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Get valid days based on block system (keep stable so tabs remain clickable)
  const validDaysList = useMemo(() => {
    if (isBlockSystem && activeBlock && !isLoadingBlocks) {
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

      if (activeBlock.selected_dates && activeBlock.selected_dates.length > 0) {
        const uniqueDays = new Set<string>();
        activeBlock.selected_dates.forEach((dateStr) => {
          const date = new Date(dateStr);
          uniqueDays.add(dayNames[date.getDay()]);
        });

        const ordered = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].filter((d) => uniqueDays.has(d));
        return ordered.length > 0 ? ordered : ALL_HARI_LIST;
      }

      return ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
    }

    return ALL_HARI_LIST;
  }, [isBlockSystem, activeBlock?.id, activeBlock?.selected_dates, isLoadingBlocks]);

  // Get current day
  useEffect(() => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const today = days[new Date().getDay()];
    if (validDaysList.includes(today)) {
      setActiveDay(today);
    } else if (validDaysList.length > 0) {
      setActiveDay(validDaysList[0]);
    }
  }, [validDaysList]);

  // Fetch kelas based on role (santri: own kelas, orangtua: selected child kelas)
  useEffect(() => {
    const fetchKelas = async () => {
      if (!user?.id || !activeAcademicYear) return;

      try {
        setIsLoading(true);

        if (user.role === 'santri') {
          const { data: santriData, error } = await supabase
            .from('santri')
            .select('kelas_id, kelas:kelas_id(nama, tahun_ajaran)')
            .eq('id', user.id)
            .maybeSingle();

          if (error) throw error;

          const kelas = (santriData?.kelas as any) || null;
          if (santriData?.kelas_id && kelas?.tahun_ajaran === activeAcademicYear.name) {
            setKelasId(santriData.kelas_id);
            setKelasNama(kelas?.nama || '');
          } else {
            setKelasId(null);
            setKelasNama('');
          }

          return;
        }

        if (user.role === 'orangtua') {
          const { data: parentChildren, error: pcError } = await supabase
            .from('parent_children')
            .select('child_id')
            .eq('parent_id', user.id);

          if (pcError) throw pcError;

          const childIds = (parentChildren || []).map((pc) => pc.child_id).filter(Boolean);
          if (childIds.length === 0) {
            setChildrenOptions([]);
            setSelectedChildId('');
            setKelasId(null);
            setKelasNama('');
            return;
          }

          const [{ data: santriData, error: santriError }, { data: namesData, error: namesError }] = await Promise.all([
            supabase
              .from('santri')
              .select('id, kelas_id, kelas:kelas_id(nama, tahun_ajaran)')
              .in('id', childIds),
            supabase.rpc('get_profile_names', { _ids: childIds }),
          ]);

          if (santriError) throw santriError;
          if (namesError) throw namesError;

          const nameMap = new Map<string, string>((namesData || []).map((n: any) => [n.id, n.name]));

          const options = (santriData || [])
            .map((s: any) => {
              const kelas = s.kelas as any;
              return {
                id: s.id,
                name: nameMap.get(s.id) || 'Ananda',
                kelas_id: s.kelas_id || null,
                kelas_nama: kelas?.nama || '',
                tahun_ajaran: kelas?.tahun_ajaran || null,
              };
            })
            .filter((o: any) => o.tahun_ajaran === activeAcademicYear.name);

          setChildrenOptions(options);

          const nextSelected = selectedChildId || options[0]?.id || '';
          setSelectedChildId(nextSelected);

          const selected = options.find((o: any) => o.id === nextSelected) || options[0];
          setKelasId(selected?.kelas_id || null);
          setKelasNama(selected?.kelas_nama || '');
          return;
        }

        // Other roles: no schedule here
        setKelasId(null);
        setKelasNama('');
      } catch (e) {
        console.error('Error fetching kelas:', e);
        setKelasId(null);
        setKelasNama('');
        setChildrenOptions([]);
        setSelectedChildId('');
      } finally {
        setIsLoading(false);
      }
    };

    fetchKelas();
  }, [user?.id, user?.role, activeAcademicYear?.name]);

  // When parent switches child, update kelas
  useEffect(() => {
    if (user?.role !== 'orangtua') return;
    if (!selectedChildId) return;
    const selected = childrenOptions.find((c) => c.id === selectedChildId);
    setKelasId(selected?.kelas_id || null);
    setKelasNama(selected?.kelas_nama || '');
  }, [user?.role, selectedChildId, childrenOptions]);

  // Fetch jadwal filtered by current semester and block (if block system)
  useEffect(() => {
    const fetchJadwal = async () => {
      if (!kelasId || !currentSemester) return;
      
      // Wait for blocks to load if using block system
      if (isBlockSystem && isLoadingBlocks) return;

      try {
        setIsLoading(true);

        let query = supabase
          .from('jadwal')
          .select(
            `
            id,
            hari,
            jam_mulai,
            jam_selesai,
            ruangan,
            pengampu_id,
            block_id,
            tipe,
            label,
            mapel:mapel_id(id, nama)
          `
          )
          .eq('kelas_id', kelasId)
          .eq('status', 'aktif')
          .eq('semester', currentSemester);
        
        // Filter by active block if using block system, but also include schedules without block_id (e.g., asrama)
        if (isBlockSystem && activeBlock) {
          query = query.or(`block_id.eq.${activeBlock.id},block_id.is.null`);
        }
        
        const { data, error } = await query.order('jam_mulai', { ascending: true });

        if (error) throw error;

        const rows = data || [];
        const pengampuIds = [...new Set(rows.map((j: any) => j.pengampu_id).filter(Boolean))];

        const { data: namesData, error: namesError } = await supabase.rpc('get_profile_names', {
          _ids: pengampuIds,
        });
        if (namesError) throw namesError;

        const nameMap = new Map<string, string>((namesData || []).map((n: any) => [n.id, n.name]));

        const mapped: JadwalItem[] = rows.map((j: any) => ({
          ...j,
          pengampu: {
            id: j.pengampu_id,
            name: nameMap.get(j.pengampu_id) || 'Guru',
          },
        }));

        setJadwalList(mapped);
      } catch (e) {
        console.error('Error fetching jadwal:', e);
        setJadwalList([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJadwal();
  }, [kelasId, currentSemester, isBlockSystem, activeBlock?.id, isLoadingBlocks]);

  const getJadwalByDay = (hari: string) => {
    return jadwalList.filter(j => j.hari === hari);
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const semesterLabel = currentSemester === 'ganjil' ? 'Ganjil' : 'Genap';
    const tahunAjaran = activeAcademicYear?.name || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Jadwal Pelajaran - ${kelasNama} - Semester ${semesterLabel}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { font-size: 20px; margin-bottom: 4px; }
          .header p { font-size: 14px; color: #666; }
          .header .semester { font-size: 12px; color: #0DA8B6; margin-top: 4px; }
          .day-section { margin-bottom: 20px; }
          .day-title { font-size: 14px; font-weight: 600; color: #0DA8B6; margin-bottom: 8px; padding: 8px 12px; background: #E7F6F8; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 12px; }
          th { background-color: #0DA8B6; color: white; font-weight: 600; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .no-schedule { color: #999; font-style: italic; padding: 12px; text-align: center; }
          .grid-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
          @media print {
            body { padding: 0; }
            @page { margin: 10mm; }
            .grid-container { grid-template-columns: repeat(2, 1fr); }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Jadwal Pelajaran</h1>
          <p>Kelas: ${kelasNama}</p>
          <p class="semester">Semester ${semesterLabel} - Tahun Ajaran ${tahunAjaran}</p>
        </div>
        <div class="grid-container">
          ${validDaysList.map(hari => {
            const jadwalHari = getJadwalByDay(hari);
            return `
              <div class="day-section">
                <div class="day-title">${hari}</div>
                ${jadwalHari.length === 0 
                  ? '<div class="no-schedule">Tidak ada jadwal</div>'
                  : `<table>
                      <thead>
                        <tr>
                          <th style="width: 100px;">Jam</th>
                          <th>Mata Pelajaran</th>
                          <th style="width: 150px;">Guru</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${jadwalHari.map(jadwal => `
                          <tr>
                            <td>${formatTime(jadwal.jam_mulai)} - ${formatTime(jadwal.jam_selesai)}</td>
                            <td>${jadwal.mapel?.nama || '-'}</td>
                            <td>${jadwal.pengampu?.name || '-'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>`
                }
              </div>
            `;
          }).join('')}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const semesterLabel = currentSemester === 'ganjil' ? 'Ganjil' : 'Genap';

  // Show loading state while fetching academic year
  if (isLoadingAY) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Show error if no active academic year
  if (!activeAcademicYear) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => navigate('/app/dashboard')} 
            className="h-9 w-9 rounded-lg"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Jadwal Pelajaran</h1>
        </div>
        <Card className="rounded-xl border-2 border-dashed border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Calendar className="h-10 w-10 text-destructive/50 mb-3" />
            <p className="text-sm text-destructive font-medium">
              Tidak ada tahun ajaran aktif
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Hubungi admin untuk mengaktifkan tahun ajaran
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Gradient - Like Admin */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
        
        <div className="relative flex items-start gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/app/dashboard')} 
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0 shrink-0 mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-primary-foreground line-clamp-2">
              Jadwal Pelajaran {kelasNama}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <BadgeTahunAjaran className="bg-white/20 text-primary-foreground" />
              {isBlockSystem && activeBlock && (
                <Badge className="bg-white/20 text-primary-foreground border-0 gap-1.5">
                  <Layers className="h-3 w-3" />
                  {formatBlockLabel(activeBlock)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs by Day */}
      <Tabs value={activeDay} onValueChange={setActiveDay} className="w-full">
        <TabsList className={`h-12 rounded-xl bg-card border border-border/50 shadow-sm p-1.5 gap-0.5 w-full grid`} style={{ gridTemplateColumns: `repeat(${validDaysList.length}, 1fr)` }}>
          {validDaysList.map(hari => {
            return (
              <TabsTrigger 
                key={hari} 
                value={hari} 
                className="rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-200 px-1"
              >
                <span className="hidden sm:inline">{hari}</span>
                <span className="sm:hidden">{hari.substring(0, 3)}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {validDaysList.map(hari => (
          <TabsContent key={hari} value={hari} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
              </div>
            ) : getJadwalByDay(hari).length === 0 ? (
              <Card className="rounded-xl border-2 border-dashed border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 rounded-full bg-muted/50 mb-3">
                    <BookOpen className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground font-medium">
                    Tidak ada jadwal untuk hari {hari}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-xl border-2 border-border/50 shadow-lg bg-card overflow-hidden">
                <CardHeader className="border-b border-border/50 py-4">
                  <CardTitle className="text-xl font-bold text-foreground">{hari}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-3">
                  {getJadwalByDay(hari).map((jadwal) => {
                    const tipeConfig = JADWAL_TIPE_CONFIG[jadwal.tipe] || JADWAL_TIPE_CONFIG.pelajaran;
                    const displayName = jadwal.tipe === 'pelajaran' || jadwal.tipe === 'mapel' as JadwalTipe
                      ? (jadwal.mapel?.nama || 'Mata Pelajaran')
                      : (jadwal.label || tipeConfig.label);

                    return (
                      <Card key={jadwal.id} className="rounded-2xl border-2 border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
                        <CardContent className="p-4 sm:p-6">
                          <div className="flex items-center justify-between gap-4 sm:gap-8">
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                              <div className="flex-shrink-0">
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${tipeConfig.bgColor} flex items-center justify-center`}>
                                  <span className={tipeConfig.textColor}>{tipeConfig.icon}</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 min-w-0">
                                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                                  {displayName}
                                </h3>
                                {jadwal.tipe === 'pelajaran' || jadwal.tipe === 'mapel' as JadwalTipe ? (
                                  <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                                    <User className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">{jadwal.pengampu?.name || '-'}</span>
                                  </div>
                                ) : (
                                  <span className={`text-xs sm:text-sm ${tipeConfig.textColor}`}>
                                    {tipeConfig.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                              {jadwal.ruangan && (
                                <Badge variant="outline" className="rounded-lg hidden sm:flex gap-1.5 text-xs">
                                  <MapPin className="h-3 w-3" />
                                  {jadwal.ruangan}
                                </Badge>
                              )}
                              <Badge className={`rounded-lg ${tipeConfig.bgColor} ${tipeConfig.textColor} border-0 text-xs sm:text-sm font-semibold px-2 sm:px-3`}>
                                <Clock className="h-3.5 w-3.5 mr-1.5" />
                                {formatTime(jadwal.jam_mulai)} - {formatTime(jadwal.jam_selesai)}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Print Preview Modal */}
      <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Preview Jadwal Pelajaran
            </DialogTitle>
          </DialogHeader>
          
          <div ref={printRef} className="p-4 bg-white rounded-lg border">
            {/* Preview Header */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-foreground">Jadwal Pelajaran</h2>
              <p className="text-sm text-muted-foreground">Kelas: {kelasNama}</p>
              <p className="text-xs text-primary mt-1">
                Semester {semesterLabel} - Tahun Ajaran {activeAcademicYear?.name}
              </p>
            </div>

            {/* Preview Tables - One per day */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {validDaysList.map(hari => {
                const jadwalHari = getJadwalByDay(hari);
                return (
                  <div key={hari} className="space-y-2">
                    <div className="font-semibold text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
                      {hari}
                    </div>
                    {jadwalHari.length === 0 ? (
                      <div className="text-center text-muted-foreground text-xs py-4 border border-dashed border-border/50 rounded-lg">
                        Tidak ada jadwal
                      </div>
                    ) : (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-primary text-primary-foreground">
                            <th className="border border-border/50 px-2 py-1.5 text-left font-semibold w-24">Jam</th>
                            <th className="border border-border/50 px-2 py-1.5 text-left font-semibold">Mata Pelajaran</th>
                            <th className="border border-border/50 px-2 py-1.5 text-left font-semibold w-28">Guru</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jadwalHari.map((jadwal, idx) => (
                            <tr key={jadwal.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                              <td className="border border-border/50 px-2 py-1.5 whitespace-nowrap">
                                {formatTime(jadwal.jam_mulai)} - {formatTime(jadwal.jam_selesai)}
                              </td>
                              <td className="border border-border/50 px-2 py-1.5 font-medium">
                                {jadwal.mapel?.nama || '-'}
                              </td>
                              <td className="border border-border/50 px-2 py-1.5 text-muted-foreground">
                                {jadwal.pengampu?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPrintModal(false)}>
              Batal
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Jadwal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JadwalSantri;