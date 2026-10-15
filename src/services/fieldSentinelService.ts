// Enterprise Field Sentinel & Dynamic Geofence Service
// Governs real-time background location tracking, flexible geofencing, and patrol spot-checks

import { api } from './apiClient';
import { UserProfile, FieldPatrolCheck } from '@/types/hrm';

export interface FieldLocationAssignment {
  userId: string;
  assignedLocationName: string;
  assignedLatitude: number;
  assignedLongitude: number;
  assignedRadiusMeters: number;
  isFieldSentinelEnabled?: boolean;
}

export interface LocationPingPayload {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  speed?: number | null;
  isMockLocation?: boolean;
}

export interface LocationPingResult {
  success: boolean;
  isOutOfBounds: boolean;
  distanceFromTarget: number;
  allowedRadius: number;
  targetLocationName: string;
  arrivedPostId?: string | null;
  arrivedPostName?: string | null;
  triggerVibration?: boolean;
  shouldPromptSelfie?: boolean;
  message?: string;
}

export interface SubmitPatrolPayload {
  userId: string;
  checkType: 'spot_check' | 'clock_in' | 'clock_out' | 'pimpinan_instruction';
  locationName: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  watermarkedPhotoUrl: string;
  biometricScore?: number;
  notes?: string;
}

export const fieldSentinelService = {
  // 1. Superadmin sets custom flexible location for a field employee
  assignFieldLocation: async (assignment: FieldLocationAssignment): Promise<UserProfile> => {
    const res = await api.post<{ success: boolean; data: UserProfile; message?: string }>(
      '/field-sentinel/assign-location',
      assignment
    );
    if (!res || !res.success || !res.data) {
      throw new Error(res?.message || 'Gagal menyimpan penugasan lokasi lapangan.');
    }
    return res.data;
  },

  // 2. Employee smartphone sends periodic background ping (every 2-3 mins during work hours)
  sendLocationPing: async (payload: LocationPingPayload): Promise<LocationPingResult> => {
    return api.post<LocationPingResult>('/field-sentinel/location-ping', payload);
  },

  // 3. Submit face scan with burned-in forensic watermark
  submitPatrolCheck: async (payload: SubmitPatrolPayload): Promise<FieldPatrolCheck> => {
    const res = await api.post<{ success: boolean; data: FieldPatrolCheck; message?: string }>(
      '/field-sentinel/submit-patrol-check',
      payload
    );
    if (!res || !res.success || !res.data) {
      throw new Error(res?.message || 'Gagal mengirimkan verifikasi patroli lapangan.');
    }
    return res.data;
  },

  // 4. Fetch all active field agents with live radar coordinates and status
  getActiveFieldAgents: async (): Promise<UserProfile[]> => {
    const res = await api.get<{ success: boolean; data: UserProfile[] }>('/field-sentinel/active-agents');
    return res?.data || [];
  },

  getActiveAgents: async (): Promise<UserProfile[]> => {
    return fieldSentinelService.getActiveFieldAgents();
  },

  // 5. Fetch patrol check history for a user or all users
  getPatrolChecks: async (userId?: string): Promise<FieldPatrolCheck[]> => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await api.get<{ success: boolean; data: FieldPatrolCheck[] }>(`/field-sentinel/patrol-checks${query}`);
    return res?.data || [];
  },

  // 6. Pimpinan / Superadmin sends urgent spot-check instruction to employee
  requestSpotCheck: async (userId: string, instructionNotes?: string): Promise<boolean> => {
    const res = await api.post<{ success: boolean; message?: string }>('/field-sentinel/request-spot-check', {
      userId,
      instructionNotes,
    });
    return res?.success === true;
  },

  // 7. Multi-Titik / Bank Pos Lapangan: Fetch all saved posts for an employee
  getFieldPosts: async (userId?: string): Promise<import('@/types/hrm').FieldAssignedPost[]> => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await api.get<{ success: boolean; data: any[] }>(
      `/field-sentinel/posts${query}`
    );
    const rawData = res?.data || [];
    return rawData.map((p: any) => ({
      id: p.id,
      userId: p.userId || p.user_id,
      postCode: p.postCode || p.post_code,
      postName: p.postName || p.post_name,
      latitude: parseFloat(p.latitude),
      longitude: parseFloat(p.longitude),
      radiusMeters: parseFloat(p.radiusMeters || p.radius_meters || 100),
      description: p.description || p.notes || '',
      isActive: p.isActive !== false && p.is_active !== false,
      isRelief: p.isRelief === true || p.is_relief === true,
      reliefUntil: p.reliefUntil || p.relief_until,
      reliefOriginalUserId: p.reliefOriginalUserId || p.relief_original_user_id,
      reliefOriginalUserName: p.reliefOriginalUserName || p.relief_original_user_name,
      reliefOriginalUserNip: p.reliefOriginalUserNip || p.relief_original_user_nip,
      createdAt: p.createdAt || p.created_at,
      updatedAt: p.updatedAt || p.updated_at,
    }));
  },

  // 7b. Smart Relief Vacancy Recommendations (4 Tiers)
  getSmartReliefRecommendations: async (params: {
    applicantId?: string;
    userId?: string;
    originalUserId?: string;
    startDate?: string;
    endDate?: string;
    divisionId?: string;
    shiftId?: string;
  }): Promise<{
    allRanked: import('@/types/hrm').SmartReliefCandidate[];
    offDutyList: import('@/types/hrm').SmartReliefCandidate[];
    differentShiftList: import('@/types/hrm').SmartReliefCandidate[];
    extendedShiftList: import('@/types/hrm').SmartReliefCandidate[];
    shiftTransitionList: import('@/types/hrm').SmartReliefCandidate[];
    total: number;
    applicantPosts?: any[];
  }> => {
    const q = new URLSearchParams();
    if (params.applicantId) q.set('applicantId', params.applicantId);
    if (params.userId) q.set('userId', params.userId);
    if (params.originalUserId) q.set('originalUserId', params.originalUserId);
    if (params.startDate) q.set('startDate', params.startDate);
    if (params.endDate) q.set('endDate', params.endDate);
    if (params.divisionId) q.set('divisionId', params.divisionId);
    if (params.shiftId) q.set('shiftId', params.shiftId);

    const res = await api.get<{
      success: boolean;
      data: {
        allRanked: import('@/types/hrm').SmartReliefCandidate[];
        offDutyList: import('@/types/hrm').SmartReliefCandidate[];
        differentShiftList: import('@/types/hrm').SmartReliefCandidate[];
        extendedShiftList: import('@/types/hrm').SmartReliefCandidate[];
        shiftTransitionList: import('@/types/hrm').SmartReliefCandidate[];
        total: number;
        applicantPosts?: any[];
      };
    }>(`/hrm/relief/recommendations?${q.toString()}`);
    return res?.data || {
      allRanked: [],
      offDutyList: [],
      differentShiftList: [],
      extendedShiftList: [],
      shiftTransitionList: [],
      total: 0
    };
  },

  // 7c. Penetapan Pengganti Pos Resmi & Pewarisan Geofence Otomatis
  assignReliefSubstitute: async (payload: {
    leaveId?: string;
    originalUserId: string;
    reliefUserId: string;
    startDate?: string;
    endDate?: string;
    notes?: string;
    adminId?: string;
    adminName?: string;
  }): Promise<{ success: boolean; injectedPosts?: any[]; substitution?: any; overtimeRecord?: any }> => {
    const res = await api.post<{ success: boolean; injectedPosts?: any[]; substitution?: any; overtimeRecord?: any }>(
      '/hrm/relief/assign',
      payload
    );
    if (!res || !res.success) {
      throw new Error('Gagal menetapkan pengganti pos resmi.');
    }
    return res;
  },

  // 7d. Verifikasi Lembur Darurat Pasca-Shift (1-Klik Korlap/Admin)
  verifyEmergencyOvertime: async (
    id: string,
    action: 'approve' | 'reject',
    approverId?: string,
    approverName?: string,
    notes?: string
  ): Promise<{ success: boolean; message?: string }> => {
    const res = await api.post<{ success: boolean; message?: string }>(
      `/hrm/overtime/emergency-verify/${id}`,
      { action, approverId, approverName, notes }
    );
    return res || { success: false };
  },

  // 8. Multi-Titik / Bank Pos Lapangan: Create or update a post in the bank
  saveFieldPost: async (postData: {
    id?: string;
    userId: string;
    postCode: string;
    postName: string;
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    description?: string;
    copyToAllFieldAgents?: boolean;
  }): Promise<import('@/types/hrm').FieldAssignedPost> => {
    const res = await api.post<{ success: boolean; data: import('@/types/hrm').FieldAssignedPost; message?: string }>(
      '/field-sentinel/posts',
      postData
    );
    if (!res || !res.success || !res.data) {
      throw new Error(res?.message || 'Gagal menyimpan pos ke Bank Titik Lapangan.');
    }
    return res.data;
  },

  // 9. Multi-Titik / Bank Pos Lapangan: Delete a post
  deleteFieldPost: async (id: string): Promise<boolean> => {
    const res = await api.delete<{ success: boolean; message?: string }>(`/field-sentinel/posts/${id}`);
    return res?.success === true;
  },

  // 10. Check if there is an active spot check requested for this employee
  getSpotCheckStatus: async (userId: string): Promise<{ requested: boolean; requestedAt?: string; notes?: string }> => {
    try {
      const res = await api.get<{ success: boolean; requested: boolean; requestedAt?: string; notes?: string }>(
        `/field-sentinel/spot-check-status/${encodeURIComponent(userId)}`
      );
      if (res && res.success) {
        return {
          requested: res.requested === true,
          requestedAt: res.requestedAt,
          notes: res.notes,
        };
      }
      return { requested: false };
    } catch {
      return { requested: false };
    }
  },

  // 11. Superadmin sets custom work hours (Jam Masuk, Jam Pulang, Toleransi) for Field Sentinel Officers
  setWorkHours: async (payload: {
    userId?: string;
    startTime: string;
    endTime: string;
    lateToleranceMinutes?: number;
    applyToAllThree?: boolean;
  }): Promise<{ success: boolean; message: string; data?: any }> => {
    const res = await api.post<{ success: boolean; message: string; data?: any }>(
      '/field-sentinel/set-work-hours',
      payload
    );
    if (!res || !res.success) {
      throw new Error(res?.message || 'Gagal menyimpan jam kerja khusus.');
    }
    return res;
  },
};
