import { useState } from 'react';
import { ContentCard, ContentCardBody } from '@/components/ui/content-card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Heart, BookOpen, Users, Activity, User as UserIcon, Edit, Save, X, UserCog } from 'lucide-react';
import { UserPersonalTabProps } from './types';

export function UserPersonalTab({
  formData,
  setFormData,
  isEditMode,
  onSave
}: UserPersonalTabProps & { onSave?: () => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalData, setOriginalData] = useState(formData);

  const handleEdit = () => {
    setOriginalData({ ...formData });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave();
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const editing = isEditMode || isEditing;

  return (
    <ContentCard>
      <ExtractionCardHeader
        icon={<UserCog className="h-4 w-4 text-primary" />}
        title="Data Personal"
        actions={
          !isEditMode && !isEditing && onSave ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEdit}
              className="rounded-xl gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit
            </Button>
          ) : undefined
        }
      />
      <ContentCardBody>
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* School and Family Background */}
            <div className="space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label htmlFor="previousSchool" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                Asal Sekolah
              </Label>
              {editing ? (
                <Input 
                  id="previousSchool" 
                  value={formData.previousSchool} 
                  onChange={e => setFormData({ ...formData, previousSchool: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold" 
                  placeholder="Nama sekolah sebelumnya" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.previousSchool || '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label htmlFor="childOrder" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Anak Ke
              </Label>
              {editing ? (
                <Input 
                  id="childOrder" 
                  value={formData.childOrder} 
                  onChange={e => setFormData({ ...formData, childOrder: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold" 
                  placeholder="Contoh: 1 dari 3" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.childOrder || '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label htmlFor="bloodType" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Heart className="h-3.5 w-3.5" />
                Golongan Darah
              </Label>
              {editing ? (
                <Select 
                  value={formData.bloodType} 
                  onValueChange={value => setFormData({ ...formData, bloodType: value })}
                >
                  <SelectTrigger className="rounded-lg border-0 bg-background">
                    <SelectValue placeholder="Pilih golongan darah" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="AB">AB</SelectItem>
                    <SelectItem value="O">O</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.bloodType || '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label htmlFor="height" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UserIcon className="h-3.5 w-3.5" />
                Tinggi Badan (cm)
              </Label>
              {editing ? (
                <Input 
                  id="height" 
                  type="number" 
                  value={formData.height} 
                  onChange={e => setFormData({ ...formData, height: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold" 
                  placeholder="Contoh: 165" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.height ? `${formData.height} cm` : '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label htmlFor="weight" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UserIcon className="h-3.5 w-3.5" />
                Berat Badan (kg)
              </Label>
              {editing ? (
                <Input 
                  id="weight" 
                  type="number" 
                  value={formData.weight} 
                  onChange={e => setFormData({ ...formData, weight: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold" 
                  placeholder="Contoh: 55" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground">{formData.weight ? `${formData.weight} kg` : '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Tipe Sosial
              </Label>
              {editing ? (
                <RadioGroup 
                  value={formData.socialType} 
                  onValueChange={value => setFormData({ ...formData, socialType: value as 'periang' | 'minder' | 'tenang' })}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="periang" id="social-periang" />
                      <Label htmlFor="social-periang" className="font-medium cursor-pointer flex-1">
                        Periang
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="minder" id="social-minder" />
                      <Label htmlFor="social-minder" className="font-medium cursor-pointer flex-1">
                        Minder
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="tenang" id="social-tenang" />
                      <Label htmlFor="social-tenang" className="font-medium cursor-pointer flex-1">
                        Tenang
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              ) : (
                <p className="text-base font-semibold text-foreground capitalize">{formData.socialType || '-'}</p>
              )}
            </div>

            <div className="space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                Reaksi dengan Kawan
              </Label>
              {editing ? (
                <RadioGroup 
                  value={formData.peerReaction} 
                  onValueChange={value => setFormData({ ...formData, peerReaction: value as 'aktif' | 'pasif' })}
                >
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="aktif" id="peer-aktif" />
                      <Label htmlFor="peer-aktif" className="font-medium cursor-pointer flex-1">
                        Aktif
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="pasif" id="peer-pasif" />
                      <Label htmlFor="peer-pasif" className="font-medium cursor-pointer flex-1">
                        Pasif
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              ) : (
                <p className="text-base font-semibold text-foreground capitalize">{formData.peerReaction || '-'}</p>
              )}
            </div>

            {/* Health Information - Full Width */}
            <div className="md:col-span-2 space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label htmlFor="medicalHistory" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Riwayat Penyakit
              </Label>
              {editing ? (
                <Textarea 
                  id="medicalHistory" 
                  value={formData.medicalHistory} 
                  onChange={e => setFormData({ ...formData, medicalHistory: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold min-h-[80px]" 
                  placeholder="Riwayat penyakit yang pernah diderita" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground whitespace-pre-wrap">{formData.medicalHistory || '-'}</p>
              )}
            </div>

            <div className="md:col-span-2 space-y-2 p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors">
              <Label htmlFor="allergyHistory" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Riwayat Alergi
              </Label>
              {editing ? (
                <Textarea 
                  id="allergyHistory" 
                  value={formData.allergyHistory} 
                  onChange={e => setFormData({ ...formData, allergyHistory: e.target.value })} 
                  className="rounded-lg border-0 bg-background font-semibold min-h-[80px]" 
                  placeholder="Alergi terhadap makanan, obat, atau lainnya" 
                />
              ) : (
                <p className="text-base font-semibold text-foreground whitespace-pre-wrap">{formData.allergyHistory || '-'}</p>
              )}
            </div>
          </div>

          {isEditing && onSave && (
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="rounded-xl gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-xl gap-2"
              >
                <X className="h-4 w-4" />
                Batal
              </Button>
            </div>
          )}
        </div>
      </ContentCardBody>
    </ContentCard>
  );
}
