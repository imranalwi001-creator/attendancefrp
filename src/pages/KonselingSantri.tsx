import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Trophy, AlertTriangle, Calendar, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/contexts/AcademicYearContext';
import { useAuth } from '@/contexts/AuthContext';
import { BadgeTahunAjaran } from '@/components/kalender/BadgeTahunAjaran';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface KonselingRecord {
  id: string;
  tipe: string;
  kategori: string;
  poin: number;
  deskripsi: string | null;
  tanggal: string;
}

export default function KonselingSantri() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeAcademicYear, getCurrentSemester } = useAcademicYear();
  const currentSemester = getCurrentSemester() || 'ganjil';
  const isOrangtua = user?.role === 'orangtua';
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  // Fetch children for orangtua
  const { data: childrenData = [] } = useQuery({
    queryKey: ['parent-children-konseling', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: parentChildren } = await supabase
        .from('parent_children')
        .select('child_id')
        .eq('parent_id', user.id);
      
      if (!parentChildren || parentChildren.length === 0) return [];

      const childIds = parentChildren.map(pc => pc.child_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', childIds);

      return (profilesData || []).map(p => ({
        id: p.id,
        name: p.name || 'Anak',
        avatar_url: p.avatar_url
      }));
    },
    enabled: !!user?.id && isOrangtua
  });

  // Set default selected child
  const effectiveChildId = selectedChildId || (childrenData.length > 0 ? childrenData[0].id : null);

  // Determine which santri ID to use
  const santriId = isOrangtua ? effectiveChildId : user?.id;

  // Fetch konseling records for current user or selected child
  const { data: konselingRecords = [], isLoading } = useQuery({
    queryKey: ['konseling-santri', santriId, activeAcademicYear?.id, currentSemester],
    queryFn: async () => {
      if (!santriId) return [];

      let query = supabase
        .from('konseling_records')
        .select('*')
        .eq('santri_id', santriId)
        .order('tanggal', { ascending: false });

      if (activeAcademicYear?.id) {
        query = query.eq('academic_year_id', activeAcademicYear.id);
      }
      query = query.eq('semester', currentSemester);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!santriId
  });

  // Calculate stats
  const stats = useMemo(() => {
    const prestasiRecords = konselingRecords.filter(r => r.tipe === 'prestasi');
    const pelanggaranRecords = konselingRecords.filter(r => r.tipe === 'pelanggaran');
    
    const totalPrestasi = prestasiRecords.reduce((sum, r) => sum + (r.poin || 0), 0);
    const totalPelanggaran = pelanggaranRecords.reduce((sum, r) => sum + (r.poin || 0), 0);

    return {
      prestasiRecords,
      pelanggaranRecords,
      totalPrestasi,
      totalPelanggaran,
      netPoints: totalPrestasi - totalPelanggaran
    };
  }, [konselingRecords]);

  // Calculate weekly progress data
  const progressData = useMemo(() => {
    const weeks: { [key: string]: { prestasi: number; pelanggaran: number } } = {};
    const now = new Date();
    
    // Initialize last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekKey = `Minggu ${4 - i}`;
      weeks[weekKey] = { prestasi: 0, pelanggaran: 0 };
    }

    // Count records per week
    konselingRecords.forEach(record => {
      const recordDate = new Date(record.tanggal);
      const diffTime = now.getTime() - recordDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(diffDays / 7);
      
      if (weekIndex >= 0 && weekIndex < 4) {
        const weekKey = `Minggu ${4 - weekIndex}`;
        if (weeks[weekKey]) {
          if (record.tipe === 'prestasi') {
            weeks[weekKey].prestasi += record.poin;
          } else {
            weeks[weekKey].pelanggaran += record.poin;
          }
        }
      }
    });

    return Object.entries(weeks).map(([minggu, data]) => ({ minggu, ...data }));
  }, [konselingRecords]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-4 md:p-6 pb-24">
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 pb-24">
      {/* Header with Gradient */}
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
              {isOrangtua ? 'Konseling Anak' : 'Konseling'}
            </h1>
            <BadgeTahunAjaran className="bg-primary-foreground/20 text-primary-foreground" />
          </div>
        </div>
      </div>

      {/* Child Selector for Orangtua */}
      {isOrangtua && childrenData.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-md overflow-hidden">
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
                        {child.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
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

      {/* Stats Cards */}
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold">Ringkasan Poin</h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Prestasi Card */}
            <div className="bg-card hover:shadow-md transition-all duration-300 animate-fade-in border rounded-xl p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full p-2 sm:p-2.5 shrink-0 bg-emerald-100 dark:bg-emerald-900/30">
                  <div className="rounded-full p-1 sm:p-1.5 bg-emerald-500">
                    <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" strokeWidth={2} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Poin Prestasi</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{stats.totalPrestasi}</h3>
                </div>
              </div>
            </div>

            {/* Pelanggaran Card */}
            <div className="bg-card hover:shadow-md transition-all duration-300 animate-fade-in border rounded-xl p-3 sm:p-4" style={{ animationDelay: '100ms' }}>
              <div className="flex items-start gap-3">
                <div className="rounded-full p-2 sm:p-2.5 shrink-0 bg-red-100 dark:bg-red-900/30">
                  <div className="rounded-full p-1 sm:p-1.5 bg-red-500">
                    <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" strokeWidth={2} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Poin Pelanggaran</p>
                  <h3 className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">-{stats.totalPelanggaran}</h3>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Chart */}
          <div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressData} barGap={2} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="minggu" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={30} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px -4px rgba(0,0,0,0.15)',
                      padding: '12px 16px'
                    }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <Bar dataKey="prestasi" name="Prestasi" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="pelanggaran" name="Pelanggaran" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Prestasi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Pelanggaran</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Riwayat Konseling */}
      <Card>
        <CardContent className="pt-4 px-0 pb-0">
          <div className="px-4 mb-4">
            <h3 className="font-semibold">Riwayat Konseling</h3>
          </div>

          <div className="p-4 space-y-3">
            {konselingRecords.length === 0 ? (
              <div className="py-8 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-muted-foreground">Belum ada riwayat konseling</p>
              </div>
            ) : (
              konselingRecords.map((record) => {
                const isPrestasi = record.tipe === 'prestasi';
                return (
                  <div
                    key={record.id}
                    className="bg-card border rounded-xl flex items-center justify-between px-4 py-3 hover:shadow-sm transition-shadow"
                  >
                    {/* Icon & Title */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isPrestasi 
                          ? 'bg-emerald-50 dark:bg-emerald-950/30' 
                          : 'bg-red-50 dark:bg-red-950/30'
                      }`}>
                        {isPrestasi ? (
                          <Trophy className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-sm truncate">{record.kategori}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {record.deskripsi || (isPrestasi ? 'Prestasi' : 'Pelanggaran')}
                        </p>
                      </div>
                    </div>

                    {/* Tanggal */}
                    <div className="hidden sm:block text-left w-[100px]">
                      <p className="text-xs text-muted-foreground">Tanggal</p>
                      <p className="text-sm font-medium">
                        {format(new Date(record.tanggal), 'd MMM yyyy', { locale: localeId })}
                      </p>
                    </div>

                    {/* Badge Poin */}
                    <div className="w-[80px]">
                      <Badge 
                        variant="secondary" 
                        className={`w-full justify-center ${
                          isPrestasi 
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}
                      >
                        {isPrestasi ? '+' : '-'}{record.poin} Poin
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
