import { ContentCard, ContentCardBody } from '@/components/ui/content-card';
import { ExtractionCardHeader } from '@/components/ui/extraction-card-header';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User } from 'lucide-react';

export interface ProfileField {
  key: string;
  label: string;
  value: string | number | null | undefined;
  displayValue?: string; // For showing different text in view mode (e.g., class name instead of ID)
  type?: 'text' | 'email' | 'select' | 'textarea' | 'date' | 'custom';
  options?: { value: string; label: string }[];
  colSpan?: 1 | 2;
  placeholder?: string;
  onChange?: (value: string) => void;
  customRender?: React.ReactNode;
}

export interface ChildItem {
  id: string;
  name: string;
  nis?: string | null;
  avatar_url?: string | null;
}

interface ProfileInfoCardProps {
  title?: string;
  fields: ProfileField[];
  isEditMode?: boolean;
  // Children/Santri specific props
  childrenField?: {
    label: string;
    selectedIds: string[];
    allItems: ChildItem[];
    onToggle: (id: string) => void;
    emptyText?: string;
  };
  // Registration date
  registrationDate?: string | null;
}

export function ProfileInfoCard({
  title = "Informasi Profil",
  fields,
  isEditMode = false,
  childrenField,
  registrationDate,
}: ProfileInfoCardProps) {
  const getRelationshipLabel = (rel?: string | null) => {
    const labels: Record<string, string> = {
      ayah: 'Ayah',
      ibu: 'Ibu',
      wali: 'Wali'
    };
    return labels[rel || ''] || rel || '-';
  };

  const renderField = (field: ProfileField) => {
    if (field.type === 'custom' && field.customRender) {
      return field.customRender;
    }

    if (isEditMode) {
      switch (field.type) {
        case 'select':
          return (
            <Select value={field.value?.toString() || ''} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        case 'textarea':
          return (
            <Textarea
              value={field.value?.toString() || ''}
              onChange={(e) => field.onChange?.(e.target.value)}
              className="font-semibold min-h-[80px]"
              placeholder={field.placeholder}
            />
          );
        case 'email':
          return (
            <Input
              type="email"
              value={field.value?.toString() || ''}
              onChange={(e) => field.onChange?.(e.target.value)}
              className="font-semibold"
              placeholder={field.placeholder}
            />
          );
        default:
          return (
            <Input
              value={field.value?.toString() || ''}
              onChange={(e) => field.onChange?.(e.target.value)}
              className="font-semibold"
              placeholder={field.placeholder}
            />
          );
      }
    }

    // View mode - use displayValue if provided, otherwise fall back to value
    if (field.type === 'select' && field.key === 'relationship') {
      return <p className="text-base font-semibold">{getRelationshipLabel(field.value?.toString())}</p>;
    }

    // Use displayValue for view mode if provided (e.g., for showing class name instead of ID)
    const viewValue = field.displayValue !== undefined ? field.displayValue : field.value;
    return <p className="text-base font-semibold">{viewValue || '-'}</p>;
  };

  const selectedChildren = childrenField?.allItems.filter(
    item => childrenField.selectedIds.includes(item.id)
  ) || [];

  return (
    <ContentCard>
      <ExtractionCardHeader
        icon={<User className="h-4 w-4 text-primary" />}
        title={title}
      />
      <ContentCardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map((field) => (
            <div
              key={field.key}
              className={`space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50 ${
                field.colSpan === 2 ? 'md:col-span-2' : ''
              }`}
            >
              <Label className="text-sm font-medium text-muted-foreground">{field.label}</Label>
              {renderField(field)}
            </div>
          ))}

          {/* Children/Santri Field */}
          {childrenField && (
            <div className="md:col-span-2 space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
              <Label className="text-sm font-medium text-muted-foreground">{childrenField.label}</Label>
              {isEditMode ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto p-3 rounded-xl bg-background/50">
                  {childrenField.allItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-background border border-border hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={childrenField.selectedIds.includes(item.id)}
                        onCheckedChange={() => childrenField.onToggle(item.id)}
                      />
                      <label htmlFor={`item-${item.id}`} className="flex items-center gap-2 flex-1 cursor-pointer">
                        <Avatar className="h-8 w-8 border border-border">
                          <AvatarImage src={item.avatar_url || undefined} alt={item.name} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.nis || '-'}</p>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedChildren.length === 0 ? (
                    <p className="text-base font-semibold text-muted-foreground">
                      {childrenField.emptyText || 'Tidak ada data'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedChildren.map((child) => (
                        <Badge key={child.id} variant="outline" className="text-sm py-1 px-3">
                          {child.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Registration Date */}
          {registrationDate !== undefined && (
            <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-border/50">
              <Label className="text-sm font-medium text-muted-foreground">Tanggal Registrasi</Label>
              <p className="text-base font-semibold">
                {registrationDate ? new Date(registrationDate).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : '-'}
              </p>
            </div>
          )}
        </div>
      </ContentCardBody>
    </ContentCard>
  );
}
