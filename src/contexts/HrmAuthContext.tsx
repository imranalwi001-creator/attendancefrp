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
    async function initSession() {
      try {
        await hrmService.syncWithBackend();
      } catch (err) {
        console.warn('Backend sync on load warning:', err);
      }

      const saved = sessionStorage.getItem(CURRENT_USER_SESSION_KEY) || localStorage.getItem(CURRENT_USER_SESSION_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.id || parsed.nip)) {
            const users = hrmService.getUsers();
            const found = users.find((u) => u.id === parsed.id || u.nip.toLowerCase() === parsed.nip?.toLowerCase());
            setUser(found || parsed);
          }
        } catch {
          const users = hrmService.getUsers();
          const found = users.find((u) => u.id === saved && u.isActive);
          if (found) setUser(found);
        }
      }
      setIsLoading(false);
    }

    initSession();
  }, []);

  const login = async (identifier: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Authenticate with PostgreSQL Backend
      const res = await api.post<{ success: boolean; user?: UserProfile; error?: string }>('/auth/login', {
        identifier,
        password: pass,
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
      console.warn('Backend login error, checking fallback:', apiErr.message);
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

  const role = normalizeRole(user?.roleName);

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
