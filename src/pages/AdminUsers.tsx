import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { ListCard } from '@/components/ui/list-card';
import { mockMapel } from '@/mocks/data';
import { Plus, MoreVertical, Edit, Trash2, Users, GraduationCap, UserCog, Search, Eye, FileSpreadsheet, FileText, Lock, Loader2, User as UserIcon, ShieldAlert, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminUsersSkeleton } from '@/components/skeletons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import useSessionStorageState from '@/hooks/useSessionStorageState';
import UserForm from '@/components/admin/UserForm';
import SantriQuickAddForm from '@/components/admin/SantriQuickAddForm';
import ImportSantriModal from '@/components/admin/ImportSantriModal';
import ImportStaffModal from '@/components/admin/ImportStaffModal';
import ParentForm from '@/components/admin/ParentForm';
import DataExportPanel from '@/components/ui/data-export-panel';
import { useAuth } from '@/contexts/AuthContext';
import { User, Kelas } from '@/types';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToPdf, exportToXlsx, type DataExportColumn } from '@/lib/dataExport';

export default function AdminUsers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [santriQuickFormOpen, setSantriQuickFormOpen] = useState(false);
  const [importSantriOpen, setImportSantriOpen] = useSessionStorageState('adminUsersImportSantriOpen', false);
  const [importStaffOpen, setImportStaffOpen] = useSessionStorageState('adminUsersImportStaffOpen', false);
  const [parentFormOpen, setParentFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingParent, setEditingParent] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [santriSearchQuery, setSantriSearchQuery] = useState('');
  const [santriKelasFilter, setSantriKelasFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [staffCurrentPage, setStaffCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem('adminUsersActiveTab') || 'staff';
  });
  const itemsPerPage = 10;
  const { toast } = useToast();
  const { user } = useAuth();

  // Debounce search queries to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 400);
  const debouncedSantriSearchQuery = useDebounce(santriSearchQuery, 400);

  // Server-side pagination for staff users
  const {
    data: staffQueryData,
    isLoading: loadingStaff,
    isFetching: fetchingStaff
  } = useQuery({
    queryKey: ['admin-users-staff', staffCurrentPage, debouncedSearchQuery, roleFilter],
    queryFn: async () => {
      const ITEMS_PER_PAGE = 10;
      const offset = (staffCurrentPage - 1) * ITEMS_PER_PAGE;
      
      // Get staff role user IDs first
      const { data: staffRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul']);
      
      if (rolesError) throw rolesError;
      const staffUserIds = staffRoles?.map(r => r.user_id) || [];
      if (staffUserIds.length === 0) return { users: [], total: 0, roles: [] };
      
      // Build profile query with filters
      let profileQuery = supabase
        .from('profiles')
        .select('id, name, email, status, avatar_url, phone, created_at', { count: 'exact' })
        .in('id', staffUserIds);
      
      if (user?.workspace_id) {
        profileQuery = profileQuery.eq('workspace_id', user.workspace_id);
      }
      
      // Apply search filter
      if (debouncedSearchQuery) {
        profileQuery = profileQuery.or(`name.ilike.%${debouncedSearchQuery}%,email.ilike.%${debouncedSearchQuery}%`);
      }
      
      // Apply role filter client-side since we need to filter by role
      const filteredUserIds = roleFilter === 'all' 
        ? staffUserIds 
        : staffRoles?.filter(r => r.role === roleFilter).map(r => r.user_id) || [];
      
      if (filteredUserIds.length === 0) return { users: [], total: 0, roles: staffRoles || [] };
      
      profileQuery = supabase
        .from('profiles')
        .select('id, name, email, status, avatar_url, phone, created_at', { count: 'exact' })
        .in('id', filteredUserIds);
      
      if (user?.workspace_id) {
        profileQuery = profileQuery.eq('workspace_id', user.workspace_id);
      }
      
      if (debouncedSearchQuery) {
        profileQuery = profileQuery.or(`name.ilike.%${debouncedSearchQuery}%,email.ilike.%${debouncedSearchQuery}%`);
      }
      
      profileQuery = profileQuery.order('name').range(offset, offset + ITEMS_PER_PAGE - 1);
      
      const { data: profiles, count, error: profilesError } = await profileQuery;
      if (profilesError) throw profilesError;
      
      // Fetch staff details for current page only
      const pageUserIds = profiles?.map(p => p.id) || [];
      const { data: staffData } = pageUserIds.length > 0 
        ? await supabase.from('staff').select('id, kelas_id, employee_id').in('id', pageUserIds)
        : { data: [] };
      
      const usersData: User[] = (profiles || []).map(profile => {
        const roleData = staffRoles?.find(r => r.user_id === profile.id);
        const staff = staffData?.find(s => s.id === profile.id);
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email || '',
          role: roleData?.role || 'staff',
          status: profile.status,
          createdAt: profile.created_at,
          phone: profile.phone,
          avatar: profile.avatar_url,
          kelasId: staff?.kelas_id,
          employeeId: staff?.employee_id
        };
      });
      
      return { users: usersData, total: count || 0, roles: staffRoles || [] };
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  });

  // Server-side pagination for santri users
  const {
    data: santriQueryData,
    isLoading: loadingSantri,
    isFetching: fetchingSantri
  } = useQuery({
    queryKey: ['admin-users-santri', currentPage, debouncedSantriSearchQuery, santriKelasFilter],
    queryFn: async () => {
      const ITEMS_PER_PAGE = 10;
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      
      // Build santri query with filters
      let santriQuery = supabase
        .from('santri')
        .select('id, kelas_id, nis, birth_date, address, previous_school, child_order, blood_type, medical_history, allergy_history, height, weight, social_type, peer_reaction', { count: 'exact' });
      
      if (santriKelasFilter !== 'all') {
        santriQuery = santriQuery.eq('kelas_id', santriKelasFilter);
      }
      if (user?.workspace_id) {
        santriQuery = santriQuery.eq('workspace_id', user.workspace_id);
      }
      
      const { data: allSantri, count: totalSantri, error: santriError } = await santriQuery;
      if (santriError) throw santriError;
      
      const santriIds = allSantri?.map(s => s.id) || [];
      if (santriIds.length === 0) return { users: [], total: 0 };
      
      // Build profile query with search and pagination
      let profileQuery = supabase
        .from('profiles')
        .select('id, name, email, status, avatar_url, phone, created_at', { count: 'exact' })
        .in('id', santriIds);
      
      if (debouncedSantriSearchQuery) {
        profileQuery = profileQuery.or(`name.ilike.%${debouncedSantriSearchQuery}%,email.ilike.%${debouncedSantriSearchQuery}%`);
      }
      
      // Get filtered count first
      const { count: filteredCount } = await profileQuery;
      
      // Then paginate
      profileQuery = supabase
        .from('profiles')
        .select('id, name, email, status, avatar_url, phone, created_at')
        .in('id', santriIds);
      
      if (debouncedSantriSearchQuery) {
        profileQuery = profileQuery.or(`name.ilike.%${debouncedSantriSearchQuery}%,email.ilike.%${debouncedSantriSearchQuery}%`);
      }
      
      profileQuery = profileQuery.order('name').range(offset, offset + ITEMS_PER_PAGE - 1);
      
      const { data: profiles, error: profilesError } = await profileQuery;
      if (profilesError) throw profilesError;
      
      const usersData: User[] = (profiles || []).map(profile => {
        const santri = allSantri?.find(s => s.id === profile.id);
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email || '',
          role: 'santri' as const,
          status: profile.status,
          createdAt: profile.created_at,
          phone: profile.phone,
          avatar: profile.avatar_url,
          kelasId: santri?.kelas_id,
          nis: santri?.nis,
          birthDate: santri?.birth_date,
          address: santri?.address,
          previousSchool: santri?.previous_school,
          childOrder: santri?.child_order,
          bloodType: santri?.blood_type,
          medicalHistory: santri?.medical_history,
          allergyHistory: santri?.allergy_history,
          height: santri?.height,
          weight: santri?.weight,
          socialType: santri?.social_type as 'periang' | 'minder' | 'tenang' | undefined,
          peerReaction: santri?.peer_reaction as 'aktif' | 'pasif' | undefined
        };
      });
      
      return { users: usersData, total: filteredCount || 0 };
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev
  });

  // Fetch orangtua with pagination
  const {
    data: orangtuaQueryData,
    isLoading: loadingOrangtua
  } = useQuery({
    queryKey: ['admin-users-orangtua'],
    queryFn: async () => {
      // Get orangtua role user IDs
      const { data: orangtuaRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'orangtua');
      
      if (rolesError) throw rolesError;
      const orangtuaUserIds = orangtuaRoles?.map(r => r.user_id) || [];
      if (orangtuaUserIds.length === 0) return { users: [], total: 0 };
      
      let profilesQuery = supabase
        .from('profiles')
        .select('id, name, email, status, avatar_url, phone, created_at')
        .in('id', orangtuaUserIds)
        .order('name')
        .limit(50);
        
      if (user?.workspace_id) {
        profilesQuery = profilesQuery.eq('workspace_id', user.workspace_id);
      }
      
      const { data: profiles, error: profilesError } = await profilesQuery;
      
      if (profilesError) throw profilesError;
      
      const pageUserIds = profiles?.map(p => p.id) || [];
      
      // Fetch orangtua details
      const [{ data: orangtuaData }, { data: parentChildren }] = await Promise.all([
        pageUserIds.length > 0 
          ? supabase.from('orangtua').select('id, relationship, notes').in('id', pageUserIds)
          : { data: [] },
        pageUserIds.length > 0 
          ? supabase.from('parent_children').select('parent_id, child_id').in('parent_id', pageUserIds)
          : { data: [] }
      ]);
      
      const usersData: User[] = (profiles || []).map(profile => {
        const orangtua = orangtuaData?.find(o => o.id === profile.id);
        const children = parentChildren?.filter(pc => pc.parent_id === profile.id) || [];
        return {
          id: profile.id,
          name: profile.name,
          email: profile.email || '',
          role: 'orangtua' as const,
          status: profile.status,
          createdAt: profile.created_at,
          phone: profile.phone,
          avatar: profile.avatar_url,
          relationship: orangtua?.relationship as 'ayah' | 'ibu' | 'wali' | undefined,
          notes: orangtua?.notes,
          childrenIds: children.map(c => c.child_id)
        };
      });
      
      return { users: usersData, total: orangtuaUserIds.length };
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  // Combined loading state - only for initial load, not search refetches
  const loading = loadingStaff || loadingSantri || loadingOrangtua;
  const isSearching = (fetchingStaff && !loadingStaff) || (fetchingSantri && !loadingSantri);

  // Extract data from queries
  const staffUsers = staffQueryData?.users || [];
  const staffTotalPages = Math.ceil((staffQueryData?.total || 0) / itemsPerPage);
  const paginatedStaffUsers = staffUsers;
  
  const allSantriUsers = santriQueryData?.users || [];
  const filteredSantriUsers = allSantriUsers;
  const totalPages = Math.ceil((santriQueryData?.total || 0) / itemsPerPage);
  const paginatedSantriUsers = allSantriUsers;
  
  const orangtuaUsers = orangtuaQueryData?.users || [];

  // Combined users for shared operations (like delete lookup)
  const users = [...staffUsers, ...allSantriUsers, ...orangtuaUsers];

  type UserExportRow = {
    no: number;
    nama: string;
    email: string;
    role: string;
    kelas: string;
    nomorInduk: string;
    phone: string;
    status: string;
    dibuat: string;
  };

  const userExportColumns: DataExportColumn<UserExportRow>[] = [
    { header: 'No', accessor: 'no', width: 6 },
    { header: 'Nama', accessor: 'nama', width: 28 },
    { header: 'Email', accessor: 'email', width: 30 },
    { header: 'Role', accessor: 'role', width: 16 },
    { header: 'Kelas', accessor: 'kelas', width: 18 },
    { header: 'NIP/NIS', accessor: 'nomorInduk', width: 18 },
    { header: 'Telepon', accessor: 'phone', width: 18 },
    { header: 'Status', accessor: 'status', width: 12 },
    { header: 'Dibuat', accessor: 'dibuat', width: 18 },
  ];

  const getActiveUserExportLabel = () => {
    if (activeTab === 'staff') return 'Staff dan Guru';
    if (activeTab === 'santri') return 'Santri';
    return 'Orang Tua';
  };

  const getActiveUserExportCount = () => {
    if (activeTab === 'staff') return staffQueryData?.total || 0;
    if (activeTab === 'santri') return santriQueryData?.total || 0;
    return orangtuaQueryData?.total || 0;
  };

  const fetchUserExportRows = async (): Promise<UserExportRow[]> => {
    const roleGroup = activeTab === 'staff'
      ? ['admin', 'guru', 'walikelas', 'Pembina', 'staff', 'guru_ekskul']
      : [activeTab];

    let rolesQuery = supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', roleGroup as any);

    if (activeTab === 'staff' && roleFilter !== 'all') {
      rolesQuery = supabase.from('user_roles').select('user_id, role').eq('role', roleFilter as any);
    }

    const { data: roleRows, error: roleError } = await rolesQuery;
    if (roleError) throw roleError;
    const userIds = (roleRows || []).map(row => row.user_id);
    if (userIds.length === 0) return [];

    let profileQuery = supabase
      .from('profiles')
      .select('id, name, email, status, phone, created_at')
      .in('id', userIds)
      .order('name');
      
    if (user?.workspace_id) {
      profileQuery = profileQuery.eq('workspace_id', user.workspace_id);
    }

    const activeSearch = activeTab === 'santri' ? debouncedSantriSearchQuery : debouncedSearchQuery;
    if (activeSearch) {
      profileQuery = profileQuery.or(`name.ilike.%${activeSearch}%,email.ilike.%${activeSearch}%`);
    }

    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) throw profileError;
    const visibleIds = (profiles || []).map(profile => profile.id);

    const [{ data: staffRows }, { data: santriRows }, { data: orangtuaRows }] = await Promise.all([
      visibleIds.length > 0 ? supabase.from('staff').select('id, employee_id, kelas_id').in('id', visibleIds) : Promise.resolve({ data: [] as any[] }),
      visibleIds.length > 0 ? supabase.from('santri').select('id, nis, kelas_id').in('id', visibleIds) : Promise.resolve({ data: [] as any[] }),
      visibleIds.length > 0 ? supabase.from('orangtua').select('id, relationship').in('id', visibleIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const filteredProfiles = activeTab === 'santri' && santriKelasFilter !== 'all'
      ? (profiles || []).filter(profile => santriRows?.some(row => row.id === profile.id && row.kelas_id === santriKelasFilter))
      : (profiles || []);

    return filteredProfiles.map((profile, index) => {
      const role = roleRows?.find(row => row.user_id === profile.id)?.role || activeTab;
      const staff = staffRows?.find(row => row.id === profile.id);
      const santri = santriRows?.find(row => row.id === profile.id);
      const orangtua = orangtuaRows?.find(row => row.id === profile.id);
      const kelasId = santri?.kelas_id || staff?.kelas_id;
      const kelas = kelasList.find(item => item.id === kelasId)?.nama || '-';
      return {
        no: index + 1,
        nama: profile.name || '-',
        email: profile.email || '-',
        role: role === 'orangtua' && orangtua?.relationship ? `${getRoleLabel(role)} (${orangtua.relationship})` : getRoleLabel(role),
        kelas,
        nomorInduk: santri?.nis || staff?.employee_id || '-',
        phone: profile.phone || '-',
        status: profile.status || '-',
        dibuat: profile.created_at ? new Date(profile.created_at).toLocaleDateString('id-ID') : '-',
      };
    });
  };

  const handleExportUsers = async (format: 'xlsx' | 'pdf') => {
    const rows = await fetchUserExportRows();
    const label = getActiveUserExportLabel();
    const options = {
      title: `Data ${label}`,
      subtitle: activeTab === 'santri' && santriKelasFilter !== 'all'
        ? `Kelas: ${kelasList.find(k => k.id === santriKelasFilter)?.nama || '-'}`
        : `Filter: ${activeTab === 'staff' && roleFilter !== 'all' ? getRoleLabel(roleFilter) : 'Semua'}`,
      filename: `data-user-${activeTab}`,
      sheetName: `Data ${label}`.slice(0, 31),
      columns: userExportColumns,
      rows,
      summary: [
        ['Total User', rows.length],
        ['Status Aktif', rows.filter(row => row.status === 'aktif').length],
      ] as Array<[string, string | number]>,
    };
    if (format === 'xlsx') await exportToXlsx(options);
    else await exportToPdf(options);
    toast({ title: 'Export berhasil', description: `Data ${label.toLowerCase()} berhasil diexport ke ${format.toUpperCase()}` });
  };

  // Fetch kelas with React Query - OPTIMIZED
  const {
    data: kelasList = []
  } = useQuery({
    queryKey: ['admin-kelas-list', user?.workspace_id],
    queryFn: async () => {
      let query = supabase.from('kelas').select('id, nama, tingkat, tahun_ajaran, status, jumlah_santri, walikelas_id').order('tingkat', {
        ascending: true
      }).limit(100);
      
      if (user?.workspace_id) {
        query = query.eq('workspace_id', user.workspace_id);
      }
      
      const {
        data,
        error
      } = await query;
      if (error) throw error;
      return (data || []).map((k): Kelas => ({
        id: k.id,
        nama: k.nama,
        tingkat: k.tingkat,
        tahun_ajaran: k.tahun_ajaran,
        waliKelasId: k.walikelas_id,
        jumlahSantri: k.jumlah_santri,
        tahunAjaran: k.tahun_ajaran,
        status: k.status as 'aktif' | 'nonaktif' | undefined
      }));
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
    refetchOnWindowFocus: false,
    refetchInterval: false
  });
  const refetchUsers = () => {
    queryClient.invalidateQueries({
      queryKey: ['admin-users-staff']
    });
    queryClient.invalidateQueries({
      queryKey: ['admin-users-santri']
    });
    queryClient.invalidateQueries({
      queryKey: ['admin-users-orangtua']
    });
  };
  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    
    // Validate password is entered
    if (!deletePassword.trim()) {
      setDeleteError('Password harus diisi');
      return;
    }

    setDeleteLoading(true);
    setDeleteError('');

    try {
      // Get current user email
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser?.email) {
        throw new Error('Tidak dapat mengambil informasi pengguna');
      }

      // Verify password by attempting to sign in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: currentUser.email,
        password: deletePassword
      });

      if (authError) {
        setDeleteError('Password salah');
        setDeleteLoading(false);
        return;
      }

      // Password verified, proceed with deletion
      const { error } = await supabase.rpc('delete_user_cascade' as any, {
        user_id_to_delete: deleteUserId
      });
      if (error) throw error;
      
      toast({
        title: "Pengguna Dihapus",
        description: "Pengguna telah dihapus."
      });
      refetchUsers();
      setDeleteUserId(null);
      setDeletePassword('');
      setDeleteError('');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus pengguna",
        variant: "destructive"
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteUserId(null);
    setDeletePassword('');
    setDeleteError('');
  };
  const handleSaveUser = async (userData: Partial<User>) => {
    try {
      if (!userData.id) {
        // Create new user via edge function
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: userData.email,
            password: 'Password123!',
            // Default password, user should change it
            name: userData.name,
            role: userData.role || 'guru',
            phone: userData.phone
          }
        });
        if (response.error) {
          let msg = response.error.message || 'Gagal membuat pengguna';
          const ctx = (response.error as any)?.context;
          if (ctx) {
            const raw = await ctx.text();
            try {
              const parsed = JSON.parse(raw);
              msg = parsed?.error || parsed?.message || msg;
            } catch {
              msg = raw || msg;
            }
          }
          throw new Error(msg);
        }
        if (response.data?.error) {
          throw new Error(response.data.error);
        }
        toast({
          title: "Berhasil",
          description: `Pengguna ${userData.name} berhasil ditambahkan dengan password default: Password123!`
        });
        refetchUsers();
        setUserFormOpen(false);
        return;
      }

      // Update profile
      const {
        error: profileError
      } = await supabase.from('profiles').update({
        name: userData.name,
        email: userData.email,
        status: userData.status || 'aktif'
      }).eq('id', userData.id);
      if (profileError) throw profileError;

      // Update role if changed
      if (userData.role) {
        const {
          error: roleError
        } = await supabase.from('user_roles').update({
          role: userData.role
        }).eq('user_id', userData.id);
        if (roleError) throw roleError;
      }
      toast({
        title: "Berhasil",
        description: "Data pengguna berhasil diperbarui"
      });
      refetchUsers();
      setUserFormOpen(false);
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan data pengguna",
        variant: "destructive"
      });
    }
  };
  const handleSaveParent = async (parentData: Partial<User>) => {
    try {
      let userId = parentData.id;
      if (!userId) {
        // Create new parent user via edge function
        const response = await supabase.functions.invoke('create-user', {
          body: {
            email: parentData.email,
            password: 'Password123!',
            name: parentData.name,
            role: 'orangtua',
            phone: parentData.phone
          }
        });
        if (response.error) {
          throw new Error(response.error.message || 'Gagal membuat pengguna');
        }
        if (response.data?.error) {
          throw new Error(response.data.error);
        }
        userId = response.data?.user?.id;
        if (!userId) {
          throw new Error('User ID tidak ditemukan dari response');
        }
      } else {
        // Update existing profile
        const {
          error: profileError
        } = await supabase.from('profiles').update({
          name: parentData.name,
          email: parentData.email,
          phone: parentData.phone,
          status: parentData.status || 'aktif'
        }).eq('id', userId);
        if (profileError) throw profileError;
      }

      // Upsert to orangtua table
      const {
        error: orangtuaError
      } = await supabase.from('orangtua').upsert({
        id: userId,
        relationship: parentData.relationship || null,
        notes: parentData.notes || null
      }, {
        onConflict: 'id'
      });
      if (orangtuaError) {
        console.error('Error saving orangtua:', orangtuaError);
        throw orangtuaError;
      }

      // Delete existing parent_children relations
      const {
        error: deleteError
      } = await supabase.from('parent_children').delete().eq('parent_id', userId);
      if (deleteError) {
        console.error('Error deleting parent_children:', deleteError);
      }

      // Insert new parent_children relations
      if (parentData.childrenIds && parentData.childrenIds.length > 0) {
        const childRelations = parentData.childrenIds.map(childId => ({
          parent_id: userId!,
          child_id: childId
        }));
        const {
          error: insertError
        } = await supabase.from('parent_children').insert(childRelations);
        if (insertError) {
          console.error('Error inserting parent_children:', insertError);
          throw insertError;
        }
      }
      toast({
        title: "Berhasil",
        description: parentData.id ? "Data orang tua berhasil diperbarui" : `Orang tua ${parentData.name} berhasil ditambahkan dengan password default: Password123!`
      });
      refetchUsers();
      setParentFormOpen(false);
      setEditingParent(null);
    } catch (error: any) {
      console.error('Error saving parent:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal menyimpan data orang tua",
        variant: "destructive"
      });
    }
  };
  const handleAddParent = () => {
    setEditingParent(null);
    setParentFormOpen(true);
  };
  const handleEditParent = (parent: User) => {
    setEditingParent(parent);
    setParentFormOpen(true);
  };
  const handleToggleParentStatus = async (parentId: string) => {
    const parent = users.find(u => u.id === parentId);
    if (parent) {
      try {
        const newStatus = parent.status === 'aktif' ? 'nonaktif' : 'aktif';
        const {
          error
        } = await supabase.from('profiles').update({
          status: newStatus
        }).eq('id', parentId);
        if (error) throw error;
        toast({
          title: "Status Diubah",
          description: `Akun ${parent.name} telah ${newStatus === 'nonaktif' ? 'dinonaktifkan' : 'diaktifkan'}.`
        });
        refetchUsers();
      } catch (error) {
        console.error('Error toggling status:', error);
        toast({
          title: "Error",
          description: "Gagal mengubah status akun",
          variant: "destructive"
        });
      }
    }
  };
  const handleAddUser = () => {
    setEditingUser(null);
    setUserFormOpen(true);
  };
  const handleViewUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user?.role === 'orangtua') {
      navigate(`/admin/parents/${userId}`);
    } else {
      navigate(`/admin/users/${userId}`);
    }
  };
  const getRoleLabel = (role: string | undefined) => {
    const labels: Record<string, string> = {
      admin: 'Administrator',
      guru: 'Guru / Wali Kelas',
      walikelas: 'Wali Kelas',
      santri: 'Santri',
      orangtua: 'Orang Tua',
      Pembina: 'Pembina',
      staff: 'Staff'
    };
    return labels[role || ''] || role;
  };
  const getRoleBadgeVariant = (role: string | undefined) => {
    const variants: Record<string, any> = {
      admin: 'role-admin',
      guru: 'role-guru',
      walikelas: 'role-walikelas',
      santri: 'role-santri',
      orangtua: 'role-orangtua',
      Pembina: 'role-pembina',
      staff: 'role-staff'
    };
    return variants[role || ''] || 'outline';
  };
  const renderUserTable = (usersList: User[], totalCount: number) => (
    <div className="space-y-3 lg:space-y-4 px-3 lg:px-4 py-3 lg:py-4">
      {/* Filter pencarian dan role - Sticky on mobile */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-3 px-3 py-2 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:bg-transparent lg:backdrop-blur-none">
        <div className="flex flex-row gap-2 lg:gap-3">
          <div className="relative flex-1">
            {fetchingStaff ? (
              <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input placeholder="Cari nama atau email..." value={searchQuery} onChange={e => {
              setSearchQuery(e.target.value);
              setStaffCurrentPage(1);
            }} className="pl-9 h-9 lg:h-10 rounded-xl text-sm" />
          </div>
          <Select value={roleFilter} onValueChange={value => {
            setRoleFilter(value);
            setStaffCurrentPage(1);
          }}>
            <SelectTrigger className="w-[100px] sm:w-[200px] h-9 lg:h-10 rounded-xl shrink-0">
              <SelectValue placeholder="Peran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Peran</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="guru">Guru</SelectItem>
              <SelectItem value="walikelas">Wali Kelas</SelectItem>
              <SelectItem value="guru_ekskul">Guru Ekskul</SelectItem>
              <SelectItem value="Pembina">Pembina</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Vertical List with Grid Row layout */}
      {usersList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Tidak ada data staff ditemukan
        </div>
      ) : (
        <div className="flex flex-col gap-2 lg:gap-3">
          {usersList.map(user => (
            <div
              key={user.id}
              onClick={() => handleViewUser(user.id)}
              className="bg-card border border-border/50 rounded-xl p-2.5 lg:p-4 hover:bg-muted/30 hover:border-border transition-all duration-200 cursor-pointer"
            >
              {/* Mobile: Compact stacked layout */}
              <div className="flex flex-col gap-2 lg:hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <UserIcon className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      variant="action-detail" 
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleViewUser(user.id); }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="action-delete" 
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setDeleteUserId(user.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px] font-medium px-2 py-0.5">
                    {getRoleLabel(user.role)}
                  </Badge>
                  {user.employeeId && (
                    <span className="text-[10px] text-muted-foreground">
                      NIP: {user.employeeId}
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop: CSS Grid Row layout */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                {/* Col-span-5: Avatar + Name + Email */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email || '-'}</p>
                  </div>
                </div>

                {/* Col-span-3: Role Badge */}
                <div className="col-span-3">
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Role</p>
                  <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs font-medium px-2.5 py-0.5">
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>

                {/* Col-span-2: NIP */}
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">NIP</p>
                  <p className="text-sm font-medium text-foreground/80 truncate">{user.employeeId || '-'}</p>
                </div>

                {/* Col-span-2: Action Buttons */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Button 
                    variant="action-detail" 
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); handleViewUser(user.id); }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="action-delete" 
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); setDeleteUserId(user.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {staffTotalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Menampilkan {((staffCurrentPage - 1) * itemsPerPage) + 1}-{Math.min(staffCurrentPage * itemsPerPage, staffQueryData?.total || 0)} dari {staffQueryData?.total || 0} staff
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setStaffCurrentPage(prev => Math.max(1, prev - 1))} 
                  className={staffCurrentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} 
                />
              </PaginationItem>
              
              {Array.from({ length: staffTotalPages }, (_, i) => i + 1).map(page => {
                if (page === 1 || page === staffTotalPages || (page >= staffCurrentPage - 1 && page <= staffCurrentPage + 1)) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink 
                        onClick={() => setStaffCurrentPage(page)} 
                        isActive={staffCurrentPage === page} 
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (page === staffCurrentPage - 2 || page === staffCurrentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setStaffCurrentPage(prev => Math.min(staffTotalPages, prev + 1))} 
                  className={staffCurrentPage === staffTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} 
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
  const renderSantriTable = (usersList: User[]) => (
    <div className="space-y-3 lg:space-y-4 px-3 lg:px-4 py-3 lg:py-4">
      {/* Filter pencarian - Sticky on mobile */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-3 px-3 py-2 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:bg-transparent lg:backdrop-blur-none">
        <div className="flex flex-row gap-2 lg:gap-3">
          <div className="relative flex-1">
            {fetchingSantri ? (
              <Loader2 className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            ) : (
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            )}
            <Input placeholder="Cari nama, email, atau NIS..." value={santriSearchQuery} onChange={e => {
              setSantriSearchQuery(e.target.value);
              setCurrentPage(1);
            }} className="pl-9 h-9 lg:h-10 rounded-xl text-sm" />
          </div>
          <Select value={santriKelasFilter} onValueChange={value => {
            setSantriKelasFilter(value);
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-[100px] sm:w-[200px] h-9 lg:h-10 rounded-xl shrink-0">
              <SelectValue placeholder="Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
              {kelasList.map(kelas => <SelectItem key={kelas.id} value={kelas.id}>
                {kelas.nama}
              </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* List card */}
      <div className="flex flex-col gap-2 lg:gap-3">
        {usersList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Tidak ada data santri ditemukan
          </div>
        ) : (
          usersList.map(user => (
            <div
              key={user.id}
              onClick={() => handleViewUser(user.id)}
              className="bg-card border border-border/50 rounded-xl p-2.5 lg:p-4 hover:bg-muted/30 hover:border-border transition-all duration-200 cursor-pointer"
            >
              {/* Mobile Layout - Compact */}
              <div className="flex flex-col gap-2 lg:hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <UserIcon className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.nis || '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      variant="action-detail" 
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); handleViewUser(user.id); }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="action-delete" 
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); setDeleteUserId(user.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">Kelas</span>
                    <p className="text-xs font-medium text-foreground/80">{kelasList.find(k => k.id === user.kelasId)?.nama || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">Status</span>
                    <div className="mt-0.5">
                      <Badge variant={user.status === 'aktif' ? "default" : "secondary"} className="text-[10px] font-medium px-2 py-0.5">
                        {user.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Desktop Layout - 12 column grid */}
              <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                {/* Col-span-5: Identity Group (Avatar + Name + NIS) */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.nis || '-'}</p>
                  </div>
                </div>
                
                {/* Col-span-3: Class Info */}
                <div className="col-span-3">
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Kelas</p>
                  <p className="text-sm font-medium text-foreground/80 truncate">{kelasList.find(k => k.id === user.kelasId)?.nama || '-'}</p>
                </div>
                
                {/* Col-span-2: Status Badge */}
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Status</p>
                  <Badge variant={user.status === 'aktif' ? "default" : "secondary"} className="text-xs font-medium px-2.5 py-0.5">
                    {user.status === 'aktif' ? 'Aktif' : 'Tidak Aktif'}
                  </Badge>
                </div>
                
                {/* Col-span-2: Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <Button 
                    variant="action-detail" 
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); handleViewUser(user.id); }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="action-delete" 
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); setDeleteUserId(user.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, santriQueryData?.total || 0)} dari {santriQueryData?.total || 0} santri
          </div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} 
                />
              </PaginationItem>
              
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink 
                        onClick={() => setCurrentPage(page)} 
                        isActive={currentPage === page} 
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} 
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
  const renderParentTable = (parentUsers: User[]) => {
    const santriList = users.filter(u => u.role === 'santri');
    return (
      <div className="space-y-3 lg:space-y-4 px-3 lg:px-4 py-3 lg:py-4">
        {/* Filter pencarian - Sticky on mobile */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm -mx-3 px-3 py-2 lg:static lg:mx-0 lg:px-0 lg:py-0 lg:bg-transparent lg:backdrop-blur-none">
          <div className="flex flex-row gap-2 lg:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cari nama atau email..." className="pl-9 h-9 lg:h-10 rounded-xl text-sm" />
            </div>
            <Select defaultValue="all">
              <SelectTrigger className="w-[100px] sm:w-[200px] h-9 lg:h-10 rounded-xl shrink-0">
                <SelectValue placeholder="Hubungan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Hubungan</SelectItem>
                <SelectItem value="ayah">Ayah</SelectItem>
                <SelectItem value="ibu">Ibu</SelectItem>
                <SelectItem value="wali">Wali</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* List card */}
        <div className="flex flex-col gap-2 lg:gap-3">
          {parentUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Tidak ada data orang tua ditemukan
            </div>
          ) : (
            parentUsers.map(user => {
              const children = santriList.filter(s => user.childrenIds?.includes(s.id));
              const childrenNames = children.map(c => c.name).join(', ') || '-';
              return (
                <div
                  key={user.id}
                  onClick={() => handleViewUser(user.id)}
                  className="bg-card border border-border/50 rounded-xl p-2.5 lg:p-4 hover:bg-muted/30 hover:border-border transition-all duration-200 cursor-pointer"
                >
                  {/* Mobile Layout - Compact */}
                  <div className="flex flex-col gap-2 lg:hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <UserIcon className="h-3.5 w-3.5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {user.relationship === 'ayah' ? 'Ayah' : user.relationship === 'ibu' ? 'Ibu' : 'Wali'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button 
                          variant="action-detail" 
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); handleViewUser(user.id); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="action-delete" 
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setDeleteUserId(user.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">Nama Ananda</span>
                        <p className="text-xs font-medium text-foreground/80 truncate">{childrenNames}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70">Kontak</span>
                        <p className="text-xs font-medium text-foreground/80 truncate">{user.email || user.phone || '-'}</p>
                      </div>
                      <div>
                        <Badge variant={user.status === 'aktif' ? "default" : "secondary"} className="text-[10px] font-medium px-2 py-0.5">
                          {user.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {/* Desktop Layout - 12 column grid */}
                  <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                    {/* Col-span-4: Identity Group (Avatar + Name + Role) */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <UserIcon className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.relationship === 'ayah' ? 'Ayah' : user.relationship === 'ibu' ? 'Ibu' : 'Wali'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Col-span-3: Child Info */}
                    <div className="col-span-3 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Nama Ananda</p>
                      <p className="text-sm font-medium text-foreground/80 truncate">{childrenNames}</p>
                    </div>
                    
                    {/* Col-span-3: Contact Info */}
                    <div className="col-span-3 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-1">Kontak</p>
                      <p className="text-sm font-medium text-foreground/80 truncate">{user.email || user.phone || '-'}</p>
                    </div>
                    
                    {/* Col-span-2: Status & Actions */}
                    <div className="col-span-2 flex items-center justify-between gap-2">
                      <Badge variant={user.status === 'aktif' ? "default" : "secondary"} className="text-xs font-medium px-2.5 py-0.5">
                        {user.status === 'aktif' ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="action-detail" 
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); handleViewUser(user.id); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="action-delete" 
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); setDeleteUserId(user.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };
  if (loading) {
    return <AdminUsersSkeleton />;
  }
  return <div className="space-y-6">
      {/* Mobile-Optimized Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-3 sm:p-4 lg:p-6">
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">Kelola Pengguna</h1>
            <p className="text-muted-foreground text-sm hidden lg:block">Manajemen data pengguna dalam sistem</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4"
              disabled={getActiveUserExportCount() === 0}
              onClick={() => handleExportUsers('pdf')}
            >
              <FileText className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline text-sm">Export PDF</span>
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4"
              disabled={getActiveUserExportCount() === 0}
              onClick={() => handleExportUsers('xlsx')}
            >
              <FileSpreadsheet className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
              <span className="hidden sm:inline text-sm">XLSX</span>
            </Button>
            {activeTab === 'staff' && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4"
                  onClick={() => setImportStaffOpen(true)}
                >
                  <Upload className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
                  <span className="hidden sm:inline text-sm">Import</span>
                  <span className="hidden lg:inline ml-1">Staff</span>
                </Button>
                <Button className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4" onClick={handleAddUser}>
                  <Plus className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
                  <span className="hidden sm:inline text-sm">Tambah</span>
                  <span className="hidden lg:inline ml-1">Staff</span>
                </Button>
              </>
            )}
            {activeTab === 'santri' && (
              <>
                <Button
                  variant="outline"
                  className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4"
                  onClick={() => setImportSantriOpen(true)}
                >
                  <Upload className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
                  <span className="hidden sm:inline text-sm">Import</span>
                  <span className="hidden lg:inline ml-1">Santri</span>
                </Button>
                <Button className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4" onClick={() => {
                  setSantriQuickFormOpen(true);
                  setCurrentPage(1);
                }}>
                  <Plus className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
                  <span className="hidden sm:inline text-sm">Tambah</span>
                  <span className="hidden lg:inline ml-1">Santri</span>
                </Button>
              </>
            )}
            {activeTab === 'orangtua' && (
              <Button className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4" onClick={handleAddParent}>
                <Plus className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
                <span className="hidden sm:inline text-sm">Tambah</span>
                <span className="hidden lg:inline ml-1">Orang Tua</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={value => {
        setActiveTab(value);
        sessionStorage.setItem('adminUsersActiveTab', value);
        setCurrentPage(1);
      }} className="w-full -mt-2 lg:mt-0">
        <Card className="rounded-2xl border shadow-sm overflow-hidden">
          <TabsList variant="panel" className="rounded-none border-0 border-b-0 rounded-b-none">
            <TabsTrigger value="staff" variant="panel">
              <UserCog className="h-[18px] w-[18px]" />
              <span>Staff<span className="hidden lg:inline"> & Guru</span></span>
            </TabsTrigger>
            <TabsTrigger value="santri" variant="panel">
              <GraduationCap className="h-[18px] w-[18px]" />
              <span>Santri</span>
            </TabsTrigger>
            <TabsTrigger value="orangtua" variant="panel">
              <Users className="h-[18px] w-[18px]" />
              <span>Orang Tua</span>
            </TabsTrigger>
          </TabsList>

          <div className="border-t border-border/60 p-3 lg:p-4">
            <DataExportPanel
              title={`Export Data ${getActiveUserExportLabel()}`}
              description="Unduh daftar user lengkap sesuai tab dan filter aktif"
              count={getActiveUserExportCount()}
              disabled={getActiveUserExportCount() === 0}
              onExportXlsx={() => handleExportUsers('xlsx')}
              onExportPdf={() => handleExportUsers('pdf')}
            />
          </div>

          <CardContent className="p-0">
            {/* Staff & Guru Tab */}
            <TabsContent value="staff" className="mt-0">
              <div className="overflow-x-auto">
                {renderUserTable(paginatedStaffUsers, staffUsers.length)}
              </div>
            </TabsContent>

            {/* Santri Tab */}
            <TabsContent value="santri" className="mt-0">
              <div className="overflow-x-auto">
                {renderSantriTable(paginatedSantriUsers)}
              </div>
            </TabsContent>

            {/* Orang Tua Tab */}
            <TabsContent value="orangtua" className="mt-0">
              <div className="overflow-x-auto">
                {renderParentTable(orangtuaUsers)}
              </div>
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      {/* User Form Dialog */}
      <UserForm open={userFormOpen} onOpenChange={setUserFormOpen} user={editingUser} kelas={kelasList} onSave={handleSaveUser} onDelete={deleteUserId ? handleDeleteUser : undefined} />

      {/* Santri Quick Add Form */}
      <SantriQuickAddForm open={santriQuickFormOpen} onOpenChange={setSantriQuickFormOpen} kelas={kelasList} onSuccess={refetchUsers} />

      <ImportSantriModal open={importSantriOpen} onOpenChange={setImportSantriOpen} kelasList={kelasList} onImported={refetchUsers} />
      <ImportStaffModal open={importStaffOpen} onOpenChange={setImportStaffOpen} kelasList={kelasList} onImported={refetchUsers} />

      {/* Parent Form Dialog */}
      <ParentForm open={parentFormOpen} onOpenChange={setParentFormOpen} parent={editingParent} santriList={users.filter(u => u.role === 'santri')} onSave={handleSaveParent} onDelete={deleteUserId ? handleDeleteUser : undefined} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={handleCloseDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Hapus Pengguna?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data pengguna akan dihapus secara permanen dari sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <label htmlFor="delete-password" className="text-sm font-medium text-foreground">
                Masukkan password Anda untuk konfirmasi
              </label>
              <Input
                id="delete-password"
                type="password"
                placeholder="Password"
                value={deletePassword}
                onChange={(e) => {
                  e.stopPropagation();
                  setDeletePassword(e.target.value);
                  setDeleteError('');
                }}
                onKeyDown={(e) => e.stopPropagation()}
                disabled={deleteLoading}
                autoComplete="new-password"
                className={deleteError ? 'border-destructive' : ''}
              />
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Batal</AlertDialogCancel>
            <Button 
              onClick={handleDeleteUser} 
              disabled={deleteLoading || !deletePassword.trim()}
              variant="destructive"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Ya, Hapus'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
}
