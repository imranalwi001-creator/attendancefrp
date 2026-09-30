import { supabase } from "@/integrations/supabase/client";
import { isEditorMode } from "@/hooks/useEditorMode";

export type ActivityCategory = 
  | 'user_management'
  | 'academic_year'
  | 'academic'
  | 'calendar'
  | 'counseling'
  | 'attendance'
  | 'leave_request'
  | 'settings';

export type ActivityAction = 
  // User Management
  | 'user_add'
  | 'user_edit'
  | 'user_delete'
  // Academic Year
  | 'academic_year_add'
  | 'academic_year_edit'
  | 'academic_year_activate'
  | 'academic_year_deactivate'
  | 'academic_year_delete'
  // Academic
  | 'master_mapel_add'
  | 'master_mapel_edit'
  | 'master_mapel_delete'
  | 'kelas_add'
  | 'kelas_edit'
  | 'kelas_delete'
  | 'mapel_add'
  | 'mapel_edit'
  | 'mapel_delete'
  | 'jadwal_add'
  | 'jadwal_edit'
  | 'jadwal_delete'
  // Calendar
  | 'calendar_agenda_add'
  | 'calendar_agenda_edit'
  | 'calendar_agenda_delete'
  | 'calendar_agenda_submit'
  | 'calendar_agenda_approve'
  | 'calendar_agenda_reject'
  // Counseling
  | 'counseling_achievement_add'
  | 'counseling_violation_add'
  | 'counseling_edit'
  | 'counseling_delete'
  // Attendance
  | 'attendance_checkin'
  | 'attendance_checkout'
  | 'attendance_override'
  | 'attendance_download'
  // Leave Request
  | 'leave_add'
  | 'leave_edit'
  | 'leave_approve'
  | 'leave_reject'
  | 'leave_delete'
  // Settings
  | 'settings_work_hours'
  | 'settings_location'
  | 'settings_system';

interface LogActivityParams {
  action: ActivityAction;
  category: ActivityCategory;
  description: string;
  metadata?: Record<string, unknown>;
}

export const getCategoryLabel = (category: ActivityCategory): string => {
  const labels: Record<ActivityCategory, string> = {
    user_management: 'Manajemen User',
    academic_year: 'Tahun Ajaran',
    academic: 'Akademik',
    calendar: 'Kalender Pendidikan',
    counseling: 'Konseling',
    attendance: 'Absensi',
    leave_request: 'Pengajuan Izin',
    settings: 'Pengaturan',
  };
  return labels[category] || category;
};

export const getActionLabel = (action: ActivityAction): string => {
  const labels: Record<ActivityAction, string> = {
    user_add: 'Tambah User',
    user_edit: 'Edit User',
    user_delete: 'Hapus User',
    academic_year_add: 'Tambah Tahun Ajaran',
    academic_year_edit: 'Edit Tahun Ajaran',
    academic_year_activate: 'Aktifkan Tahun Ajaran',
    academic_year_deactivate: 'Nonaktifkan Tahun Ajaran',
    academic_year_delete: 'Hapus Tahun Ajaran',
    master_mapel_add: 'Tambah Master Mapel',
    master_mapel_edit: 'Edit Master Mapel',
    master_mapel_delete: 'Hapus Master Mapel',
    kelas_add: 'Tambah Kelas',
    kelas_edit: 'Edit Kelas',
    kelas_delete: 'Hapus Kelas',
    mapel_add: 'Tambah Mata Pelajaran',
    mapel_edit: 'Edit Mata Pelajaran',
    mapel_delete: 'Hapus Mata Pelajaran',
    jadwal_add: 'Tambah Jadwal',
    jadwal_edit: 'Edit Jadwal',
    jadwal_delete: 'Hapus Jadwal',
    calendar_agenda_add: 'Tambah Agenda',
    calendar_agenda_edit: 'Edit Agenda',
    calendar_agenda_delete: 'Hapus Agenda',
    calendar_agenda_submit: 'Ajukan Agenda',
    calendar_agenda_approve: 'Setujui Agenda',
    calendar_agenda_reject: 'Tolak Agenda',
    counseling_achievement_add: 'Tambah Prestasi',
    counseling_violation_add: 'Tambah Pelanggaran',
    counseling_edit: 'Edit Konseling',
    counseling_delete: 'Hapus Konseling',
    attendance_checkin: 'Absen Masuk',
    attendance_checkout: 'Absen Pulang',
    attendance_override: 'Koreksi Absensi',
    attendance_download: 'Download Laporan',
    leave_add: 'Tambah Izin',
    leave_edit: 'Edit Izin',
    leave_approve: 'Konfirmasi Izin',
    leave_reject: 'Tolak Izin',
    leave_delete: 'Hapus Izin',
    settings_work_hours: 'Ubah Waktu Kerja',
    settings_location: 'Ubah Lokasi Absen',
    settings_system: 'Ubah Pengaturan',
  };
  return labels[action] || action;
};

export const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    admin: 'Admin',
    guru: 'Guru',
    walikelas: 'Wali Kelas',
    santri: 'Santri',
    orangtua: 'Orang Tua',
    Pembina: 'Pembina',
    staff: 'Staff',
    guru_ekskul: 'Guru Ekskul',
  };
  return labels[role] || role;
};

export async function logActivity(params: LogActivityParams): Promise<void> {
  // Skip activity logging in editor mode for better performance
  if (isEditorMode()) {
    return;
  }

  try {
    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      console.warn('No session found, cannot log activity');
      return;
    }

    const userId = session.user.id;

    // Get user profile and role
    const [profileResult, roleResult] = await Promise.all([
      supabase.from('profiles').select('name').eq('id', userId).single(),
      supabase.from('user_roles').select('role').eq('user_id', userId).single()
    ]);

    const userName = profileResult.data?.name || session.user.email || 'Unknown';
    const userRole = roleResult.data?.role || 'unknown';

    // Insert activity log
    const { error } = await supabase.from('activity_logs').insert([{
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action: params.action,
      category: params.category,
      description: params.description,
      metadata: (params.metadata || {}) as unknown as Record<string, never>,
    }]);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error in logActivity:', error);
  }
}

// Helper function to format role display
export function formatUserWithRole(name: string, role: string): string {
  return `${getRoleLabel(role)} ${name}`;
}
