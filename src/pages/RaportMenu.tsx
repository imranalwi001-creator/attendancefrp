import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { ArrowLeft, BookOpen, Heart, Star, BookMarked, Brain, Globe, ChevronRight, FileText, CheckCircle2, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useState } from 'react';

type MenuItemKey = 'akademik' | 'afektif' | 'keislaman' | 'tahsin-tahfidz' | 'hafalan' | 'cambridge' | 'psikologi';

const menuItems: { title: string; description: string; icon: any; href: string; enabled: boolean; key: MenuItemKey }[] = [
  { title: 'Akademik', description: 'Nilai mata pelajaran umum dan agama', icon: BookOpen, href: '/app/raport/akademik', enabled: true, key: 'akademik' },
  { title: 'Afektif & Kepribadian', description: 'Penilaian sikap dan perilaku santri', icon: Heart, href: '/app/raport/afektif', enabled: true, key: 'afektif' },
  { title: 'Keislaman', description: 'Kajian agama dan ibadah harian', icon: Star, href: '/app/raport/keislaman', enabled: true, key: 'keislaman' },
  { title: 'Tahsin & Tahfidz', description: 'Hafalan dan bacaan Al-Quran', icon: BookMarked, href: '/app/raport/tahsin-tahfidz', enabled: true, key: 'tahsin-tahfidz' },
  { title: 'Hafalan Materi', description: 'Doa harian, hadits, dan materi lainnya', icon: Brain, href: '/app/raport/hafalan', enabled: true, key: 'hafalan' },
  { title: 'Cambridge English', description: 'English curriculum assessment', icon: Globe, href: '/app/raport/cambridge', enabled: true, key: 'cambridge' },
  { title: 'Raport Psikologi', description: 'Hasil asesmen psikologi dan perkembangan', icon: Brain, href: '/app/raport/psikologi', enabled: true, key: 'psikologi' },
];

export default function RaportMenu() {
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const navigate = useNavigate();
  const isOrangtua = user?.role === 'orangtua';
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  
  const semester = getCurrentSemester() || 'ganjil';

  // Fetch children for orangtua
  const { data: childrenData = [] } = useQuery({
    queryKey: ['parent-children-raport', user?.id],
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
        .select('id, kelas_id')
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
          kelas_id: santri.kelas_id
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

  // Get santri's kelas_id
  const { data: santriData } = useQuery({
    queryKey: ['santri-kelas', santriId],
    queryFn: async () => {
      if (!santriId) return null;
      const { data } = await supabase
        .from('santri')
        .select('kelas_id')
        .eq('id', santriId)
        .single();
      return data;
    },
    enabled: !!santriId
  });

  const kelasId = isOrangtua ? selectedChild?.kelas_id : santriData?.kelas_id;

  // Check akademik publication status from raport_finalization table
  const { data: akademikAvailable } = useQuery({
    queryKey: ['akademik-available', kelasId, activeAcademicYear?.id, semester],
    queryFn: async () => {
      if (!kelasId || !activeAcademicYear?.id) return false;
      const { data } = await supabase
        .from('raport_finalization')
        .select('is_finalized')
        .eq('kelas_id', kelasId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', semester)
        .eq('is_finalized', true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!kelasId && !!activeAcademicYear?.id
  });

  // Check afektif finalization
  const { data: afektifAvailable } = useQuery({
    queryKey: ['afektif-available', kelasId, activeAcademicYear?.id, semester],
    queryFn: async () => {
      if (!kelasId || !activeAcademicYear?.id) return false;
      const { data } = await supabase
        .from('affective_finalization')
        .select('is_finalized')
        .eq('kelas_id', kelasId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', semester)
        .eq('is_finalized', true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!kelasId && !!activeAcademicYear?.id
  });

  // Check keislaman finalization (using asesmen_sumatif with keislaman mapel)
  const { data: keislamanAvailable } = useQuery({
    queryKey: ['keislaman-available', santriId, activeAcademicYear?.id, semester],
    queryFn: async () => {
      if (!santriId || !activeAcademicYear?.id) return false;
      const { data } = await supabase
        .from('asesmen_sumatif')
        .select('id, mapel:mapel_id(kategori)')
        .eq('santri_id', santriId)
        .eq('semester', semester)
        .eq('is_finalized', true);
      
      // Filter for keislaman category
      const keislamanData = data?.filter((item: any) => item.mapel?.kategori === 'keislaman');
      return keislamanData && keislamanData.length > 0;
    },
    enabled: !!santriId && !!activeAcademicYear?.id
  });

  // Check tahfidz finalization
  const { data: tahfidzAvailable } = useQuery({
    queryKey: ['tahfidz-available', santriId, activeAcademicYear?.id, semester],
    queryFn: async () => {
      if (!santriId || !activeAcademicYear?.id) return false;
      const { data } = await supabase
        .from('tahfidz_finalization')
        .select('is_finalized')
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', semester)
        .eq('is_finalized', true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!santriId && !!activeAcademicYear?.id
  });

  // Check hafalan finalization
  const { data: hafalanAvailable } = useQuery({
    queryKey: ['hafalan-available', activeAcademicYear?.id, semester],
    queryFn: async () => {
      if (!activeAcademicYear?.id) return false;
      const { data } = await supabase
        .from('hafalan_finalization')
        .select('is_finalized')
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', semester)
        .eq('is_finalized', true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!activeAcademicYear?.id
  });

  // Check psikologi finalization
  const { data: psikologiAvailable } = useQuery({
    queryKey: ['psikologi-available', kelasId, activeAcademicYear?.id, semester],
    queryFn: async () => {
      if (!kelasId || !activeAcademicYear?.id) return false;
      const { data } = await supabase
        .from('psikologi_finalization')
        .select('is_finalized')
        .eq('kelas_id', kelasId)
        .eq('academic_year_id', activeAcademicYear.id)
        .eq('semester', semester)
        .eq('is_finalized', true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!kelasId && !!activeAcademicYear?.id
  });

  const availabilityMap: Record<MenuItemKey, boolean> = {
    'akademik': !!akademikAvailable,
    'afektif': !!afektifAvailable,
    'keislaman': !!keislamanAvailable,
    'tahsin-tahfidz': !!tahfidzAvailable,
    'hafalan': !!hafalanAvailable,
    'cambridge': false,
    'psikologi': !!psikologiAvailable,
  };
  
  if (!user) return null;

  return (
    <div className="space-y-6">
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
            <div className="flex items-start gap-4">
              <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
                <FileText className="h-8 w-8 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-primary-foreground mb-2">
                  {isOrangtua ? 'Rapor Anak' : 'Rapor Santri'}
                </h1>
                <p className="text-primary-foreground/80 text-sm">
                  Lihat rekap nilai dari berbagai kategori penilaian
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>


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

      {/* List kategori nilai */}
      <div className="grid gap-4">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isAvailable = availabilityMap[item.key];
          return (
            <Card 
              key={item.title} 
              className={`rounded-2xl border-0 shadow-md overflow-hidden transition-all duration-300 ${
                item.enabled 
                  ? 'hover:shadow-lg cursor-pointer' 
                  : 'opacity-60 cursor-not-allowed'
              }`}
              onClick={() => item.enabled && navigate(item.href)}
            >
              <CardContent className="p-0">
                <div className="flex items-center gap-4 p-5">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg text-foreground">{item.title}</h3>
                      {!item.enabled && (
                        <Badge variant="secondary" className="text-xs">Segera Hadir</Badge>
                      )}
                      {item.enabled && isAvailable && (
                        <Badge className="text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Nilai Tersedia
                        </Badge>
                      )}
                      {item.enabled && !isAvailable && (
                        <Badge variant="secondary" className="text-xs">
                          Belum Tersedia
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm mt-0.5">{item.description}</p>
                  </div>
                  {item.enabled && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
