import { BookOpen, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MapelListSkeleton } from '@/components/skeletons';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import PageHeader from '@/components/layout/PageHeader';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { Badge } from '@/components/ui/badge';
import { useSubstituteMapel } from '@/hooks/useSubstituteMapel';

export default function MapelList() {
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester, isLoading: isLoadingAcademicYear } = useAcademicYear();
  const [mapelList, setMapelList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { substituteMapelList, isSubstituteLoading, isSubstitute } = useSubstituteMapel(user?.id);

  useEffect(() => {
    const fetchMapel = async () => {
      if (!user || !activeAcademicYear) {
        setLoading(false);
        return;
      }
      
      const currentSemester = getCurrentSemester();
      
      setLoading(true);
      try {
        // For santri role, get their kelas_id first
        if (user.role === 'santri') {
          const { data: santriData, error: santriError } = await supabase
            .from('santri')
            .select('kelas_id')
            .eq('id', user.id)
            .single();

          if (santriError) throw santriError;

          if (!santriData?.kelas_id) {
            setMapelList([]);
            setLoading(false);
            return;
          }

          const { data, error } = await supabase
            .from('mapel')
            .select(`
              *,
              kelas:kelas_id (id, nama)
            `)
            .eq('status', 'aktif')
            .eq('kelas_id', santriData.kelas_id)
            .order('nama');

          if (error) throw error;
          setMapelList(data || []);
        } else {
          // For other roles, get all kelas IDs for active academic year
          const { data: kelasData, error: kelasError } = await supabase
            .from('kelas')
            .select('id')
            .eq('tahun_ajaran', activeAcademicYear.name)
            .eq('status', 'aktif');

          if (kelasError) throw kelasError;

          const kelasIds = kelasData?.map(k => k.id) || [];

          if (kelasIds.length === 0) {
            setMapelList([]);
            setLoading(false);
            return;
          }

          let query = supabase
            .from('mapel')
            .select(`
              *,
              kelas:kelas_id (id, nama)
            `)
            .eq('status', 'aktif')
            .in('kelas_id', kelasIds)
            .order('nama');

          // Filter by pengampu_id for guru/walikelas/guru_ekskul/Pembina roles
          if (user.role === 'guru' || user.role === 'walikelas' || user.role === 'guru_ekskul' || user.role === 'Pembina') {
            query = query.eq('pengampu_id', user.id);
          }

          const { data, error } = await query;

          if (error) throw error;
          setMapelList(data || []);
        }
      } catch (error) {
        console.error('Error fetching mapel:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMapel();
  }, [user, activeAcademicYear, getCurrentSemester]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader 
        title="Mata Pelajaran"
        subtitle={<BadgeTahunAjaran />}
      />

      {loading || isLoadingAcademicYear || isSubstituteLoading ? (
        <MapelListSkeleton />
      ) : !activeAcademicYear ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Tahun ajaran aktif belum dikonfigurasi</p>
        </div>
      ) : mapelList.length === 0 && substituteMapelList.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Belum ada mata pelajaran</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Substitute mapel cards */}
          {substituteMapelList
            .filter(sm => !mapelList.some(m => m.id === sm.mapel_id))
            .map((sm) => {
              return (
                <Link key={`sub-${sm.mapel_id}`} to={`/app/mapel/${sm.mapel_id}`}>
                  <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500/5 to-amber-500/10 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer h-full hover:-translate-y-1 border border-amber-500/20">
                    <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl" />
                    <div className="relative p-4 sm:p-6">
                      <div className="flex items-start gap-3 sm:gap-5">
                        <div className="bg-amber-500 text-white w-11 h-11 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 shrink-0">
                          <UserCheck className="h-5 w-5 sm:h-8 sm:w-8" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-xl font-bold text-foreground group-hover:text-amber-600 transition-colors line-clamp-1">
                              {sm.mapel_nama}
                            </h3>
                            <Badge variant="warning" className="text-[10px] shrink-0">
                              <UserCheck className="h-3 w-3 mr-1" />
                              Guru Pengganti
                            </Badge>
                          </div>
                          <p className="text-[10px] sm:text-xs font-medium text-amber-600/80 mt-0.5 sm:mt-1">
                            {sm.kelas_nama}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 sm:mt-5">
                        <button className="w-full flex items-center justify-between px-0 py-2 sm:py-3 text-amber-600 hover:text-amber-700 font-medium text-xs sm:text-sm transition-all duration-300 group/btn">
                          <span>Lihat Detail</span>
                          <div className="flex items-center gap-1">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/10 group-hover/btn:bg-amber-500/20 flex items-center justify-center transition-colors">
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          {/* Regular mapel cards */}
          {mapelList.map((mapel) => {
            const style = {
              gradient: 'from-primary/5 to-primary/10',
              icon: 'bg-primary text-primary-foreground',
            };
            
            return (
              <Link key={mapel.id} to={`/app/mapel/${mapel.id}`}>
                <div id="card_mapel" className={`group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${style.gradient} shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer h-full hover:-translate-y-1`}>
                  {/* Decorative corner element */}
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-2xl" />
                  
                  <div className="relative p-4 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-5">
                      {/* Icon container with modern design */}
                      <div className={`${style.icon} w-11 h-11 sm:w-16 sm:h-16 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300 shrink-0`}>
                        <BookOpen className="h-5 w-5 sm:h-8 sm:w-8" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-0.5 sm:pt-1">
                        <h3 className="text-base sm:text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {mapel.nama}
                        </h3>
                        
                        {mapel.kelas?.nama && (
                          <p className="text-[10px] sm:text-xs font-medium text-primary/80 mt-0.5 sm:mt-1">
                            {mapel.kelas.nama}
                          </p>
                        )}
                        
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 leading-relaxed mt-1 sm:mt-2">
                          {mapel.deskripsi || 'Mari belajar bersama! ✨'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Bottom action button */}
                    <div className="mt-3 sm:mt-5">
                      <button className="w-full flex items-center justify-between px-0 py-2 sm:py-3 text-primary hover:text-primary/80 font-medium text-xs sm:text-sm transition-all duration-300 group/btn">
                        <span>Lihat Detail</span>
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 group-hover/btn:bg-primary/20 flex items-center justify-center transition-colors">
                            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}