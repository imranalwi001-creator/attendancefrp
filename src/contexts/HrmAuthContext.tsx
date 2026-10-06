import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '@/types/hrm';
import { hrmService } from '@/services/hrmService';

import { api } from '@/services/apiClient';

interface HrmAuthContextType {
  user: UserProfile | null;
  role: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: (userId: string) => void;
  refreshUser: () => void;
}

const HrmAuthContext = createContext<HrmAuthContextType | undefined>(undefined);

const CURRENT_USER_SESSION_KEY = 'hrm_active_session_user';

export const HrmAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function initSession() {
      // 1. Pulihkan sesi pengguna secara instan dari storage (zero UI blocking)
      const saved = sessionStorage.getItem(CURRENT_USER_SESSION_KEY) || localStorage.getItem(CURRENT_USER_SESSION_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.id || parsed.nip)) {
            const users = hrmService.getUsers();
            const found = users.find((u) => u.id === parsed.id || u.nip?.toLowerCase() === parsed.nip?.toLowerCase());
            setUser(found || parsed);
          }
        } catch {
          const users = hrmService.getUsers();
          const found = users.find((u) => u.id === saved && u.isActive);
          if (found) setUser(found);
        }
      }
      // Lepaskan status loading segera agar UI tidak freeze di 'Memuat data sesi HRM...'
      setIsLoading(false);

      // 2. Lakukan sinkronisasi data dengan backend di latar belakang
      hrmService.syncWithBackend()
        .then(() => {
          const latestSaved = sessionStorage.getItem(CURRENT_USER_SESSION_KEY) || localStorage.getItem(CURRENT_USER_SESSION_KEY);
          if (latestSaved) {
            try {
              const p = JSON.parse(latestSaved);
              const freshUsers = hrmService.getUsers();
              const f = freshUsers.find((u) => u.id === p.id || u.nip?.toLowerCase() === p.nip?.toLowerCase());
              if (f) setUser(f);
            } catch {}
          }
        })
        .catch((err) => {
          console.warn('Backend sync on load warning:', err);
        });
    }

    initSession();
  }, []);

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    const currentDeviceId = hrmService.getDeviceFingerprint();
    const currentDeviceModel = hrmService.getDeviceModel();

    try {
      // 1. Authenticate with PostgreSQL Backend with Device Binding
      const res = await api.post<{ success: boolean; user?: UserProfile; error?: string }>('/auth/login', {
        identifier: identifier.trim(),
        password: pass,
        deviceId: currentDeviceId,
        deviceModel: currentDeviceModel,
      });

      if (res && res.success && res.user) {
        setUser(res.user);
        sessionStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(res.user));
        localStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(res.user));
        // Refresh local cache with latest backend state
        hrmService.syncWithBackend().catch(() => null);
        return { success: true };
      }

      return { success: false, error: res?.error || 'Email atau kata sandi tidak sesuai' };
    } catch (apiErr: any) {
      // If server explicitly returned 401 (wrong password/unregistered) or 403 (device mismatch), do not fallback
      if (apiErr.status === 401 || apiErr.status === 403) {
        return { success: false, error: apiErr.message };
      }

      console.warn('Backend login unreachable, evaluating offline fallback:', apiErr.message);
      // Fallback to in-memory user check
      const cleanId = identifier.trim().toLowerCase();
      const users = hrmService.getUsers();

      const found = users.find(
        (u) =>
          (u.email.toLowerCase() === cleanId || u.nip.toLowerCase() === cleanId) &&
          u.isActive
      );

      if (!found) {
        return { success: false, error: apiErr.message || 'Email atau NIP tidak terdaftar dalam sistem' };
      }

      if (found.password && found.password !== pass) {
        return { success: false, error: 'Kata sandi tidak sesuai' };
      }

      // Offline Multi-Device Protection (Anti Titip Akun)
      const roleName = (found.roleName || '').toLowerCase().replace(/[\s_-]/g, '');
      const isRestrictedRole = roleName === 'karyawan' || roleName === 'staff' || roleName === 'security' || roleName === 'cleaning' || roleName === 'danru';

      if (isRestrictedRole) {
        const boundDevice = found.registeredDeviceId || (found as any).deviceId;
        if (boundDevice && boundDevice !== currentDeviceId) {
          return {
            success: false,
            error: `Akses Ditolak: Akun Anda telah terkunci pada perangkat (${found.deviceModel || 'HP Karyawan Terdaftar'}). Penggunaan akun bersama dilarang untuk meminimalisir kecurangan. Silakan hubungi Superadmin / HRD jika Anda telah mengganti HP.`
          };
        }
        if (!boundDevice) {
          found.registeredDeviceId = currentDeviceId;
          (found as any).deviceId = currentDeviceId;
          found.deviceModel = currentDeviceModel;
          (found as any).isDeviceBound = true;
          (found as any).deviceBoundAt = new Date().toISOString();
          const uIdx = users.findIndex((u) => u.id === found.id);
          if (uIdx !== -1) {
            users[uIdx] = found;
            localStorage.setItem('hrm_users', JSON.stringify(users));
          }
        }
      }

      setUser(found);
      sessionStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(found));
      localStorage.setItem(CURRENT_USER_SESSION_KEY, JSON.stringify(found));
      return { success: true };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(CURRENT_USER_SESSION_KEY);
  };

  const switchUser = (userId: string) => {
    const users = hrmService.getUsers();
    const found = users.find((u) => u.id === userId);
    if (found) {
      setUser(found);
      localStorage.setItem(CURRENT_USER_SESSION_KEY, found.id);
    }
  };

  const refreshUser = () => {
    if (!user) return;
    const users = hrmService.getUsers();
    const found = users.find((u) => u.id === user.id);
    if (found) {
      setUser({ ...found });
    }
  };

  const normalizeRole = (r?: string) => {
    if (!r) return '';
    const clean = r.toLowerCase().replace(/[\s_-]/g, '');
    if (clean.includes('superadmin')) return 'superadmin';
    if (clean.includes('admin') && !clean.includes('super')) return 'admin';
    return clean;
  };

  const rawRole = user?.roleName || user?.role || (user as any)?.role_name || (user as any)?.role_code || (user as any)?.roleId || 'karyawan';
  const role = normalizeRole(rawRole);

  return (
    <HrmAuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        switchUser,
        refreshUser,
      }}
    >
      {children}
    </HrmAuthContext.Provider>
  );
};

export const useHrmAuth = () => {
  const context = useContext(HrmAuthContext);
  if (!context) {
    throw new Error('useHrmAuth must be used within an HrmAuthProvider');
  }
  return context;
};
