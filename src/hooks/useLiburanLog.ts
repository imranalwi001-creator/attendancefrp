import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LiburanConfig {
  id: string;
  nama: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  is_active: boolean;
}

export function useLiburanConfig() {
  return useQuery({
    queryKey: ['liburan-config-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liburan_config' as any)
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LiburanConfig | null;
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function getLiburanStartDate(config: LiburanConfig | null | undefined): Date {
  if (config?.tanggal_mulai) {
    return new Date(config.tanggal_mulai + 'T00:00:00');
  }
  return new Date();
}

export function getLiburanDuration(config: LiburanConfig | null | undefined): number {
  if (config?.tanggal_mulai && config?.tanggal_selesai) {
    const start = new Date(config.tanggal_mulai);
    const end = new Date(config.tanggal_selesai);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }
  return 7;
}

export function getLiburanDay(date: Date, startDate?: Date, totalDays?: number, clamp: boolean = true): number {
  const start = startDate || new Date();
  const diffTime = date.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const day = diffDays + 1;
  const max = totalDays || 30;
  return clamp ? Math.max(1, Math.min(max, day)) : day;
}

export interface LiburanActivity {
  id: string;
  title: string;
  category: string;
  target_daily: number;
}

export interface LiburanDailyLog {
  id: string;
  santri_id: string;
  activity_id: string;
  date: string;
  day_number: number | null;
  is_completed: boolean;
  excuse_reason: string | null;
}

export function useLiburanActivities() {
  return useQuery({
    queryKey: ['liburan-activities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('liburan_activities' as any)
        .select('*')
        .order('category');
      if (error) throw error;
      return (data || []) as unknown as LiburanActivity[];
    },
    staleTime: 1000 * 60 * 60,
  });
}

export function useLiburanDailyLogs(santriId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['liburan-logs', santriId, date],
    queryFn: async () => {
      if (!santriId) return [];
      const { data, error } = await supabase
        .from('liburan_daily_logs' as any)
        .select('*')
        .eq('santri_id', santriId)
        .eq('date', date);
      if (error) throw error;
      return (data || []) as unknown as LiburanDailyLog[];
    },
    enabled: !!santriId,
  });
}

export function useSaveLiburanLog() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      santriId,
      date,
      checkedActivityIds,
      dayNumber,
      excuses,
    }: {
      santriId: string;
      date: string;
      checkedActivityIds: string[];
      dayNumber: number;
      excuses?: Record<string, string>;
    }) => {
      const { error: deleteError } = await supabase
        .from('liburan_daily_logs' as any)
        .delete()
        .eq('santri_id', santriId)
        .eq('date', date);
      if (deleteError) throw deleteError;

      const rows: any[] = [];
      checkedActivityIds.forEach((activityId) => {
        rows.push({
          santri_id: santriId,
          activity_id: activityId,
          date,
          day_number: dayNumber,
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
              day_number: dayNumber,
              is_completed: false,
              excuse_reason: reason,
            });
          }
        });
      }

      if (rows.length > 0) {
        const { error: insertError } = await supabase
          .from('liburan_daily_logs' as any)
          .insert(rows);
        if (insertError) throw insertError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['liburan-logs', variables.santriId, variables.date] });
      queryClient.invalidateQueries({ queryKey: ['liburan-30day-logs', variables.santriId] });
      toast({ title: 'Berhasil', description: 'Laporan aktivitas berhasil disimpan.' });
    },
    onError: (error: any) => {
      toast({ title: 'Gagal Menyimpan', description: error.message, variant: 'destructive' });
    },
  });
}

export interface LiburanMood {
  id: string;
  santri_id: string;
  date: string;
  mood: string;
}

export function useLiburanMood(santriId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['liburan-mood', santriId, date],
    queryFn: async () => {
      if (!santriId) return null;
      const { data, error } = await supabase
        .from('liburan_mood' as any)
        .select('*')
        .eq('santri_id', santriId)
        .eq('date', date)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LiburanMood | null;
    },
    enabled: !!santriId,
  });
}

export function useSaveLiburanMood() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ santriId, date, mood }: { santriId: string; date: string; mood: string }) => {
      const { error } = await supabase
        .from('liburan_mood' as any)
        .upsert({ santri_id: santriId, date, mood }, { onConflict: 'santri_id,date' });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['liburan-mood', variables.santriId, variables.date] });
    },
  });
}

export function useLiburanChildLogs(childId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['liburan-child-logs', childId, date],
    queryFn: async () => {
      if (!childId) return [];
      const { data, error } = await supabase
        .from('liburan_daily_logs' as any)
        .select('*')
        .eq('santri_id', childId)
        .eq('date', date);
      if (error) throw error;
      return (data || []) as unknown as LiburanDailyLog[];
    },
    enabled: !!childId,
  });
}
