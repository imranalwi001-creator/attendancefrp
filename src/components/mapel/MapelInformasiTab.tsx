import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Target, BookOpen, CheckCircle2, X, Edit, Plus, Lock, Trash2, Users, Sparkles
} from 'lucide-react';
import MapelInfoForm from '@/components/admin/MapelInfoForm';
import CapaianPembelajaranForm from '@/components/admin/TujuanPembelajaranForm';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AICpTpStudioDrawer } from '@/components/mapel/AICpTpStudioDrawer';

interface TpStatusItem {
  tp_index: number;
  status: string;
  achieved_at: string | null;
}

interface MapelInformasiTabProps {
  mapel: any;
  mapelInfo: any;
  user: any;
  activeAcademicYear: any;
  selectedSemester: 'ganjil' | 'genap';
  isDateOutsideSemesters: () => boolean;
  hasActiveSession: boolean;
  tpStatusList: TpStatusItem[];
  kelasList: any[];
  guruList: any[];
  onRefresh: () => void;
  santriCount?: number;
}

export default function MapelInformasiTab({
  mapel,
  mapelInfo,
  user,
  activeAcademicYear,
  selectedSemester,
  isDateOutsideSemesters,
  hasActiveSession,
  tpStatusList,
  kelasList,
  guruList,
  onRefresh,
  santriCount = 0
}: MapelInformasiTabProps) {
  const { toast } = useToast();
  const [showInfoForm, setShowInfoForm] = useState(false);
  const [showTujuanForm, setShowTujuanForm] = useState(false);
  const [showAiCpTp, setShowAiCpTp] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  const canEdit = user?.role === 'admin' || (user?.role === 'guru' && mapel.pengampu_id === user?.id);
  const isAdmin = user?.role === 'admin';

  // Helper to get pengampu name
  const getPengampuName = () => {
    const profile = Array.isArray(mapel.pengampu?.profiles) 
      ? mapel.pengampu?.profiles?.[0] 
      : mapel.pengampu?.profiles;
    return profile?.name || 'Belum ditentukan';
  };

  // Get kategori badge
  const getKategoriBadge = () => {
    const kategoriMap: Record<string, { label: string; className: string }> = {
      wajib: { label: 'WAJIB', className: 'bg-primary/10 text-primary border-primary/20' },
      pilihan: { label: 'PILIHAN', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      ekstrakurikuler: { label: 'EKSTRAKURIKULER', className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
      asrama: { label: 'ASRAMA', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
    };
    return kategoriMap[mapel.kategori || 'wajib'] || kategoriMap.wajib;
  };

  const handleEditField = (field: string) => {
    setEditingField(field);
    setEditFormData({ [field]: mapel[field] || '' });
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditFormData({});
  };

  const handleSaveField = async (field: string) => {
    try {
      const updateData: any = { [field]: editFormData[field] };
      
      if (field === 'kkm') {
        updateData.kkm = parseInt(editFormData.kkm) || null;
      }

      const { error } = await supabase
        .from('mapel')
        .update(updateData)
        .eq('id', mapel.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: `${field} berhasil diperbarui`
      });
      
      setEditingField(null);
      setEditFormData({});
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan perubahan",
        variant: "destructive"
      });
    }
  };

  const handleSaveMapelInfo = async () => {
    onRefresh();
  };

  const kategoriBadge = getKategoriBadge();

  return (
    <div className="space-y-6 mt-6">
      {/* Hero Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-card shadow-xl p-6 border">
        {/* Top section: Title and Pengampu */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
          <div className="flex-1">
            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              {mapel.nama}
            </h1>
            
            {/* Category Badge */}
            <Badge 
              variant="outline" 
              className={`text-xs font-semibold uppercase tracking-wider ${kategoriBadge.className}`}
            >
              {kategoriBadge.label}
            </Badge>
          </div>
          
          {/* Guru Pengampu */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Guru Pengampu</p>
            <p className="text-lg font-semibold text-foreground">{getPengampuName()}</p>
          </div>
        </div>
        
        {/* Description */}
        {mapel.deskripsi && (
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-3xl">
            {mapel.deskripsi}
          </p>
        )}
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Kode Mapel</p>
            <p className="text-base font-bold text-foreground">{mapel.kode_mapel || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Kelas</p>
            <p className="text-base font-bold text-foreground">
              {mapel.kelas ? `${mapel.kelas.nama}` : '-'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tingkat</p>
            <p className="text-base font-bold text-foreground">{mapel.kelas?.tingkat || '-'}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Semester</p>
            <p className="text-base font-bold text-foreground">
              {selectedSemester === 'ganjil' ? 'Ganjil' : 'Genap'} {activeAcademicYear?.name?.split('/')[0] || ''}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Siswa</p>
            <p className="text-base font-bold text-foreground">{santriCount} Siswa</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">KKM</p>
            <p className="text-base font-bold text-foreground">{mapel.kkm || '-'}</p>
          </div>
        </div>
      </div>

      {/* Active Session Warning */}
      {hasActiveSession && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
          <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Modifikasi Capaian dan Tujuan Pembelajaran tidak dapat dilakukan saat sesi pembelajaran sedang berlangsung
          </p>
        </div>
      )}

      {/* Two Column Cards: Capaian & Tujuan */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capaian Pembelajaran Card */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Capaian Pembelajaran</h3>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowAiCpTp(true)}
                    size="sm"
                    variant="outline"
                    disabled={hasActiveSession}
                    className="border-primary/20 hover:bg-primary/5 text-primary font-medium text-sm gap-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    Buat dengan AI
                  </Button>
                  <Button 
                    onClick={() => setShowInfoForm(!showInfoForm)} 
                    size="sm" 
                    variant="outline"
                    disabled={hasActiveSession}
                    className="text-primary border-primary/30 hover:bg-primary/5 hover:border-primary font-medium text-sm gap-1.5"
                  >
                    {showInfoForm ? (
                      <>
                        <X className="h-4 w-4" />
                        Batal
                      </>
                    ) : hasActiveSession ? (
                      <>
                        <Lock className="h-4 w-4" />
                        Terkunci
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Tambah
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-5">
            {showInfoForm ? (
              <MapelInfoForm 
                mapelId={mapel.id} 
                mapelInfo={mapelInfo} 
                onSave={() => {
                  handleSaveMapelInfo();
                  setShowInfoForm(false);
                }} 
                onCancel={() => setShowInfoForm(false)} 
              />
            ) : (
              <div className="space-y-3">
                {mapelInfo?.capaian_pembelajaran && 
                 Array.isArray(mapelInfo.capaian_pembelajaran) && 
                 mapelInfo.capaian_pembelajaran.length > 0 ? (
                  mapelInfo.capaian_pembelajaran.map((item: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-start gap-3"
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <p className="flex-1 text-sm text-foreground leading-relaxed pt-0.5">
                        {typeof item === 'string' ? item : item.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Target className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Belum ada capaian pembelajaran</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tujuan Pembelajaran Card */}
        <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground">Tujuan Pembelajaran</h3>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowAiCpTp(true)}
                    size="sm"
                    variant="outline"
                    disabled={hasActiveSession}
                    className="border-primary/20 hover:bg-primary/5 text-primary font-medium text-sm gap-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    Buat dengan AI
                  </Button>
                  <Button 
                    onClick={() => setShowTujuanForm(!showTujuanForm)} 
                    size="sm" 
                    variant="outline"
                    disabled={hasActiveSession}
                    className="text-primary border-primary/30 hover:bg-primary/5 hover:border-primary font-medium text-sm gap-1.5"
                  >
                    {showTujuanForm ? (
                      <>
                        <X className="h-4 w-4" />
                        Batal
                      </>
                    ) : hasActiveSession ? (
                      <>
                        <Lock className="h-4 w-4" />
                        Terkunci
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Tambah
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-5">
            {showTujuanForm ? (
              <CapaianPembelajaranForm 
                mapelId={mapel.id} 
                mapelInfo={mapelInfo} 
                tpStatusList={tpStatusList}
                onSave={() => {
                  handleSaveMapelInfo();
                  setShowTujuanForm(false);
                }} 
                onCancel={() => setShowTujuanForm(false)} 
              />
            ) : (
              <div className="space-y-2">
                {mapelInfo?.tujuan_pembelajaran && 
                 Array.isArray(mapelInfo.tujuan_pembelajaran) && 
                 mapelInfo.tujuan_pembelajaran.length > 0 ? (
                  mapelInfo.tujuan_pembelajaran.map((item: any, index: number) => {
                    const tpStatus = tpStatusList.find(tp => tp.tp_index === index);
                    const isAchieved = tpStatus?.status === 'tercapai';
                    
                    return (
                      <div 
                        key={index} 
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                          isAchieved 
                            ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800/40' 
                            : 'bg-muted/30 border-border/50'
                        }`}
                      >
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          isAchieved 
                            ? 'bg-green-500 text-white' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed">
                            {typeof item === 'string' ? item : item.text || '-'}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`flex-shrink-0 text-[10px] px-2 py-0.5 ${
                            isAchieved 
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700' 
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {isAchieved ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Tercapai
                            </span>
                          ) : (
                            'Belum Tercapai'
                          )}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Belum ada tujuan pembelajaran</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AICpTpStudioDrawer
        open={showAiCpTp}
        onOpenChange={setShowAiCpTp}
        mapel={mapel}
        mapelInfo={mapelInfo}
        selectedSemester={selectedSemester}
        tpStatusList={tpStatusList}
        hasActiveSession={hasActiveSession}
        onSaved={handleSaveMapelInfo}
      />
    </div>
  );
}
