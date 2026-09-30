import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SaasLicensePlan {
  id: string;
  name: string;
  badge: string;
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive';
  price: number;
  billingCycleText: string;
  isPopular?: boolean;
  maxStudents: number; // 0 = unlimited
  maxTeachers: number; // 0 = unlimited
  features: string[];
  description?: string;
}

export const DEFAULT_SAAS_PLANS: SaasLicensePlan[] = [
  {
    id: 'trial',
    name: 'Trial 30 Hari',
    badge: 'Free Trial',
    badgeVariant: 'outline',
    price: 0,
    billingCycleText: '/ bln',
    isPopular: false,
    maxStudents: 100,
    maxTeachers: 15,
    features: [
      'Maksimal 100 Siswa & 15 Guru',
      'Akses CBT & Penugasan',
      'Masa percobaan gratis'
    ]
  },
  {
    id: 'starter',
    name: 'Starter School',
    badge: 'Starter',
    badgeVariant: 'secondary',
    price: 450000,
    billingCycleText: '/ bln',
    isPopular: false,
    maxStudents: 250,
    maxTeachers: 25,
    features: [
      'Maksimal 250 Siswa & 25 Guru',
      'CBT & Bank Soal Interaktif',
      'Absensi Geofencing & Foto'
    ]
  },
  {
    id: 'pro',
    name: 'Pro School',
    badge: 'Pro',
    badgeVariant: 'default',
    price: 750000,
    billingCycleText: '/ bln',
    isPopular: true,
    maxStudents: 600,
    maxTeachers: 60,
    features: [
      'Maksimal 600 Siswa & 60 Guru',
      'Modul Raport K13 & Kurikulum Merdeka',
      'Notifikasi WhatsApp Gateway'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pesantren',
    badge: 'Enterprise',
    badgeVariant: 'outline',
    price: 1500000,
    billingCycleText: '/ bln',
    isPopular: false,
    maxStudents: 0,
    maxTeachers: 0,
    features: [
      'Siswa & Guru Unlimited',
      'Modul Tahfidz, Kitab Kuning & Asrama',
      'Custom Domain & Dedicated Support'
    ]
  }
];

export function useSaasPlans() {
  const queryClient = useQueryClient();

  const { data: plans = DEFAULT_SAAS_PLANS, isLoading, error } = useQuery({
    queryKey: ['saas_license_plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'saas_license_plans')
        .maybeSingle();

      if (error) {
        console.warn('Gagal memuat saas_license_plans dari DB, memakai default:', error.message);
        return DEFAULT_SAAS_PLANS;
      }

      if (data?.setting_value) {
        try {
          const parsed = JSON.parse(data.setting_value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed as SaasLicensePlan[];
          }
        } catch (e) {
          console.error('Gagal parsing JSON saas_license_plans:', e);
        }
      }

      return DEFAULT_SAAS_PLANS;
    },
    staleTime: 1000 * 60 * 5, // 5 menit
  });

  const updatePlansMutation = useMutation({
    mutationFn: async (newPlans: SaasLicensePlan[]) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'saas_license_plans',
          setting_value: JSON.stringify(newPlans),
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      return newPlans;
    },
    onSuccess: (updatedPlans) => {
      queryClient.setQueryData(['saas_license_plans'], updatedPlans);
      queryClient.invalidateQueries({ queryKey: ['saas_license_plans'] });
      toast.success('Paket lisensi SaaS berhasil diperbarui!');
    },
    onError: (err: any) => {
      toast.error('Gagal memperbarui paket lisensi: ' + err.message);
    }
  });

  const resetPlansMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'saas_license_plans',
          setting_value: JSON.stringify(DEFAULT_SAAS_PLANS),
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) throw error;
      return DEFAULT_SAAS_PLANS;
    },
    onSuccess: (defaultPlans) => {
      queryClient.setQueryData(['saas_license_plans'], defaultPlans);
      queryClient.invalidateQueries({ queryKey: ['saas_license_plans'] });
      toast.success('Paket lisensi berhasil direset ke bawaan sistem!');
    },
    onError: (err: any) => {
      toast.error('Gagal mereset paket lisensi: ' + err.message);
    }
  });

  return {
    plans,
    isLoading,
    error,
    updatePlans: updatePlansMutation.mutateAsync,
    isUpdating: updatePlansMutation.isPending,
    resetPlans: resetPlansMutation.mutateAsync,
    isResetting: resetPlansMutation.isPending
  };
}
