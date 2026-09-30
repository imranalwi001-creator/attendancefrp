import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getLocalDateString } from '@/lib/dateUtils';

interface SubstituteMapel {
  mapel_id: string;
  mapel_nama: string;
  kelas_nama: string;
  kelas_id: string;
}

/**
 * Hook to query active substitute teacher (guru pengganti) assignments.
 * Returns mapel IDs that the current user can access as a substitute.
 * 
 * Access logic:
 * - There's a guru_pengganti record for today with this user as guru_pengganti_id
 * - AND either no sesi_pembelajaran exists yet, or the session hasn't ended (waktu_selesai IS NULL)
 */
export function useSubstituteMapel(userId: string | undefined) {
  const [substituteMapelIds, setSubstituteMapelIds] = useState<string[]>([]);
  const [substituteMapelList, setSubstituteMapelList] = useState<SubstituteMapel[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setSubstituteMapelIds([]);
      setSubstituteMapelList([]);
      return;
    }

    const fetchSubstituteAccess = async () => {
      setLoading(true);
      try {
        const today = getLocalDateString();

        // Step 1: Get guru_pengganti records for today where this user is the substitute
        const { data: gpData, error: gpError } = await supabase
          .from('guru_pengganti')
          .select('id, jadwal_id, tanggal')
          .eq('guru_pengganti_id', userId)
          .eq('tanggal', today);

        if (gpError) throw gpError;
        if (!gpData || gpData.length === 0) {
          setSubstituteMapelIds([]);
          setSubstituteMapelList([]);
          setLoading(false);
          return;
        }

        // Step 2: Get jadwal details to find mapel_ids
        const jadwalIds = gpData.map(gp => gp.jadwal_id);
        const { data: jadwalData, error: jadwalError } = await supabase
          .from('jadwal')
          .select('id, mapel_id')
          .in('id', jadwalIds)
          .not('mapel_id', 'is', null);

        if (jadwalError) throw jadwalError;
        if (!jadwalData || jadwalData.length === 0) {
          setSubstituteMapelIds([]);
          setSubstituteMapelList([]);
          setLoading(false);
          return;
        }

        // Step 3: Check sesi_pembelajaran - filter out sessions that are already finished
        const { data: sesiData, error: sesiError } = await supabase
          .from('sesi_pembelajaran')
          .select('jadwal_id, waktu_selesai')
          .in('jadwal_id', jadwalIds)
          .eq('tanggal', today);

        if (sesiError) throw sesiError;

        // Build a map: jadwal_id -> whether session is finished
        const sesiFinishedMap = new Map<string, boolean>();
        sesiData?.forEach(sesi => {
          if (sesi.waktu_selesai) {
            sesiFinishedMap.set(sesi.jadwal_id, true);
          }
        });

        // Filter: keep jadwal where session is NOT finished (or doesn't exist yet)
        const activeJadwalIds = jadwalIds.filter(jId => !sesiFinishedMap.get(jId));

        // Get unique mapel_ids from active jadwal
        const activeMapelIds = [...new Set(
          jadwalData
            .filter(j => activeJadwalIds.includes(j.id) && j.mapel_id)
            .map(j => j.mapel_id!)
        )];

        if (activeMapelIds.length === 0) {
          setSubstituteMapelIds([]);
          setSubstituteMapelList([]);
          setLoading(false);
          return;
        }

        // Step 4: Fetch mapel details for the active substitute assignments
        const { data: mapelData, error: mapelError } = await supabase
          .from('mapel')
          .select('id, nama, kelas_id, kelas:kelas_id(id, nama)')
          .in('id', activeMapelIds);

        if (mapelError) throw mapelError;

        const result: SubstituteMapel[] = (mapelData || []).map((m: any) => ({
          mapel_id: m.id,
          mapel_nama: m.nama,
          kelas_id: m.kelas_id,
          kelas_nama: m.kelas?.nama || '-',
        }));

        setSubstituteMapelIds(activeMapelIds);
        setSubstituteMapelList(result);
      } catch (error) {
        console.error('Error fetching substitute mapel access:', error);
        setSubstituteMapelIds([]);
        setSubstituteMapelList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSubstituteAccess();
  }, [userId]);

  return {
    substituteMapelIds,
    substituteMapelList,
    isSubstituteLoading: loading,
    isSubstitute: (mapelId: string) => substituteMapelIds.includes(mapelId),
  };
}
