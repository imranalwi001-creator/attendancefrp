import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Save, Trash2, ChevronDown, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface ParentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent?: User | null;
  santriList: User[];
  onSave: (parent: Partial<User> & { password?: string }) => void;
  onDelete?: (parentId: string) => void;
}

interface FormData extends Partial<User> {
  password?: string;
}

export default function ParentForm({
  open,
  onOpenChange,
  parent,
  santriList,
  onSave,
  onDelete
}: ParentFormProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [santriDropdownOpen, setSantriDropdownOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    relationship: 'ayah',
    childrenIds: [],
    address: '',
    notes: '',
    status: 'aktif',
    role: 'orangtua'
  });

  // Reset form when parent changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        name: parent?.name || '',
        email: parent?.email || '',
        phone: parent?.phone || '',
        password: '',
        relationship: parent?.relationship || 'ayah',
        childrenIds: parent?.childrenIds || [],
        address: parent?.address || '',
        notes: parent?.notes || '',
        status: parent?.status || 'aktif',
        role: 'orangtua'
      });
    }
  }, [open, parent]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const parentData = {
      ...formData,
      id: parent?.id,
      createdAt: parent?.createdAt || new Date().toISOString(),
    };

    onSave(parentData);
    
    toast({
      title: "Berhasil",
      description: "Data orang tua berhasil disimpan.",
    });
    
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (parent?.id && onDelete) {
      onDelete(parent.id);
      toast({
        title: "Dihapus",
        description: "Data orang tua berhasil dihapus.",
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
    }
  };

  const toggleChild = (santriId: string) => {
    setFormData(prev => ({
      ...prev,
      childrenIds: prev.childrenIds?.includes(santriId)
        ? prev.childrenIds.filter(id => id !== santriId)
        : [...(prev.childrenIds || []), santriId]
    }));
  };

  const removeChild = (santriId: string) => {
    setFormData(prev => ({
      ...prev,
      childrenIds: prev.childrenIds?.filter(id => id !== santriId) || []
    }));
  };

  const getSelectedSantriNames = () => {
    return santriList.filter(s => formData.childrenIds?.includes(s.id));
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] flex flex-col">
          {/* Header */}
          <DrawerHeader className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <DrawerTitle>{parent ? 'Edit Orang Tua' : 'Tambah Orang Tua'}</DrawerTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {parent ? 'Perbarui data orang tua/wali santri' : 'Tambahkan data orang tua/wali santri baru'}
                </p>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <form id="parent-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationship">Hubungan dengan Santri <span className="text-destructive">*</span></Label>
                  <Select
                    value={formData.relationship}
                    onValueChange={(value: 'ayah' | 'ibu' | 'wali') => 
                      setFormData({ ...formData, relationship: value })
                    }
                  >
                    <SelectTrigger id="relationship">
                      <SelectValue placeholder="Pilih hubungan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ayah">Ayah</SelectItem>
                      <SelectItem value="ibu">Ibu</SelectItem>
                      <SelectItem value="wali">Wali</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Nomor Telepon <span className="text-destructive">*</span></Label>
                  <Input
                    id="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>

              {!parent && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password Awal</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Kosongkan untuk auto-generate"
                  />
                  <p className="text-xs text-muted-foreground">
                    Jika dikosongkan, sistem akan membuat password otomatis
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="status">Status Akun <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: 'aktif' | 'nonaktif' | 'cuti' | 'alumni') => 
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktif">Aktif</SelectItem>
                    <SelectItem value="nonaktif">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Anak (Santri) yang Diasuh <span className="text-destructive">*</span></Label>
                <Popover open={santriDropdownOpen} onOpenChange={setSantriDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={santriDropdownOpen}
                      className="w-full justify-between h-auto min-h-10"
                    >
                      <span className="text-muted-foreground">
                        {formData.childrenIds?.length 
                          ? `${formData.childrenIds.length} santri dipilih` 
                          : "Pilih santri..."}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-popover" align="start">
                    <Command>
                      <CommandInput placeholder="Cari santri..." />
                      <CommandList>
                        <CommandEmpty>Tidak ada santri ditemukan.</CommandEmpty>
                        <CommandGroup>
                          {santriList.map((santri) => (
                            <CommandItem
                              key={santri.id}
                              value={santri.name}
                              onSelect={() => toggleChild(santri.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.childrenIds?.includes(santri.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span>{santri.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* Selected santri badges */}
                {getSelectedSantriNames().length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {getSelectedSantriNames().map((santri) => (
                      <Badge key={santri.id} variant="secondary" className="gap-1 pr-1">
                        {santri.name}
                        <button
                          type="button"
                          onClick={() => removeChild(santri.id)}
                          className="ml-1 rounded-full hover:bg-muted p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Masukkan alamat lengkap"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Catatan Tambahan</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan (opsional)"
                  rows={2}
                />
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/30">
            <div className="flex gap-2 w-full">
              {parent && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Hapus
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                form="parent-form"
                className="flex-1"
              >
                Simpan
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete Confirmation - tetap AlertDialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data orang tua ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
