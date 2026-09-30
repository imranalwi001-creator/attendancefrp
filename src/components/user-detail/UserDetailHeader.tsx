import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Trash2, Camera, Pencil, Save, X, User } from 'lucide-react';
import { UserDetailHeaderProps } from './types';

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    guru: 'Guru / Wali Kelas',
    walikelas: 'Wali Kelas',
    Pembina: 'Pembina',
    staff: 'Staff',
    santri: 'Santri',
    orangtua: 'Orang Tua'
  };
  return labels[role] || role;
};

export function UserDetailHeader({
  formData,
  avatarPreview,
  isEditMode,
  onEditModeToggle,
  onSave,
  onCancel,
  onDelete,
  onAvatarChange,
  onNavigateBack,
  hideEditButton = false
}: UserDetailHeaderProps) {
  return (
    <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
      <div className="flex items-center gap-4">
        {/* Back Button */}
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onNavigateBack} 
          className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4 text-white" />
        </Button>
        
        {/* Avatar */}
        <div className="relative group shrink-0">
          <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-white/20 shadow-lg">
            <AvatarImage src={avatarPreview} alt={formData.name} />
            <AvatarFallback className="bg-white/20 text-white text-lg md:text-xl font-bold">
              {formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          {isEditMode && (
            <label 
              htmlFor="avatar-upload" 
              className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              <Camera className="h-5 w-5 text-white" />
              <input 
                id="avatar-upload" 
                type="file" 
                accept="image/*" 
                onChange={onAvatarChange} 
                className="hidden" 
              />
            </label>
          )}
        </div>

        {/* User Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-white truncate">{formData.name}</h2>
          <p className="text-sm text-white/70 truncate flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-white/70"></span>
            {getRoleLabel(formData.role)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {isEditMode ? (
            <>
              <Button 
                onClick={onCancel}
                variant="outline"
                size="sm"
                className="rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 text-white transition-all duration-200"
              >
                <X className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Batal</span>
              </Button>
              <Button 
                onClick={onSave}
                size="sm"
                className="rounded-xl bg-white text-primary hover:bg-white/90 shadow-md"
              >
                <Save className="h-4 w-4 md:mr-1.5" />
                <span className="hidden md:inline">Simpan</span>
              </Button>
            </>
          ) : (
            <>
              {!hideEditButton && (
                <Button 
                  onClick={onEditModeToggle}
                  size="sm"
                  className="rounded-xl bg-white text-primary hover:bg-white/90 shadow-md"
                >
                  <Pencil className="h-4 w-4 md:mr-1.5" />
                  <span className="hidden md:inline">Edit</span>
                </Button>
              )}
              <Button 
                onClick={onDelete} 
                variant="outline"
                size="icon"
                className="rounded-xl h-9 w-9 border-2 border-destructive/30 bg-destructive/10 backdrop-blur-sm hover:bg-destructive/20 hover:border-destructive/50 text-white transition-all duration-200"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
