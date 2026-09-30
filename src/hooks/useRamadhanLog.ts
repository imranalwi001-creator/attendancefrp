import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Fallback if no DB config exists
const FALLBACK_RAMADHAN_START = new Date(2025, 2, 1);

export interface RamadhanConfig {
  id: string;
  tahun_hijriah: string;
  tanggal_mulai: string;
  is_active: boolean;
}

// Hook to fetch active Ramadhan config from DB
export function useRamadhanConfig() {
  return useQuery({
    queryKey: ['ramadhan-config-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ramadhan_config' as any)
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RamadhanConfig | null;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

export function getRamadhanStartDate(config: RamadhanConfig | null | undefined): Date {
  if (config?.tanggal_mulai) {
    return new Date(config.tanggal_mulai + 'T00:00:00');
  }
  return FALLBACK_RAMADHAN_START;
}

export function getHijriDay(date: Date, startDate?: Date, clamp: boolean = true): number {
  const start = startDate || FALLBACK_RAMADHAN_START;
  const diffTime = date.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const day = diffDays + 1;
  return clamp ? Math.max(1, Math.min(30, day)) : day;
}

export interface RamadhanActivity {
  id: string;
  title: string;
  category: string;
  target_daily: number;
}

export interface RamadhanDailyLog {
  id: string;
  santri_id: string;
  activity_id: string;
  date: string;
  hijri_day: number | null;
  is_completed: boolean;
  excuse_reason: string | null;
}

export function useRamadhanActivities() {
  return useQuery({
    queryKey: ['ramadhan-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ramadhan_activities' as any)
        .select('*')
        .order('category');
      if (error) throw error;
      return (data || []) as unknown as RamadhanActivity[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour - master data rarely changes
  });
}

export function useRamadhanDailyLogs(santriId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['ramadhan-logs', santriId, date],
    queryFn: async () => {
      if (!santriId) return [];
      const { data, error } = await supabase
        .from('ramadhan_daily_logs' as any)
        .select('*')
        .eq('santri_id', santriId)
        .eq('date', date);
      if (error) throw error;
      return (data || []) as unknown as RamadhanDailyLog[];
    },
    enabled: !!santriId,
  });
}

export function useSaveRamadhanLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      santriId,
      date,
      checkedActivityIds,
      hijriDay,
      excuses,
    }: {
      santriId: string;
      date: string;
      checkedActivityIds: string[];
      hijriDay: number;
      excuses?: Record<string, string>;
    }) => {
      // Step 1: Delete existing logs for this date
      const { error: deleteError } = await supabase
        .from('ramadhan_daily_logs' as any)
        .delete()
        .eq('santri_id', santriId)
        .eq('date', date);
      if (deleteError) throw deleteError;

      // Step 2: Build rows for completed + excused activities
      const rows: any[] = [];
      checkedActivityIds.forEach((activityId) => {
        rows.push({
          santri_id: santriId,
          activity_id: activityId,
          date,
          hijri_day: hijriDay,
          is_completed: true,
          excuse_reason: null,
        });
      });
      if (excuses) {
        Object.entries(excuses).forEach(([activityId, reason]) => {
          if (!checkedActivityIds.includes(activityId)) {
            rows.push({
              santri_id: santriId,
              activity_id: activityId,
              date,
              hijri_day: hijriDay,
              is_completed: false,
              excuse_reason: reason,
            });
          }
        });
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('ramadhan_daily_logs' as any)
          .insert(rows);
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ramadhan-logs', variables.santriId, variables.date] });
      queryClient.invalidateQueries({ queryKey: ['ramadhan-30day-logs', variables.santriId] });
      toast({ title: 'Berhasil', description: 'Laporan amalan berhasil disimpan.' });
    },
    onError: (error: any) => {
      toast({ title: 'Gagal Menyimpan', description: error.message, variant: 'destructive' });
    },
  });
}

// Mood hooks
export interface RamadhanMood {
  id: string;
  santri_id: string;
  date: string;
  mood: string;
  tilawah_surah_awal: string | null;
  tilawah_surah_akhir: string | null;
}

export function useRamadhanMood(santriId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['ramadhan-mood', santriId, date],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase
        .from('ramadhan_mood' as any)
        .select('*')
        .eq('santri_id', santriId)
        .eq('date', date)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as RamadhanMood | null;
    },
    enabled: !!santriId,
  });
}

export function useSaveRamadhanMood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ santriId, date, mood, tilawah_surah_awal, tilawah_surah_akhir }: { santriId: string; date: string; mood: string; tilawah_surah_awal?: string; tilawah_surah_akhir?: string }) => {
      const { error } = await supabase
        .from('ramadhan_mood' as any)
        .upsert({ santri_id: santriId, date, mood, tilawah_surah_awal: tilawah_surah_awal || null, tilawah_surah_akhir: tilawah_surah_akhir || null }, { onConflict: 'santri_id,date' });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ramadhan-mood', variables.santriId, variables.date] });
    },
  });
}

// Hook for parent to fetch children's logs
export function useRamadhanChildLogs(childId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['ramadhan-child-logs', childId, date],
    queryFn: async () => {
      if (!childId) return [];
      const { data, error } = await supabase
        .from('ramadhan_daily_logs' as any)
        .select('*')
        .eq('santri_id', childId)
        .eq('date', date);
      if (error) throw error;
      return (data || []) as unknown as RamadhanDailyLog[];
    },
    enabled: !!childId,
  });
}
