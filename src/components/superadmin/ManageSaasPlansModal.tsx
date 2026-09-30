import { useState, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, Trash2, RotateCcw, Save, Sparkles, Check, CheckCircle2,
  Package, Users, GraduationCap, DollarSign, Layers, AlertCircle
} from 'lucide-react';
import { useSaasPlans, SaasLicensePlan, DEFAULT_SAAS_PLANS } from '@/hooks/useSaasPlans';
import { toast } from 'sonner';

interface ManageSaasPlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageSaasPlansModal({ open, onOpenChange }: ManageSaasPlansModalProps) {
  const { plans, updatePlans, isUpdating, resetPlans, isResetting } = useSaasPlans();
  const [localPlans, setLocalPlans] = useState<SaasLicensePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [newFeatureText, setNewFeatureText] = useState('');

  // Sync with incoming plans when dialog opens
  useEffect(() => {
    if (open) {
      const cloned = JSON.parse(JSON.stringify(plans)) as SaasLicensePlan[];
      setLocalPlans(cloned);
      if (cloned.length > 0) {
        setSelectedPlanId(cloned[0].id);
      }
    }
  }, [open, plans]);

  const activePlanIndex = localPlans.findIndex(p => p.id === selectedPlanId);
  const activePlan = activePlanIndex !== -1 ? localPlans[activePlanIndex] : localPlans[0];

  const handleUpdateActivePlan = <K extends keyof SaasLicensePlan>(key: K, value: SaasLicensePlan[K]) => {
    if (activePlanIndex === -1) return;
    setLocalPlans(prev => {
      const next = [...prev];
      next[activePlanIndex] = {
        ...next[activePlanIndex],
        [key]: value
      };
      return next;
    });
  };

  const handleAddFeature = () => {
    if (!newFeatureText.trim() || activePlanIndex === -1) return;
    const currentFeatures = activePlan.features || [];
    handleUpdateActivePlan('features', [...currentFeatures, newFeatureText.trim()]);
    setNewFeatureText('');
  };

  const handleRemoveFeature = (idx: number) => {
    if (activePlanIndex === -1) return;
    const currentFeatures = activePlan.features || [];
    handleUpdateActivePlan('features', currentFeatures.filter((_, i) => i !== idx));
  };

  const handleAddPlan = () => {
    const newId = 'plan_' + Date.now();
    const newPlan: SaasLicensePlan = {
      id: newId,
      name: 'Paket Kustom Baru',
      badge: 'Custom',
      badgeVariant: 'secondary',
      price: 500000,
      billingCycleText: '/ bln',
      isPopular: false,
      maxStudents: 300,
      maxTeachers: 30,
      features: [
        'Maksimal 300 Siswa & 30 Guru',
        'Akses CBT & Raport'
      ]
    };
    setLocalPlans(prev => [...prev, newPlan]);
    setSelectedPlanId(newId);
    toast.info('Paket baru ditambahkan ke daftar.');
  };

  const handleDeletePlan = (id: string) => {
    if (localPlans.length <= 1) {
      toast.error('Minimal harus ada satu paket lisensi.');
      return;
    }
    const filtered = localPlans.filter(p => p.id !== id);
    setLocalPlans(filtered);
    setSelectedPlanId(filtered[0].id);
    toast.info('Paket dihapus dari daftar sementara.');
  };

  const handleSave = async () => {
    try {
      await updatePlans(localPlans);
      onOpenChange(false);
    } catch (e) {
      // toast is already handled in hook
    }
  };

  const handleReset = async () => {
    if (window.confirm('Apakah Anda yakin ingin mengembalikan semua paket ke pengaturan awal (default)?')) {
      try {
        await resetPlans();
        const cloned = JSON.parse(JSON.stringify(DEFAULT_SAAS_PLANS)) as SaasLicensePlan[];
        setLocalPlans(cloned);
        if (cloned.length > 0) setSelectedPlanId(cloned[0].id);
      } catch (e) {
        // handled in hook
      }
    }
  };

  if (!activePlan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl border-border">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border bg-card/60">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Kelola Paket Lisensi SaaS
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sesuaikan nama, harga langganan bulanan, batas kuota santri/guru, dan poin fasilitas untuk setiap tingkatan paket.
              </DialogDescription>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={handleReset}
              disabled={isResetting || isUpdating}
              className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Default
            </Button>
          </div>

          {/* Plan Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pt-4 pb-1">
            {localPlans.map((plan) => {
              const isSelected = plan.id === selectedPlanId;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                  }`}
                >
                  <span>{plan.name}</span>
                  {plan.isPopular && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-primary-foreground/20 text-white' : 'bg-primary/10 text-primary'}`}>
                      Populer
                    </span>
                  )}
                </button>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddPlan}
              className="h-8 rounded-xl px-2.5 text-xs text-primary hover:bg-primary/10 gap-1 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Paket
            </Button>
          </div>
        </DialogHeader>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left 2 Columns: Edit Form */}
            <div className="md:col-span-2 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-name" className="text-xs font-semibold">Nama Paket</Label>
                  <Input 
                    id="plan-name" 
                    value={activePlan.name} 
                    onChange={(e) => handleUpdateActivePlan('name', e.target.value)}
                    placeholder="Contoh: Pro School"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="plan-badge" className="text-xs font-semibold">Teks Badge / Kategori</Label>
                  <Input 
                    id="plan-badge" 
                    value={activePlan.badge} 
                    onChange={(e) => handleUpdateActivePlan('badge', e.target.value)}
                    placeholder="Contoh: Pro / Enterprise / Trial"
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="plan-price" className="text-xs font-semibold">Harga Langganan (Rp)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">Rp</span>
                    <Input 
                      id="plan-price" 
                      type="number"
                      min={0}
                      step={10000}
                      value={activePlan.price} 
                      onChange={(e) => handleUpdateActivePlan('price', Number(e.target.value))}
                      className="pl-9 h-9 text-sm font-semibold"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Isi 0 untuk paket gratis / trial.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="billing-cycle" className="text-xs font-semibold">Teks Satuan Periode</Label>
                  <Input 
                    id="billing-cycle" 
                    value={activePlan.billingCycleText || '/ bln'} 
                    onChange={(e) => handleUpdateActivePlan('billingCycleText', e.target.value)}
                    placeholder="/ bln"
                    className="h-9 text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">Contoh: / bln atau / thn</p>
                </div>
              </div>

              {/* Quota Settings */}
              <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" />
                    Batasan Kuota Akun Pengguna
                  </span>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="popular-switch"
                      checked={!!activePlan.isPopular}
                      onCheckedChange={(checked) => handleUpdateActivePlan('isPopular', checked)}
                    />
                    <Label htmlFor="popular-switch" className="text-xs font-medium cursor-pointer">
                      Label "Paling Populer"
                    </Label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="max-students" className="text-xs font-semibold flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        Maksimal Siswa
                      </Label>
                      <button
                        type="button"
                        onClick={() => handleUpdateActivePlan('maxStudents', activePlan.maxStudents === 0 ? 250 : 0)}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          activePlan.maxStudents === 0 
                            ? 'bg-primary/10 border-primary/30 text-primary font-bold' 
                            : 'bg-background border-border text-muted-foreground'
                        }`}
                      >
                        {activePlan.maxStudents === 0 ? '✓ Unlimited' : 'Set Unlimited'}
                      </button>
                    </div>
                    <Input
                      id="max-students"
                      type="number"
                      disabled={activePlan.maxStudents === 0}
                      value={activePlan.maxStudents === 0 ? '' : activePlan.maxStudents}
                      onChange={(e) => handleUpdateActivePlan('maxStudents', Number(e.target.value))}
                      placeholder={activePlan.maxStudents === 0 ? 'Tanpa Batas (Unlimited)' : 'Contoh: 250'}
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="max-teachers" className="text-xs font-semibold flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        Maksimal Guru / Staff
                      </Label>
                      <button
                        type="button"
                        onClick={() => handleUpdateActivePlan('maxTeachers', activePlan.maxTeachers === 0 ? 25 : 0)}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                          activePlan.maxTeachers === 0 
                            ? 'bg-primary/10 border-primary/30 text-primary font-bold' 
                            : 'bg-background border-border text-muted-foreground'
                        }`}
                      >
                        {activePlan.maxTeachers === 0 ? '✓ Unlimited' : 'Set Unlimited'}
                      </button>
                    </div>
                    <Input
                      id="max-teachers"
                      type="number"
                      disabled={activePlan.maxTeachers === 0}
                      value={activePlan.maxTeachers === 0 ? '' : activePlan.maxTeachers}
                      onChange={(e) => handleUpdateActivePlan('maxTeachers', Number(e.target.value))}
                      placeholder={activePlan.maxTeachers === 0 ? 'Tanpa Batas (Unlimited)' : 'Contoh: 25'}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-2.5">
                <Label className="text-xs font-semibold">Poin Fitur & Fasilitas Paket</Label>
                <div className="space-y-2">
                  {(activePlan.features || []).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={feature}
                        onChange={(e) => {
                          const updated = [...(activePlan.features || [])];
                          updated[idx] = e.target.value;
                          handleUpdateActivePlan('features', updated);
                        }}
                        className="h-8 text-xs bg-background"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFeature(idx)}
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newFeatureText}
                      onChange={(e) => setNewFeatureText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature();
                        }
                      }}
                      placeholder="Ketik poin fitur baru lalu tekan Enter atau klik Tambah..."
                      className="h-8 text-xs bg-muted/40"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleAddFeature}
                      disabled={!newFeatureText.trim()}
                      className="h-8 px-3 text-xs gap-1 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" /> Tambah
                    </Button>
                  </div>
                </div>
              </div>

              {/* Delete Plan Button */}
              {localPlans.length > 1 && (
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePlan(activePlan.id)}
                    className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Paket "{activePlan.name}"
                  </Button>
                </div>
              )}
            </div>

            {/* Right Column: Live Card Preview */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pratinjau Kartu (Preview)
              </Label>
              <Card className={`rounded-2xl border transition-all relative overflow-hidden ${
                activePlan.isPopular 
                  ? 'border-primary/50 bg-primary/5 shadow-md ring-1 ring-primary/20' 
                  : 'border-border bg-card'
              }`}>
                {activePlan.isPopular && (
                  <span className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-bl-xl shadow-xs">
                    Paling Populer
                  </span>
                )}
                <div className="p-5 pb-3">
                  <Badge 
                    variant={activePlan.isPopular ? 'default' : (activePlan.badgeVariant || 'secondary')} 
                    className="w-fit mb-2 text-[11px]"
                  >
                    {activePlan.badge || 'Paket'}
                  </Badge>
                  <h4 className="text-lg font-bold text-foreground">{activePlan.name || 'Nama Paket'}</h4>
                  <div className="mt-2">
                    <span className={`text-2xl font-black ${activePlan.isPopular ? 'text-primary' : 'text-foreground'}`}>
                      {activePlan.price === 0 ? 'Gratis' : `Rp ${activePlan.price.toLocaleString('id-ID')}`}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      {activePlan.billingCycleText || '/ bln'}
                    </span>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-2 text-xs text-muted-foreground space-y-2 border-t border-border/40">
                  <div className="text-[11px] font-semibold text-foreground/80 mb-1">Fasilitas Termasuk:</div>
                  {(activePlan.features || []).map((feat, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                  {(!activePlan.features || activePlan.features.length === 0) && (
                    <p className="italic text-xs text-muted-foreground">Belum ada fitur ditambahkan.</p>
                  )}
                </div>
              </Card>

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 space-y-1 mt-3">
                <p className="font-semibold flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Informasi Sinkronisasi
                </p>
                <p>
                  Perubahan harga dan nama paket di sini akan langsung memperbarui kalkulasi otomatis saat menerbitkan invoice tagihan baru ke sekolah/tenant.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-border bg-card/60 flex items-center justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground hidden sm:block">
            Total {localPlans.length} paket lisensi terdaftar.
          </p>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isUpdating}
            >
              Batal
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isUpdating}
              className="gap-2 shadow-sm"
            >
              <Save className="h-4 w-4" />
              {isUpdating ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
