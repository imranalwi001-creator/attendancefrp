import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

type UserRole = 'admin' | 'guru' | 'walikelas' | 'santri' | 'orangtua' | 'Pembina' | 'staff' | 'guru_ekskul';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  workspace_id?: string;
  workspace_type?: string;
  education_level?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, meta: { name: string, workspaceType: string, educationLevel: string, institutionName: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const VALID_ROLES: UserRole[] = ['admin', 'guru', 'walikelas', 'santri', 'orangtua', 'Pembina', 'staff', 'guru_ekskul'];
const ROLE_PRIORITY: UserRole[] = ['admin', 'orangtua', 'walikelas', 'guru', 'guru_ekskul', 'Pembina', 'staff', 'santri'];
const AUTH_ROLE_CACHE_KEY = 'auth_role_cache_v1';
const AUTH_ROLE_CACHE_DURATION = 1000 * 60 * 30;
const ROLE_QUERY_TIMEOUT_MS = 3500;

// Module-level cache that survives HMR – prevents UI flicker on hot reload
let __hmrAuthCache: { user: UserProfile | null; loading: boolean } = { user: null, loading: true };

function isUserRole(role: unknown): role is UserRole {
  return typeof role === 'string' && VALID_ROLES.includes(role as UserRole);
}

function getCachedRole(userId: string): UserRole | null {
  try {
    const raw = localStorage.getItem(AUTH_ROLE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { userId: string; role: UserRole; timestamp: number };
    const isFresh = parsed.userId === userId && Date.now() - parsed.timestamp < AUTH_ROLE_CACHE_DURATION;
    return isFresh && isUserRole(parsed.role) ? parsed.role : null;
  } catch {
    return null;
  }
}

function setCachedRole(userId: string, role: UserRole) {
  try {
    localStorage.setItem(AUTH_ROLE_CACHE_KEY, JSON.stringify({ userId, role, timestamp: Date.now() }));
  } catch {
    // Ignore storage errors.
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`Auth query timeout after ${ms}ms`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function resolveRoleViaRpc(userId: string): Promise<UserRole | null> {
  for (const role of ROLE_PRIORITY) {
    const { data, error } = await supabase.rpc('has_role', {
      _user_id: userId,
      _role: role,
    });

    if (!error && data === true) return role;
  }

  return null;
}

async function fetchUserRole(userId: string, sbUser?: SupabaseUser): Promise<UserRole> {
  const cachedRole = getCachedRole(userId);
  if (cachedRole) return cachedRole;

  const metadataRole = sbUser?.user_metadata?.role || sbUser?.app_metadata?.role;
  if (isUserRole(metadataRole)) {
    setCachedRole(userId, metadataRole);
    return metadataRole;
  }

  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!error && isUserRole(data?.[0]?.role)) {
      setCachedRole(userId, data[0].role);
      return data[0].role;
    }
  } catch (error) {
    console.warn('Direct role lookup failed:', error);
  }

  const roleFromRpc = await resolveRoleViaRpc(userId);
  if (roleFromRpc) {
    setCachedRole(userId, roleFromRpc);
    return roleFromRpc;
  }

  throw new Error(`Unable to resolve role for user ${userId}`);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize from HMR cache to prevent UI flicker on hot reload
  const [user, _setUser] = useState<UserProfile | null>(__hmrAuthCache.user);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, _setLoading] = useState(__hmrAuthCache.loading);
  // Use a numeric counter to invalidate stale fetches (works better with HMR than userId-based dedup)
  const fetchGenRef = useRef(0);

  // Wrap setters to keep HMR cache in sync
  const setUser = useCallback((u: UserProfile | null) => {
    __hmrAuthCache.user = u;
    _setUser(u);
  }, []);
  const setLoading = useCallback((l: boolean) => {
    __hmrAuthCache.loading = l;
    _setLoading(l);
  }, []);

  const fetchUserProfile = useCallback(async (userId: string, sbUser: SupabaseUser) => {
    // Increment generation to invalidate any in-flight fetch
    const gen = ++fetchGenRef.current;

    const email = sbUser.email ?? '';
    const metadata = sbUser.user_metadata || {};
    const nameFromMetadata = metadata.name || metadata.full_name;
    const nameFromEmail = email ? email.split('@')[0] : 'User';
    const userName = nameFromMetadata || nameFromEmail;

    try {
      const role = await withTimeout(fetchUserRole(userId, sbUser), ROLE_QUERY_TIMEOUT_MS);

      // Fetch workspace info
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          workspace_id,
          workspaces (
            type,
            education_level
          )
        `)
        .eq('id', userId)
        .single();

      let workspaceType = 'sekolah';
      let educationLevel = 'pesantren';
      let workspaceId = undefined;

      console.log('DEBUG AUTH:', { profileData, profileError });

      if (!profileError && profileData) {
        workspaceId = profileData.workspace_id;
        // Access nested relational data (if exists)
        const wsData = profileData.workspaces;
        if (wsData) {
          workspaceType = Array.isArray(wsData) ? wsData[0]?.type : (wsData as any).type;
          educationLevel = Array.isArray(wsData) ? wsData[0]?.education_level : (wsData as any).education_level;
        }
      }

      // If a newer fetch was started, discard this result
      if (fetchGenRef.current !== gen) return;

      setUser({
        id: userId,
        name: userName,
        email,
        role,
        avatar_url: undefined,
        workspace_id: workspaceId,
        workspace_type: workspaceType,
        education_level: educationLevel
      });
    } catch (error) {
      console.error('Error fetching user role:', error);
      if (fetchGenRef.current === gen) {
        setUser(null);
      }
    } finally {
      if (fetchGenRef.current === gen) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const handleSession = (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setSupabaseUser(nextSession?.user ?? null);

      const nextUserId = nextSession?.user?.id ?? null;
      if (!nextUserId) {
        // No session — reset everything immediately
        fetchGenRef.current++;
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      void fetchUserProfile(nextUserId, nextSession.user);
    };

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      handleSession(initialSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return;
      handleSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      fetchGenRef.current++;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  const register = async (email: string, password: string, meta: { name: string, workspaceType: string, educationLevel: string, institutionName: string }): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { 
            name: meta.name,
            workspaceType: meta.workspaceType,
            educationLevel: meta.educationLevel,
            institutionName: meta.institutionName
          }
        }
      });
      
      if (error) throw error;
      
      if (data.user) {
        // Workspace, profile, dan role sudah otomatis dibuat oleh trigger database `on_auth_user_created_workspace`.
        // Cukup panggil refresh untuk memperbarui state user ke frontend.
        fetchGenRef.current++;
        await fetchUserProfile(data.user.id, data.user);
      }
      
      return { success: true };
    } catch (error: any) {
      setLoading(false);
      return { success: false, error: error.message || 'Registration failed' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.warn('SignOut warning:', error);
    }
    localStorage.removeItem(AUTH_ROLE_CACHE_KEY);
    fetchGenRef.current++;
    setUser(null);
    setSupabaseUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, supabaseUser, session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During HMR the provider reference can become stale – use the
    // module-level cache so the UI doesn't flash or get stuck on a skeleton.
    console.warn('useAuth called outside AuthProvider – returning HMR cache');
    return {
      user: __hmrAuthCache.user,
      supabaseUser: null,
      session: null,
      loading: __hmrAuthCache.loading,
      login: async () => ({ success: false, error: 'AuthProvider not mounted' } as const),
      register: async () => ({ success: false, error: 'AuthProvider not mounted' } as const),
      logout: async () => {},
    } satisfies AuthContextType;
  }
  return context;
}
