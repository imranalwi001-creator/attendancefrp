import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users } from "lucide-react";
import { BadgeTahunAjaran } from "@/components/kalender/BadgeTahunAjaran";
import { TahfidzTabContent } from "@/components/tahfidz";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";

export default function TahfidzMenu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester() || 'ganjil';
  const isOrangtua = user?.role === 'orangtua';
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Fetch children for orangtua
  const { data: childrenData = [] } = useQuery({
    queryKey: ['parent-children-tahfidz', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: parentChildren } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      
      if (!parentChildren || parentChildren.length === 0) return [];

      const childIds = parentChildren.map(pc => pc.child_id);

      const { data: santriData } = await supabase
        .from('santri')
        .select('id, nis, kelas:kelas_id(id, nama)')
        .in('id', childIds);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', childIds);

      return (santriData || []).map(santri => {
        const profile = profilesData?.find(p => p.id === santri.id);
        return {
          id: santri.id,
          name: profile?.name || 'Anak',
          avatar_url: profile?.avatar_url,
          nis: santri.nis,
          kelas: santri.kelas
        };
      });
    },
    enabled: !!user?.id && isOrangtua
  });

  // Set default selected child
  const effectiveChildId = selectedChildId || (childrenData.length > 0 ? childrenData[0].id : null);
  const selectedChild = childrenData.find(c => c.id === effectiveChildId);

  // Determine which santri ID to use
  const santriId = isOrangtua ? effectiveChildId : user?.id;

  // Fetch santri data
  const { data: santriData } = useQuery({
    queryKey: ['santri-profile', santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase
        .from('santri')
        .select(`
          id,
          nis,
          kelas:kelas_id (
            id,
            nama
          )
        `)
        .eq('id', santriId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!santriId,
  });

  // Fetch profile name for santri
  const { data: santriProfile } = useQuery({
    queryKey: ['santri-profile-name', santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', santriId)
        .single();
      return data;
    },
    enabled: !!santriId && !isOrangtua,
  });

  // Fetch tahfidz/tahsin records
  const { data: tahfidzRecords = [], isLoading: tahfidzLoading, refetch } = useQuery({
    queryKey: ['tahfidz-records', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId || !activeAcademicYear?.id) return [];
      
      const { data, error } = await supabase
        .from('tahfidz_tahsin')
        .select('*')
        .eq('santri_id', santriId)
        .eq('tahun_ajaran_id', activeAcademicYear.id)
        .eq('semester', currentSemester)
        .order('tanggal', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(record => ({
        id: record.id,
        tipe: record.tipe as "tahfidz" | "tahsin",
        mode: record.mode,
        surah: record.surah,
        juz: record.juz,
        ayat_awal: record.ayat_awal,
        ayat_akhir: record.ayat_akhir,
        materi_tahsin: record.materi_tahsin,
        nilai: record.nilai,
        status: record.status,
        tanggal: record.tanggal,
      }));
    },
    enabled: !!santriId && !!activeAcademicYear?.id,
  });

  // Check finalization status
  const { data: finalizationData } = useQuery({
    queryKey: ['tahfidz-finalization', activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!activeAcademicYear?.id) return null;
      
      const { data, error } = await supabase
        .from('tahfidz_finalization')
        .select('is_finalized')
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', currentSemester)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!activeAcademicYear?.id,
  });

  const isTahfidzFinalized = finalizationData?.is_finalized ?? false;
  const santriName = isOrangtua ? selectedChild?.name : (santriProfile?.name || user?.name);

  return (
    <div className="space-y-6 p-4 md:p-6 pb-24">
      {/* Header dengan gradient */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/10 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary-foreground/5 rounded-full blur-2xl translate-y-24 -translate-x-24 pointer-events-none" />
        
        <div className="relative flex items-start gap-4 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/app/dashboard')} 
            className="rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground border-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2">
              {isOrangtua ? 'Tahfidz & Tahsin Anak' : 'Tahfidz & Tahsin'}
            </h1>
            <BadgeTahunAjaran className="bg-primary-foreground/20 text-primary-foreground" />
          </div>
        </div>
      </div>

      {/* Child Selector for Orangtua */}
      {isOrangtua && childrenData.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pilih Anak</span>
            </div>
            <Tabs value={effectiveChildId || ''} onValueChange={setSelectedChildId}>
              <TabsList className="w-full h-auto flex-wrap gap-2 bg-transparent p-0">
                {childrenData.map(child => (
                  <TabsTrigger 
                    key={child.id} 
                    value={child.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border data-[state=active]:border-primary data-[state=active]:bg-primary/10"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={child.avatar_url || ''} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {child.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{child.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {isOrangtua && childrenData.length === 0 && (
        <Card className="rounded-2xl border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Belum ada data anak yang terhubung.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {santriId && (
        <TahfidzTabContent
          santriId={santriId}
          santriName={santriName}
          santriNis={santriData?.nis}
          santriKelas={santriData?.kelas?.nama}
          tahfidzRecords={tahfidzRecords}
          tahfidzLoading={tahfidzLoading}
          isTahfidzFinalized={isTahfidzFinalized}
          onRefetch={() => refetch()}
          readOnly
        />
      )}
    </div>
  );
}
