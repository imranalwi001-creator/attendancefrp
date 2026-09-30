import { Role, User } from '@/types';

export interface UserFormData {
  name: string;
  email: string;
  role: Role;
  employeeId: string;
  nisn: string;
  nis: string;
  birthDate: string;
  address: string;
  kelasId: string;
  mapelIds: string[];
  status: 'aktif' | 'nonaktif' | 'cuti' | 'alumni';
  avatar: string;
  previousSchool: string;
  childOrder: string;
  bloodType: string;
  medicalHistory: string;
  allergyHistory: string;
  height: string;
  weight: string;
  socialType: 'periang' | 'minder' | 'tenang';
  peerReaction: 'aktif' | 'pasif';
  photoChild: string;
  familyCard: string;
  achievementCertificate: string;
  // Psychology assessment fields
  stifin: string;
  asesmenAwal: string;
  // Staff specific fields
  jenisKelamin: string;
  tempatLahir: string;
  tanggalLahir: string;
  nik: string;
  alamatStaff: string;
}

export interface KelasOption {
  id: string;
  nama: string;
  tingkat: string;
  tahun_ajaran: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  timestamp: Date;
  type: string;
}

export interface UserDetailHeaderProps {
  formData: UserFormData;
  avatarPreview: string;
  isEditMode: boolean;
  onEditModeToggle: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNavigateBack: () => void;
  hideEditButton?: boolean;
}

export interface UserInfoTabProps {
  user: User | null;
  formData: UserFormData;
  setFormData: React.Dispatch<React.SetStateAction<UserFormData>>;
  isEditMode: boolean;
  kelasList: KelasOption[];
  userKelas: any;
  userMapel: any[];
  toggleMapel: (mapelId: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  isChangingPassword: boolean;
  handleChangePassword: () => void;
  disableEdit?: boolean;
}

export interface UserPersonalTabProps {
  formData: UserFormData;
  setFormData: React.Dispatch<React.SetStateAction<UserFormData>>;
  isEditMode: boolean;
}

export interface UserDocumentsTabProps {
  formData: UserFormData;
  isEditMode: boolean;
  photoChildPreview: string;
  familyCardPreview: string;
  achievementCertificatePreview: string;
  onPhotoChildChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFamilyCardChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAchievementCertificateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export interface UserActivityTabProps {
  activityLogs: ActivityLog[];
}
