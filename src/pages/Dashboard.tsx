// User dashboard component - v3 force refresh
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KalenderPendidikanCard, KehadiranGuruCard, KehadiranStaffCard, JadwalSantriCard, JadwalAnakCard, TugasSantriCard, TugasAnakCard } from '@/components/dashboard';
import { KalenderPendidikanSantriCard } from '@/components/dashboard/KalenderPendidikanSantriCard';
import { useAuth } from '@/contexts/AuthContext';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useInstitution } from '@/contexts/InstitutionContext';
import { GuruMandiriCharts } from '@/components/dashboard/GuruMandiriCharts';
import { BookOpen, ClipboardList, Calendar, BookMarked, FileText, CalendarDays, MessageSquare, GraduationCap, CalendarCheck, UserCog, GraduationCap as StudentIcon, Briefcase, Clock, CheckCircle, XCircle, ChevronRight, FileQuestion, FolderOpen, UserCheck, Moon, Receipt, Palmtree } from 'lucide-react';
import { useSubstituteMapel } from '@/hooks/useSubstituteMapel';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useRamadhanConfig } from '@/hooks/useMonitoringRamadhan';
import { useLiburanConfigMonitoring } from '@/hooks/useMonitoringLiburan';
import { Badge } from '@/components/ui/badge';
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInMinutes, parse } from 'date-fns';
import infoBanner from '@/assets/info-banner.jpg';
import infoBanner2 from '@/assets/info-banner-2.jpg';
import infoBanner3 from '@/assets/info-banner-3.jpg';
import { getBannerUrl } from '@/lib/storageUtils';
import { RamadhanChildSummary } from '@/components/ramadhan/RamadhanChildSummary';

interface Mapel {
  id: string;
  nama: string;
  kode_mapel: string;
  deskripsi: string;
  kelas_id: string;
  pengampu_id: string;
  status: string;
  kelas?: {
    nama: string;
    tingkat: string;
  } | null;
}

interface Banner {
  id: string;
  judul: string;
  deskripsi: string | null;
  gambar_url: string | null;
  target_audience: string[];
  tanggal_mulai: string;
  tanggal_berakhir: string;
  status: string;
  tautan_aksi: string | null;
}

interface GuruStats {
  totalJamMengajarHariIni: number;
  totalMapelDiampu: number;
  jumlahHadir: number;
  jumlahTidakHadir: number;
}

interface AdminStats {
  jumlahStaff: number;
  jumlahSantri: number;
  jumlahGuru: number;
  jumlahMapel: number;
}

interface SantriStats {
  jumlahMapel: number;
  tugasMenunggu: number;
  persentaseKehadiran: string;
  materiDibaca: number;
}

interface OrangtuaStats {
  jumlahAnak: number;
  persentaseKehadiran: string;
  tugasAnak: number;
  raporTersedia: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const { workspaceType } = useInstitution();
  const { data: ramadhanConfig } = useRamadhanConfig();
  const { data: liburanConfig } = useLiburanConfigMonitoring();
  const [mapelList, setMapelList] = useState<Mapel[]>([]);
  const [loading, setLoading] = useState(true);
  const [kelasId, setKelasId] = useState<string | null | undefined>(undefined);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [guruStats, setGuruStats] = useState<GuruStats>({
    totalJamMengajarHariIni: 0,
    totalMapelDiampu: 0,
    jumlahHadir: 0,
    jumlahTidakHadir: 0
  });
  const [loadingGuruStats, setLoadingGuruStats] = useState(false);
  
  // Admin stats
  const [adminStats, setAdminStats] = useState<AdminStats>({
    jumlahStaff: 0,
    jumlahSantri: 0,
    jumlahGuru: 0,
    jumlahMapel: 0
  });
  const [loadingAdminStats, setLoadingAdminStats] = useState(false);
  
  // Santri stats
  const [santriStats, setSantriStats] = useState<SantriStats>({
    jumlahMapel: 0,
    tugasMenunggu: 0,
    persentaseKehadiran: '0%',
    materiDibaca: 0
  });
  const [loadingSantriStats, setLoadingSantriStats] = useState(false);
  
  // Orangtua stats
  const [orangtuaStats, setOrangtuaStats] = useState<OrangtuaStats>({
    jumlahAnak: 0,
    persentaseKehadiran: '0%',
    tugasAnak: 0,
    raporTersedia: 0
  });
  const [loadingOrangtuaStats, setLoadingOrangtuaStats] = useState(false);

  const defaultBannerImages = [infoBanner, infoBanner2, infoBanner3];

  // Query unpaid tagihan count for santri/orangtua
  const { data: unpaidTagihanCount } = useQuery({
    queryKey: ['unpaid-tagihan-count', user?.id, user?.role],
    queryFn: async () => {
      if (!user?.id) return 0;
      
      if (user.role === 'santri') {
        const { count } = await supabase
          .from('tagihan_santri')
          .select('id', { count: 'exact', head: true })
          .eq('santri_id', user.id)
          .eq('status', 'belum_bayar');
        return count || 0;
      }
      
      if (user.role === 'orangtua') {
        // Get children IDs first
        const { data: children } = await supabase
          .from('parent_children')
          .select('child_id')
          .eq('parent_id', user.id);
        
        if (!children?.length) return 0;
        const childIds = children.map(c => c.child_id);
        
        const { count } = await supabase
          .from('tagihan_santri')
          .select('id', { count: 'exact', head: true })
          .in('santri_id', childIds)
          .eq('status', 'belum_bayar');
        return count || 0;
      }
      
      return 0;
    },
    enabled: !!user?.id && (user?.role === 'santri' || user?.role === 'orangtua'),
    staleTime: 1000 * 60 * 5,
  });

  // Fetch published banners based on user role
  useEffect(() => {
    const fetchBanners = async () => {
      if (!user?.role) return;

      const now = new Date().toISOString();
      
      // Map user role to target audience
      const audienceMap: Record<string, string> = {
        'santri': 'santri',
        'guru': 'guru',
        'walikelas': 'guru',
        'guru_ekskul': 'guru',
        'orangtua': 'orangtua',
        'admin': 'admin',
        'staff': 'staff'
      };
      
      const userAudience = audienceMap[user.role];

      // Use explicit columns instead of select('*') to reduce egress
      const { data, error } = await supabase
        .from('banners')
        .select('id, judul, deskripsi, gambar_url, target_audience, tanggal_mulai, tanggal_berakhir, status, tautan_aksi')
        .eq('status', 'published')
        .lte('tanggal_mulai', now)
        .gte('tanggal_berakhir', now)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching banners:', error);
        return;
      }

      // Filter by target audience (check if user's audience is in the array)
      const filteredBanners = (data || []).filter(banner => 
        banner.target_audience.includes(userAudience) || banner.target_audience.length === 0
      ) as Banner[];

      setBanners(filteredBanners);
    };

    fetchBanners();
  }, [user?.role]);

  // Fetch user's kelas_id if they are santri or walikelas
  useEffect(() => {
    const fetchKelasId = async () => {
      if (!user?.id) return;

      if (user.role === 'santri') {
        const { data: santri } = await supabase
          .from('santri')
          .select('kelas_id')
          .eq('id', user.id)
          .maybeSingle();
        
        setKelasId(santri?.kelas_id || null);
      } else if (user.role === 'walikelas') {
        const { data: staff } = await supabase
          .from('staff')
          .select('kelas_id')
          .eq('id', user.id)
          .maybeSingle();
        
        setKelasId(staff?.kelas_id || null);
      }
    };

    fetchKelasId();
  }, [user]);

  // Auto-slide carousel effect
  useEffect(() => {
    if (!carouselApi) return;

    const interval = setInterval(() => {
      carouselApi.scrollNext();
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [carouselApi]);

  // Track current slide
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on('select', onSelect);
    onSelect();

    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  // Fetch mapel based on user role, kelas, and active academic year
  useEffect(() => {
    const fetchMapel = async () => {
      if (!user || !activeAcademicYear) return;

      try {
        setLoading(true);
        
        // First get kelas IDs for active academic year
        const { data: kelasData, error: kelasError } = await supabase
          .from('kelas')
          .select('id')
          .eq('tahun_ajaran', activeAcademicYear.name)
          .eq('status', 'aktif');

        if (kelasError) {
          console.error('Error fetching kelas:', kelasError);
          return;
        }

        const activeKelasIds = kelasData?.map(k => k.id) || [];

        if (activeKelasIds.length === 0) {
          setMapelList([]);
          setLoading(false);
          return;
        }

        let query = supabase
          .from('mapel')
          .select('*, kelas:kelas_id(nama, tingkat)')
          .eq('status', 'aktif')
          .in('kelas_id', activeKelasIds);

        // Filter based on role
        if (user.role === 'santri' && kelasId) {
          // Santri sees mapel from their class
          query = query.eq('kelas_id', kelasId);
        } else if (user.role === 'guru' || user.role === 'guru_ekskul' || user.role === 'Pembina') {
          // Guru, Guru Ekskul, and Pembina sees mapel they teach
          query = query.eq('pengampu_id', user.id);
        } else if (user.role === 'walikelas' && kelasId) {
          // Walikelas sees all mapel in their class
          query = query.eq('kelas_id', kelasId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error fetching mapel:', error);
          return;
        }

        setMapelList(data || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user.role === 'santri' || user.role === 'walikelas') {
      // Wait for kelasId to be fetched first (undefined means not fetched yet, null means no kelas)
      if (kelasId !== undefined) {
        fetchMapel();
      }
    } else {
      // For guru, guru_ekskul and admin, fetch immediately
      fetchMapel();
    }
  }, [user, kelasId, activeAcademicYear]);

  // Fetch guru/walikelas/staff stats based on active academic year and semester
  useEffect(() => {
    const fetchGuruStats = async () => {
      if (!user || (user.role !== 'guru' && user.role !== 'walikelas' && user.role !== 'staff' && user.role !== 'guru_ekskul' && user.role !== 'Pembina')) return;
      if (!activeAcademicYear) return;

      const currentSemester = getCurrentSemester();
      if (!currentSemester) return;

      setLoadingGuruStats(true);
      try {
        const today = format(new Date(), 'yyyy-MM-dd');
        const dayOfWeek = format(new Date(), 'EEEE').toLowerCase();
        const dayMapping: Record<string, string> = {
          'monday': 'Senin',
          'tuesday': 'Selasa',
          'wednesday': 'Rabu',
          'thursday': 'Kamis',
          'friday': 'Jumat',
          'saturday': 'Sabtu',
          'sunday': 'Minggu'
        };
        const hariIni = dayMapping[dayOfWeek] || dayOfWeek;

        // Get staff ID first
        const { data: staffData } = await supabase
          .from('staff')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();

        const staffId = staffData?.id || user.id;

        // Fetch sesi pembelajaran yang sudah selesai hari ini
        const { data: sesiSelesai } = await supabase
          .from('sesi_pembelajaran')
          .select('waktu_mulai, waktu_selesai')
          .eq('pengampu_id', staffId)
          .eq('tanggal', today)
          .eq('status', 'selesai');

        // Calculate total teaching hours from completed sessions
        let totalMinutes = 0;
        if (sesiSelesai) {
          sesiSelesai.forEach(sesi => {
            try {
              if (sesi.waktu_mulai && sesi.waktu_selesai) {
                const startTime = parse(sesi.waktu_mulai, 'HH:mm:ss', new Date());
                const endTime = parse(sesi.waktu_selesai, 'HH:mm:ss', new Date());
                const minutes = differenceInMinutes(endTime, startTime);
                if (minutes > 0) totalMinutes += minutes;
              }
            } catch (e) {
              console.error('Error parsing time:', e);
            }
          });
        }
        const totalJam = Math.round(totalMinutes / 60 * 10) / 10; // Round to 1 decimal

        // Fetch total mapel diampu (in current semester based on kelas with active academic year)
        const { data: mapelDiampu } = await supabase
          .from('mapel')
          .select('id, kelas!inner(tahun_ajaran)')
          .eq('pengampu_id', staffId)
          .eq('status', 'aktif')
          .eq('kelas.tahun_ajaran', activeAcademicYear.name);

        // Get semester date range for kehadiran_staff query
        let semesterStart: string, semesterEnd: string;
        if (currentSemester === 'ganjil') {
          semesterStart = activeAcademicYear.odd_semester_start;
          semesterEnd = activeAcademicYear.odd_semester_end;
        } else {
          semesterStart = activeAcademicYear.even_semester_start;
          semesterEnd = activeAcademicYear.even_semester_end;
        }

        // Fetch kehadiran staff for current semester
        const { data: kehadiranData } = await supabase
          .from('kehadiran_staff')
          .select('status')
          .eq('staff_id', staffId)
          .gte('tanggal', semesterStart)
          .lte('tanggal', semesterEnd);

        const jumlahHadir = kehadiranData?.filter(k => k.status === 'hadir').length || 0;
        const jumlahTidakHadir = kehadiranData?.filter(k => 
          k.status === 'tidak_hadir' || k.status === 'alfa' || k.status === 'izin' || k.status === 'sakit'
        ).length || 0;

        setGuruStats({
          totalJamMengajarHariIni: totalJam,
          totalMapelDiampu: mapelDiampu?.length || 0,
          jumlahHadir,
          jumlahTidakHadir
        });
      } catch (error) {
        console.error('Error fetching guru stats:', error);
      } finally {
        setLoadingGuruStats(false);
      }
    };

    fetchGuruStats();
  }, [user, activeAcademicYear, getCurrentSemester]);

  // Fetch admin stats
  useEffect(() => {
    const fetchAdminStats = async () => {
      if (!user || user.role !== 'admin' || !activeAcademicYear) return;
      
      setLoadingAdminStats(true);
      try {
        // Count staff (admin, guru, walikelas, Pembina)
        const { count: staffCount } = await supabase
          .from('staff')
          .select('*', { count: 'exact', head: true });

        // Count santri
        const { count: santriCount } = await supabase
          .from('santri')
          .select('*', { count: 'exact', head: true });

        // Count guru (guru + walikelas roles)
        const { data: guruRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['guru', 'walikelas']);
        
        // Count mapel in active academic year
        const { data: kelasData } = await supabase
          .from('kelas')
          .select('id')
          .eq('tahun_ajaran', activeAcademicYear.name)
          .eq('status', 'aktif');
        
        const activeKelasIds = kelasData?.map(k => k.id) || [];
        
        let mapelCount = 0;
        if (activeKelasIds.length > 0) {
          const { count } = await supabase
            .from('mapel')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'aktif')
            .in('kelas_id', activeKelasIds);
          mapelCount = count || 0;
        }

        setAdminStats({
          jumlahStaff: staffCount || 0,
          jumlahSantri: santriCount || 0,
          jumlahGuru: guruRoles?.length || 0,
          jumlahMapel: mapelCount
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoadingAdminStats(false);
      }
    };

    fetchAdminStats();
  }, [user, activeAcademicYear]);

  // Fetch santri stats
  useEffect(() => {
    const fetchSantriStats = async () => {
      if (!user || user.role !== 'santri' || !activeAcademicYear) return;
      if (kelasId === undefined) return; // Wait for kelasId to be fetched
      
      setLoadingSantriStats(true);
      try {
        const currentSemester = getCurrentSemester();
        
        // Get tugas menunggu (tugas yang belum dikumpulkan)
        let tugasMenunggu = 0;
        if (kelasId) {
          // Get mapel IDs for santri's kelas
          const { data: mapelData } = await supabase
            .from('mapel')
            .select('id')
            .eq('kelas_id', kelasId)
            .eq('status', 'aktif');
          
          const mapelIds = mapelData?.map(m => m.id) || [];
          
          if (mapelIds.length > 0) {
            // Get active tugas for these mapel
            const { data: tugasData } = await supabase
              .from('tugas')
              .select('id')
              .in('mapel_id', mapelIds)
              .eq('status', 'aktif')
              .gte('tanggal_deadline', new Date().toISOString());
            
            const tugasIds = tugasData?.map(t => t.id) || [];
            
            if (tugasIds.length > 0) {
              // Check which ones santri has submitted
              const { data: submittedData } = await supabase
                .from('pengumpulan_tugas')
                .select('tugas_id')
                .eq('santri_id', user.id)
                .in('tugas_id', tugasIds);
              
              const submittedIds = submittedData?.map(s => s.tugas_id) || [];
              tugasMenunggu = tugasIds.filter(id => !submittedIds.includes(id)).length;
            }
          }
        }

        // Get kehadiran percentage
        let persentaseKehadiran = '0%';
        if (currentSemester) {
          const semesterStart = currentSemester === 'ganjil' 
            ? activeAcademicYear.odd_semester_start 
            : activeAcademicYear.even_semester_start;
          const semesterEnd = currentSemester === 'ganjil' 
            ? activeAcademicYear.odd_semester_end 
            : activeAcademicYear.even_semester_end;

          const { data: kehadiranData } = await supabase
            .from('kehadiran_santri')
            .select('status, sesi_pembelajaran!inner(tanggal)')
            .eq('santri_id', user.id);
          
          // Filter by semester dates
          const filteredKehadiran = (kehadiranData || []).filter(k => {
            const tanggal = (k.sesi_pembelajaran as any)?.tanggal;
            return tanggal >= semesterStart && tanggal <= semesterEnd;
          });
          
          const totalSesi = filteredKehadiran.length;
          const hadir = filteredKehadiran.filter(k => k.status === 'hadir').length;
          persentaseKehadiran = totalSesi > 0 ? `${Math.round((hadir / totalSesi) * 100)}%` : '0%';
        }

        // Get materi dibaca
        const { count: materiDibaca } = await supabase
          .from('materi_reads')
          .select('*', { count: 'exact', head: true })
          .eq('santri_id', user.id);

        setSantriStats({
          jumlahMapel: mapelList.length,
          tugasMenunggu,
          persentaseKehadiran,
          materiDibaca: materiDibaca || 0
        });
      } catch (error) {
        console.error('Error fetching santri stats:', error);
      } finally {
        setLoadingSantriStats(false);
      }
    };

    fetchSantriStats();
  }, [user, activeAcademicYear, kelasId, mapelList, getCurrentSemester]);

  // Fetch orangtua stats
  useEffect(() => {
    const fetchOrangtuaStats = async () => {
      if (!user || user.role !== 'orangtua' || !activeAcademicYear) return;
      
      setLoadingOrangtuaStats(true);
      try {
        const currentSemester = getCurrentSemester();
        
        // Get children
        const { data: childrenData } = await supabase
          .from('parent_children')
          .select('child_id, santri:child_id(kelas_id)')
          .eq('parent_id', user.id);
        
        const childIds = childrenData?.map(c => c.child_id) || [];
        const jumlahAnak = childIds.length;

        let persentaseKehadiran = '0%';
        let tugasAnak = 0;
        let raporTersedia = 0;

        if (childIds.length > 0 && currentSemester) {
          const semesterStart = currentSemester === 'ganjil' 
            ? activeAcademicYear.odd_semester_start 
            : activeAcademicYear.even_semester_start;
          const semesterEnd = currentSemester === 'ganjil' 
            ? activeAcademicYear.odd_semester_end 
            : activeAcademicYear.even_semester_end;

          // Get kehadiran for all children
          const { data: kehadiranData } = await supabase
            .from('kehadiran_santri')
            .select('status, sesi_pembelajaran!inner(tanggal)')
            .in('santri_id', childIds);
          
          const filteredKehadiran = (kehadiranData || []).filter(k => {
            const tanggal = (k.sesi_pembelajaran as any)?.tanggal;
            return tanggal >= semesterStart && tanggal <= semesterEnd;
          });
          
          const totalSesi = filteredKehadiran.length;
          const hadir = filteredKehadiran.filter(k => k.status === 'hadir').length;
          persentaseKehadiran = totalSesi > 0 ? `${Math.round((hadir / totalSesi) * 100)}%` : '0%';

          // Get tugas menunggu for all children
          const kelasIds = childrenData?.map(c => (c.santri as any)?.kelas_id).filter(Boolean) || [];
          
          if (kelasIds.length > 0) {
            const { data: mapelData } = await supabase
              .from('mapel')
              .select('id')
              .in('kelas_id', kelasIds)
              .eq('status', 'aktif');
            
            const mapelIds = mapelData?.map(m => m.id) || [];
            
            if (mapelIds.length > 0) {
              const { data: tugasData } = await supabase
                .from('tugas')
                .select('id')
                .in('mapel_id', mapelIds)
                .eq('status', 'aktif')
                .gte('tanggal_deadline', new Date().toISOString());
              
              const tugasIds = tugasData?.map(t => t.id) || [];
              
              if (tugasIds.length > 0) {
                const { data: submittedData } = await supabase
                  .from('pengumpulan_tugas')
                  .select('tugas_id, santri_id')
                  .in('santri_id', childIds)
                  .in('tugas_id', tugasIds);
                
                // Count unique tugas not submitted by any child
                const submittedByChild = new Set(submittedData?.map(s => `${s.santri_id}-${s.tugas_id}`) || []);
                
                for (const childId of childIds) {
                  for (const tugasId of tugasIds) {
                    if (!submittedByChild.has(`${childId}-${tugasId}`)) {
                      tugasAnak++;
                    }
                  }
                }
              }
            }
          }

          // Get rapor tersedia
          const { count: raporCount } = await supabase
            .from('raport')
            .select('*', { count: 'exact', head: true })
            .in('santri_id', childIds)
            .eq('is_published', true);
          
          raporTersedia = raporCount || 0;
        }

        setOrangtuaStats({
          jumlahAnak,
          persentaseKehadiran,
          tugasAnak,
          raporTersedia
        });
      } catch (error) {
        console.error('Error fetching orangtua stats:', error);
      } finally {
        setLoadingOrangtuaStats(false);
      }
    };

    fetchOrangtuaStats();
  }, [user, activeAcademicYear, getCurrentSemester]);

  const isTeacherRole = user?.role === 'guru' || user?.role === 'walikelas' || user?.role === 'Pembina';
  const { substituteMapelList } = useSubstituteMapel(isTeacherRole ? user?.id : undefined);

  if (!user) return null;

  // Merge own mapel with substitute mapel
  const userMapel = (() => {
    const own = mapelList.map(m => ({ ...m, _isSubstitute: false }));
    const subIds = new Set(own.map(m => m.id));
    const subs = substituteMapelList
      .filter(s => !subIds.has(s.mapel_id))
      .map(s => ({
        id: s.mapel_id,
        nama: s.mapel_nama,
        kode_mapel: '',
        deskripsi: '',
        kelas_id: s.kelas_id,
        pengampu_id: '',
        status: 'aktif',
        kelas: { nama: s.kelas_nama, tingkat: '' },
        _isSubstitute: true,
      }));
    return [...own, ...subs];
  })();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const getDashboardStats = () => {
    switch (user.role) {
      case 'admin':
        return [{
          icon: Briefcase,
          label: 'Jumlah Staff',
          value: loadingAdminStats ? '...' : adminStats.jumlahStaff.toString(),
          color: 'text-blue-600',
          bg: 'bg-blue-50'
        }, {
          icon: StudentIcon,
          label: 'Jumlah Santri',
          value: loadingAdminStats ? '...' : adminStats.jumlahSantri.toString(),
          color: 'text-emerald-600',
          bg: 'bg-emerald-50'
        }, {
          icon: UserCog,
          label: 'Jumlah Guru',
          value: loadingAdminStats ? '...' : adminStats.jumlahGuru.toString(),
          color: 'text-purple-600',
          bg: 'bg-purple-50'
        }, {
          icon: BookOpen,
          label: 'Jumlah Mapel',
          value: loadingAdminStats ? '...' : adminStats.jumlahMapel.toString(),
          color: 'text-primary',
          bg: 'bg-primary-light'
        }];
      case 'guru':
      case 'walikelas':
      case 'Pembina':
        return [{
          icon: Clock,
          label: 'Jam Mengajar Hari Ini',
          value: loadingGuruStats ? '...' : `${guruStats.totalJamMengajarHariIni} Jam`,
          color: 'text-primary',
          bg: 'bg-primary-light'
        }, {
          icon: BookOpen,
          label: 'Mapel Diampu',
          value: loadingGuruStats ? '...' : guruStats.totalMapelDiampu.toString(),
          color: 'text-blue-600',
          bg: 'bg-blue-50'
        }, {
          icon: CheckCircle,
          label: 'Kehadiran',
          value: loadingGuruStats ? '...' : guruStats.jumlahHadir.toString(),
          color: 'text-emerald-600',
          bg: 'bg-emerald-50'
        }, {
          icon: XCircle,
          label: 'Tidak Hadir',
          value: loadingGuruStats ? '...' : guruStats.jumlahTidakHadir.toString(),
          color: 'text-red-600',
          bg: 'bg-red-50'
        }];
      case 'guru_ekskul':
        return [{
          icon: Clock,
          label: 'Jam Mengajar Hari Ini',
          value: loadingGuruStats ? '...' : `${guruStats.totalJamMengajarHariIni} Jam`,
          color: 'text-fuchsia-600',
          bg: 'bg-fuchsia-50'
        }, {
          icon: BookOpen,
          label: 'Ekskul Diampu',
          value: loadingGuruStats ? '...' : guruStats.totalMapelDiampu.toString(),
          color: 'text-blue-600',
          bg: 'bg-blue-50'
        }, {
          icon: CheckCircle,
          label: 'Kehadiran',
          value: loadingGuruStats ? '...' : guruStats.jumlahHadir.toString(),
          color: 'text-emerald-600',
          bg: 'bg-emerald-50'
        }, {
          icon: XCircle,
          label: 'Tidak Hadir',
          value: loadingGuruStats ? '...' : guruStats.jumlahTidakHadir.toString(),
          color: 'text-red-600',
          bg: 'bg-red-50'
        }];
      case 'santri':
        return [{
          icon: BookOpen,
          label: 'Mata Pelajaran',
          value: loadingSantriStats ? '...' : santriStats.jumlahMapel.toString(),
          color: 'text-primary',
          bg: 'bg-primary-light',
          to: '/app/mapel',
        }, {
          icon: ClipboardList,
          label: 'Tugas Menunggu',
          value: loadingSantriStats ? '...' : santriStats.tugasMenunggu.toString(),
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          to: '/app/mapel',
        }, {
          icon: Calendar,
          label: 'Kehadiran',
          value: loadingSantriStats ? '...' : santriStats.persentaseKehadiran,
          color: 'text-green-600',
          bg: 'bg-green-50',
          to: '/app/kehadiran-santri',
        }, {
          icon: BookMarked,
          label: 'Materi Dibaca',
          value: loadingSantriStats ? '...' : santriStats.materiDibaca.toString(),
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          to: '/app/bahan-belajar',
        }];
      case 'orangtua':
        return [{
          icon: StudentIcon,
          label: 'Jumlah Anak',
          value: loadingOrangtuaStats ? '...' : orangtuaStats.jumlahAnak.toString(),
          color: 'text-primary',
          bg: 'bg-primary-light'
        }, {
          icon: Calendar,
          label: 'Kehadiran Anak',
          value: loadingOrangtuaStats ? '...' : orangtuaStats.persentaseKehadiran,
          color: 'text-green-600',
          bg: 'bg-green-50',
          to: '/app/kehadiran-santri',
        }, {
          icon: ClipboardList,
          label: 'Tugas Anak',
          value: loadingOrangtuaStats ? '...' : orangtuaStats.tugasAnak.toString(),
          color: 'text-orange-600',
          bg: 'bg-orange-50'
        }, {
          icon: FileText,
          label: 'Rapor Tersedia',
          value: loadingOrangtuaStats ? '...' : orangtuaStats.raporTersedia.toString(),
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          to: '/app/raport',
        }];
      case 'staff':
        return [{
          icon: CheckCircle,
          label: 'Kehadiran',
          value: loadingGuruStats ? '...' : guruStats.jumlahHadir.toString(),
          color: 'text-emerald-600',
          bg: 'bg-emerald-50'
        }, {
          icon: XCircle,
          label: 'Tidak Hadir',
          value: loadingGuruStats ? '...' : guruStats.jumlahTidakHadir.toString(),
          color: 'text-red-600',
          bg: 'bg-red-50'
        }];
      default:
        return [];
    }
  };

  const stats = getDashboardStats();

  const santriFeatures = [{
    icon: BookMarked,
    label: 'Tahfidz',
    description: 'Catatan hafalan',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    gradient: 'from-emerald-500 to-teal-500'
  }, ...(liburanConfig ? [{
    icon: Palmtree,
    label: 'Aktifitas Liburan',
    description: 'Aktivitas harian liburan',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    gradient: 'from-orange-500 to-amber-500'
  }] : []), {
    icon: FileText,
    label: 'Rapor',
    description: 'Lihat nilai rapor',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    gradient: 'from-blue-500 to-cyan-500'
  }, {
    icon: CalendarDays,
    label: 'Jadwal Pelajaran',
    description: 'Lihat jadwal',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    gradient: 'from-amber-500 to-orange-500'
  }, {
    icon: MessageSquare,
    label: 'Konseling',
    description: 'Prestasi & Pelanggaran',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    gradient: 'from-purple-500 to-pink-500'
  }, {
    icon: BookOpen,
    label: 'Hafalan',
    description: 'Hafalan Al-Quran',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    gradient: 'from-indigo-500 to-blue-500'
  }, {
    icon: CalendarCheck,
    label: 'Kehadiran',
    description: 'Rekap absensi',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    gradient: 'from-emerald-500 to-teal-500'
  }, {
    icon: FileQuestion,
    label: 'Ujian',
    description: 'Daftar ujian',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    gradient: 'from-rose-500 to-pink-500'
  }, {
    icon: FolderOpen,
    label: 'Buku Digital',
    description: 'Materi & bahan belajar',
    color: 'text-lime-600',
    bg: 'bg-lime-50',
    gradient: 'from-lime-500 to-green-500'
  }, {
    icon: Receipt,
    label: 'Tagihan',
    description: 'Tagihan SPP',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    gradient: 'from-sky-500 to-blue-500'
  }, ...(ramadhanConfig ? [{
    icon: Moon,
    label: 'Ramadhan',
    description: "Mutaba'ah Ramadhan",
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    gradient: 'from-teal-500 to-cyan-500'
  }] : [])];

  return (
    <div className="space-y-3 md:space-y-6">

      {/* Information Banner Carousel - Only show when there are published banners */}
      {banners.length > 0 && (user.role === 'santri' || user.role === 'admin' || user.role === 'guru' || user.role === 'walikelas' || user.role === 'orangtua' || user.role === 'staff') && (
        <div className="relative overflow-hidden rounded-xl md:rounded-2xl shadow-md">
          <Carousel 
            setApi={setCarouselApi}
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent>
              {banners.map((banner) => (
                <CarouselItem key={banner.id}>
                  {banner.tautan_aksi ? (
                    <a href={banner.tautan_aksi} target="_blank" rel="noopener noreferrer" className="block">
                      <div className="relative">
                        <img 
                          src={banner.gambar_url ? getBannerUrl(banner.gambar_url) : infoBanner} 
                          alt={banner.judul}
                          className="w-full h-32 sm:h-40 md:h-64 object-cover rounded-xl md:rounded-2xl"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-xl md:rounded-2xl" />
                        <div className="absolute bottom-2.5 md:bottom-6 left-3 md:left-6 right-3 md:right-6 text-white">
                          <h3 className="text-xs md:text-xl font-bold mb-0.5 md:mb-1 line-clamp-1">{banner.judul}</h3>
                          {banner.deskripsi && (
                            <p className="text-[10px] md:text-sm opacity-90 line-clamp-1 md:line-clamp-2">{banner.deskripsi}</p>
                          )}
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="relative">
                      <img 
                        src={banner.gambar_url ? getBannerUrl(banner.gambar_url) : infoBanner} 
                        alt={banner.judul}
                        className="w-full h-32 sm:h-40 md:h-64 object-cover rounded-xl md:rounded-2xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-xl md:rounded-2xl" />
                      <div className="absolute bottom-2.5 md:bottom-6 left-3 md:left-6 right-3 md:right-6 text-white">
                        <h3 className="text-xs md:text-xl font-bold mb-0.5 md:mb-1 line-clamp-1">{banner.judul}</h3>
                        {banner.deskripsi && (
                          <p className="text-[10px] md:text-sm opacity-90 line-clamp-1 md:line-clamp-2">{banner.deskripsi}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>

          {/* Navigation Dots */}
          {banners.length > 1 && (
            <div className="absolute bottom-1.5 md:bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-1 md:gap-2">
              {banners.map((_, index) => (
                <button
                  key={index}
                  onClick={() => carouselApi?.scrollTo(index)}
                  className={`h-1 md:h-2 rounded-full transition-all duration-300 ${
                    currentSlide === index 
                      ? 'w-5 md:w-8 bg-white' 
                      : 'w-1 md:w-2 bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 md:gap-5 lg:grid-cols-4">
        {stats.map((stat: any, index) => {
          const clickable = !!stat.to;
          const content = (
            <Card
              className={[
                "bg-card border transition-all duration-300 animate-fade-in",
                clickable ? "hover:shadow-lg hover:-translate-y-0.5 cursor-pointer" : "",
              ].filter(Boolean).join(" ")}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-3 md:p-6">
                <div className="flex items-center gap-2.5 md:gap-4">
                  <div className="rounded-full p-2 md:p-4 shrink-0" style={{ backgroundColor: '#E7F6F8' }}>
                    <div className="rounded-full p-1 md:p-2" style={{ backgroundColor: '#0DA8B6' }}>
                      <stat.icon className="h-4 w-4 md:h-6 md:w-6" style={{ color: '#FFFFFF' }} strokeWidth={2} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] md:text-sm text-muted-foreground mb-0.5 md:mb-2 truncate">
                      {stat.label}
                    </p>
                    <h3 className="text-xl md:text-3xl font-bold text-foreground">
                      {stat.value}
                    </h3>
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          if (clickable) {
            return (
              <Link
                key={index}
                to={stat.to}
                className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={index}>
              {content}
            </div>
          );
        })}
      </div>

      {/* Kehadiran Staff Card - For Admin, Guru, Walikelas, Guru Ekskul, Staff, and Pembina */}
      {(user.role === 'admin' || user.role === 'guru' || user.role === 'walikelas' || user.role === 'staff' || user.role === 'guru_ekskul' || user.role === 'Pembina') && (
        <KehadiranStaffCard />
      )}

      {/* Kalender Pendidikan Card - For Staff */}
      {user.role === 'staff' && (
        <KalenderPendidikanCard hideLink />
      )}

      {/* Kalender Pendidikan & Jadwal Mengajar - For Guru, Walikelas, Guru Ekskul, and Pembina */}
      {(user.role === 'guru' || user.role === 'walikelas' || user.role === 'guru_ekskul' || user.role === 'Pembina') && (
        <>
          <div className="grid gap-3 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <KehadiranGuruCard />
            <KalenderPendidikanCard />
          </div>
          {workspaceType === 'mandiri' && <GuruMandiriCharts />}
        </>
      )}

      {/* Jadwal Pelajaran & Kalender - For Santri */}
      {user.role === 'santri' && (
        <div className="grid gap-3 md:gap-6 grid-cols-1 lg:grid-cols-2">
          <div className="flex flex-col gap-3 md:gap-6">
            <JadwalSantriCard />
            <TugasSantriCard />
          </div>
          <KalenderPendidikanSantriCard />
        </div>
      )}

      {/* Jadwal Pelajaran Anak & Kalender - For Orangtua */}
      {user.role === 'orangtua' && (
        <>
          {ramadhanConfig && <RamadhanChildSummary />}
          <div className="grid gap-3 md:gap-6 grid-cols-1 lg:grid-cols-2">
            <div className="flex flex-col gap-3 md:gap-6">
              <JadwalAnakCard />
              <TugasAnakCard />
            </div>
            <KalenderPendidikanCard />
          </div>
        </>
      )}

      {/* Features Section - For Santri and Orangtua */}
      {(user.role === 'santri' || user.role === 'orangtua') && (
        <Card className="rounded-xl md:rounded-2xl border-0 shadow-sm bg-card">
          <CardHeader className="pb-2 md:pb-6 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-sm md:text-xl">Fitur Lainnya</CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 md:px-6 pb-3 md:pb-6">
            <div className="grid gap-2 md:gap-4 grid-cols-3 lg:grid-cols-6">
              {santriFeatures.filter(f => !(f.label === 'Tagihan' && user.role === 'santri')).map((feature, index) => {
                const isRapor = feature.label === 'Rapor';
                const isTagihan = feature.label === 'Tagihan';
                const content = (
                  <div className="group relative flex flex-col items-center gap-1 md:gap-3 p-2.5 md:p-5 rounded-xl md:rounded-3xl bg-gradient-to-br from-background to-accent/5 shadow-sm hover:shadow-xl text-center transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden">
                    {/* Playful background decoration */}
                    <div className={`absolute -top-4 -right-4 md:-top-10 md:-right-10 w-12 md:w-32 h-12 md:h-32 bg-gradient-to-br ${feature.gradient} opacity-10 rounded-full blur-lg md:blur-2xl group-hover:opacity-20 transition-opacity`} />
                    
                    {/* Icon container - compact on mobile */}
                    <div className="relative">
                      <div className={`relative z-10 p-2.5 md:p-6 rounded-lg md:rounded-2xl bg-gradient-to-br ${feature.gradient} group-hover:scale-110 transition-all duration-300 shadow-sm md:shadow-lg`}>
                        <feature.icon className="h-4 w-4 md:h-8 md:w-8 text-white relative z-10" />
                      </div>
                      {isTagihan && !!unpaidTagihanCount && unpaidTagihanCount > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 z-20 flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full bg-destructive text-[8px] md:text-[10px] font-bold text-destructive-foreground shadow-sm">
                          {unpaidTagihanCount > 9 ? '9+' : unpaidTagihanCount}
                        </span>
                      )}
                    </div>
                    
                    {/* Label - compact on mobile */}
                    <p className="relative z-10 text-[9px] md:text-sm font-medium md:font-bold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight line-clamp-2">
                      {feature.label}
                    </p>
                  </div>
                );
                
                if (isRapor) {
                  return (
                    <Link key={index} to="/app/raport">
                      {content}
                    </Link>
                  );
                }

                const isJadwal = feature.label === 'Jadwal Pelajaran';
                if (isJadwal) {
                  return (
                    <Link key={index} to="/app/jadwal">
                      {content}
                    </Link>
                  );
                }

                const isKehadiran = feature.label === 'Kehadiran';
                if (isKehadiran) {
                  return (
                    <Link key={index} to="/app/kehadiran-santri">
                      {content}
                    </Link>
                  );
                }

                const isTahfidz = feature.label === 'Tahfidz';
                if (isTahfidz) {
                  return (
                    <Link key={index} to="/app/tahfidz">
                      {content}
                    </Link>
                  );
                }

                const isHafalan = feature.label === 'Hafalan';
                if (isHafalan) {
                  return (
                    <Link key={index} to="/app/raport/hafalan">
                      {content}
                    </Link>
                  );
                }

                const isKonseling = feature.label === 'Konseling';
                if (isKonseling) {
                  return (
                    <Link key={index} to="/app/konseling">
                      {content}
                    </Link>
                  );
                }

                const isUjian = feature.label === 'Ujian';
                if (isUjian) {
                  return (
                    <Link key={index} to="/app/ujian">
                      {content}
                    </Link>
                  );
                }

                const isBukuDigital = feature.label === 'Buku Digital';
                if (isBukuDigital) {
                  return (
                    <Link key={index} to="/app/bahan-belajar">
                      {content}
                    </Link>
                  );
                }

                if (isTagihan) {
                  return (
                    <Link key={index} to="/app/tagihan">
                      {content}
                    </Link>
                  );
                }

                const isRamadhan = feature.label === 'Ramadhan';
                if (isRamadhan) {
                  return (
                    <Link key={index} to="/app/ramadhan">
                      {content}
                    </Link>
                  );
                }

                const isLiburan = feature.label === 'Aktifitas Liburan';
                if (isLiburan) {
                  return (
                    <Link key={index} to="/app/liburan">
                      {content}
                    </Link>
                  );
                }
                
                return (
                  <button key={index} className="w-full">
                    {content}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mata Pelajaran / Ekskul */}
      {user.role !== 'admin' && user.role !== 'orangtua' && user.role !== 'staff' && (
        <Card className="rounded-xl md:rounded-2xl border-0 shadow-sm">
          <CardHeader className="pb-2 md:pb-6 px-3 md:px-6 pt-3 md:pt-6">
            <CardTitle className="text-sm md:text-xl">
              {user.role === 'guru_ekskul' ? 'Ekskul Diampu' : (user.role === 'santri' ? 'Mata Pelajaran Saya' : 'Mata Pelajaran Diampu')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2.5 md:px-6 pb-3 md:pb-6">
            <div className="grid gap-2.5 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl md:rounded-2xl bg-muted/30 p-3 md:p-6 animate-pulse">
                      <div className="flex items-center gap-3 md:gap-5">
                        <Skeleton className="w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl shrink-0" />
                        <div className="flex-1 min-w-0">
                          <Skeleton className="h-4 md:h-6 w-3/4 mb-1.5 md:mb-3" />
                          <Skeleton className="h-3 md:h-4 w-full" />
                        </div>
                        <Skeleton className="md:hidden w-7 h-7 rounded-full shrink-0" />
                      </div>
                    </div>
                  ))}
                </>
              ) : userMapel.length === 0 ? (
                <p className="text-muted-foreground col-span-full text-center py-4 md:py-8 text-xs md:text-base">Belum ada mata pelajaran</p>
              ) : (
                userMapel.slice(0, 3).map((mapel, index) => {
                  const style = {
                    gradient: 'from-primary/5 to-primary/10',
                    icon: 'bg-primary text-primary-foreground',
                    border: 'border-primary/20'
                  };
                  
                  return (
                    <Link key={mapel.id} to={`/app/mapel/${mapel.id}`}>
                      <div id="card_mapel" className={`group relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br ${style.gradient} shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer h-full hover:-translate-y-1 active:scale-[0.98]`}>
                        <div className="absolute -top-4 -right-4 md:-top-8 md:-right-8 w-12 md:w-24 h-12 md:h-24 bg-gradient-to-br from-white/10 to-transparent rounded-full blur-lg md:blur-2xl" />
                        
                        <div className="relative p-3 md:p-6">
                          <div className="flex items-center gap-3 md:gap-5">
                            {/* Icon container - compact on mobile */}
                            <div className={`${style.icon} w-10 h-10 md:w-16 md:h-16 rounded-lg md:rounded-xl flex items-center justify-center shadow-md group-hover:scale-110 transition-all duration-300 shrink-0`}>
                              <BookOpen className="h-5 w-5 md:h-8 md:w-8" />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 md:mb-1">
                                <h3 className="text-sm md:text-xl font-bold text-foreground group-hover:text-primary transition-colors truncate">
                                  {mapel.nama}
                                </h3>
                                {'_isSubstitute' in mapel && (mapel as any)._isSubstitute && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] md:text-[10px] font-semibold shrink-0">
                                    <UserCheck className="h-2.5 w-2.5" />
                                    Pengganti
                                  </span>
                                )}
                              </div>
                              
                              {mapel.kelas && (
                                <p className="text-[10px] md:text-xs text-primary/80 font-medium mb-0.5 md:mb-1.5 truncate">
                                  {mapel.kelas.nama} • {mapel.kelas.tingkat}
                                </p>
                              )}
                              
                              <p className="text-[11px] md:text-sm text-muted-foreground truncate md:line-clamp-2 leading-relaxed">
                                {mapel.deskripsi || 'Mari belajar bersama! ✨'}
                              </p>
                            </div>
                            
                            {/* Arrow indicator on mobile */}
                            <div className="md:hidden shrink-0">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                          
                          {/* Bottom action button - hidden on mobile */}
                          <div className="hidden md:block mt-5">
                            <button className="w-full flex items-center justify-between px-0 py-3 text-primary hover:text-primary/80 font-medium text-sm transition-all duration-300 group/btn">
                              <span>Lihat Detail</span>
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 rounded-full bg-primary/10 group-hover/btn:bg-primary/20 flex items-center justify-center transition-colors">
                                  <svg className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                })
              )}
            </div>
            {userMapel.length > 3 && (
              <div className="mt-3 md:mt-4 flex justify-center">
                <Link to="/app/mapel">
                  <Button variant="outline" size="sm" className="gap-2">
                    Lihat Semua
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
