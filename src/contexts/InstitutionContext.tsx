import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

type WorkspaceType = 'mandiri' | 'sekolah';
type EducationLevel = 'paud' | 'sd' | 'smp' | 'sma' | 'smk' | 'pesantren';

interface InstitutionContextType {
  workspaceType: WorkspaceType;
  educationLevel: EducationLevel;
  setWorkspaceType: (type: WorkspaceType) => void;
  setEducationLevel: (level: EducationLevel) => void;
  
  // Helper functions for dynamic vocabulary
  getStudentLabel: () => string;
  getTeacherLabel: () => string;
  getSubjectLabel: () => string;
  getReligionSubjectLabel: () => string;
  
  // Feature flags
  hasExams: boolean;
  hasMajors: boolean;
  hasBoarding: boolean;
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined);

export function InstitutionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // In a real app, these would come from the database via the user's workspace profile
  // For now, we default to 'pesantren' as it was the original app's focus
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('sekolah');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('pesantren');

  // Update context when user data is available
  useEffect(() => {
    if (user?.workspace_type) {
      setWorkspaceType(user.workspace_type as WorkspaceType);
    }
    if (user?.education_level) {
      setEducationLevel(user.education_level as EducationLevel);
    }
  }, [user]);

  // Dynamic Vocabulary Resolvers
  const getStudentLabel = () => {
    if (educationLevel === 'pesantren') return 'Santri';
    if (educationLevel === 'paud') return 'Anak Didik';
    return 'Siswa';
  };

  const getTeacherLabel = () => {
    if (educationLevel === 'pesantren') return 'Ustadz/ah';
    return 'Guru';
  };

  const getSubjectLabel = () => {
    if (educationLevel === 'paud' || educationLevel === 'sd') return 'Tema/Mapel';
    return 'Mata Pelajaran';
  };

  const getReligionSubjectLabel = () => {
    if (educationLevel === 'pesantren') return 'Tahfidz & Kitab';
    return 'Pendidikan Agama';
  };

  // Feature Flags
  const hasExams = educationLevel !== 'paud';
  const hasMajors = educationLevel === 'sma' || educationLevel === 'smk';
  const hasBoarding = educationLevel === 'pesantren';

  const value = {
    workspaceType,
    educationLevel,
    setWorkspaceType,
    setEducationLevel,
    getStudentLabel,
    getTeacherLabel,
    getSubjectLabel,
    getReligionSubjectLabel,
    hasExams,
    hasMajors,
    hasBoarding
  };

  return (
    <InstitutionContext.Provider value={value}>
      {children}
    </InstitutionContext.Provider>
  );
}

export function useInstitution() {
  const context = useContext(InstitutionContext);
  if (context === undefined) {
    throw new Error('useInstitution must be used within an InstitutionProvider');
  }
  return context;
}
