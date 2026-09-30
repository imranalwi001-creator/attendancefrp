import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Receipt, Plus, Search, CheckCircle2, Clock, AlertTriangle, 
  CreditCard, DollarSign, ArrowUpRight, Building2, Calendar, 
  FileText, ExternalLink, Printer, Check, Settings as SettingsIcon, Edit3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSaasPlans } from '@/hooks/useSaasPlans';
import { ManageSaasPlansModal } from '@/components/superadmin/ManageSaasPlansModal';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SaasInvoice {
  id: string;
  workspace_id: string;
  invoice_number: string;
  plan_name: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  billing_cycle: 'monthly' | 'annually';
  payment_method: string | null;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  workspaces?: {
    name: string;
    subdomain: string | null;
  } | null;
}

export default function Billing() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // SaaS Plans & Management modal
  const { plans } = useSaasPlans();
  const [isManagePlansOpen, setIsManagePlansOpen] = useState(false);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SaasInvoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Form states
  const [formWorkspaceId, setFormWorkspaceId] = useState('');
  const [formPlanName, setFormPlanName] = useState('Pro School');
  const [formAmount, setFormAmount] = useState(750000);
  const [formCycle, setFormCycle] = useState<'monthly' | 'annually'>('monthly');
  const [formStatus, setFormStatus] = useState<'paid' | 'pending'>('pending');
  const [formMethod, setFormMethod] = useState('Transfer Bank Manual');
  const [formNotes, setFormNotes] = useState('');

  // Fetch invoices with workspace names
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['saas-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saas_invoices')
        .select(`
          *,
          workspaces (
            name,
            subdomain
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SaasInvoice[];
    },
  });

  // Fetch workspaces for dropdown
  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!formWorkspaceId) throw new Error('Pilih sekolah/tenant terlebih dahulu.');
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data, error } = await supabase
        .from('saas_invoices')
        .insert({
          workspace_id: formWorkspaceId,
          invoice_number: invoiceNumber,
          plan_name: formPlanName,
          amount: formAmount,
          billing_cycle: formCycle,
          status: formStatus,
          payment_method: formMethod,
          paid_at: formStatus === 'paid' ? new Date().toISOString() : null,
          notes: formNotes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-invoices'] });
      toast.success('Invoice penagihan baru berhasil diterbitkan');
      setIsAddOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error('Gagal membuat invoice: ' + err.message);
    },
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from('saas_invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'Transfer Bank Diverifikasi Manual',
        })
        .eq('id', invoiceId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saas-invoices'] });
      toast.success('Pembayaran invoice telah diverifikasi (LUNAS)');
    },
    onError: (err: any) => {
      toast.error('Gagal memverifikasi: ' + err.message);
    },
  });

  const resetForm = () => {
    setFormWorkspaceId('');
    setFormPlanName('Pro School');
    setFormAmount(750000);
    setFormCycle('monthly');
    setFormStatus('pending');
    setFormMethod('Transfer Bank Manual');
    setFormNotes('');
  };

  // Metrics calculation
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

  const pendingCount = invoices.filter(inv => inv.status === 'pending').length;
  const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;
  const paidCount = invoices.filter(inv => inv.status === 'paid').length;

  const filteredInvoices = invoices.filter((inv) => {
    const matchSearch = 
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.workspaces?.name && inv.workspaces.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inv.plan_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1.5"><CheckCircle2 className="h-3 w-3" /> Lunas</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1.5"><Clock className="h-3 w-3" /> Menunggu</Badge>;
      case 'overdue':
        return <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 gap-1.5"><AlertTriangle className="h-3 w-3" /> Jatuh Tempo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Billing & Subscriptions" 
          description="Kelola paket lisensi SaaS, terbitkan tagihan invoice ke sekolah/tenant, dan pantau arus pendapatan."
        />
        <Button 
          onClick={() => { resetForm(); setIsAddOpen(true); }}
          className="gap-2 shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> Terbitkan Invoice Baru
        </Button>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Pendapatan Terbayar</p>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600">
                Rp {totalRevenue.toLocaleString('id-ID')}
              </h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Invoice Terbayar (Lunas)</p>
              <h3 className="text-2xl font-bold mt-1 text-foreground">{paidCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Menunggu Pembayaran</p>
              <h3 className="text-2xl font-bold mt-1 text-amber-600">{pendingCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Jatuh Tempo (Overdue)</p>
              <h3 className="text-2xl font-bold mt-1 text-rose-600">{overdueCount}</h3>
            </div>
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Tiers Showcase */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground">Paket Lisensi Platform SaaS</h3>
            <p className="text-xs text-muted-foreground">Tingkatan lisensi resmi, kuota pengguna, dan fasilitas untuk seluruh tenant.</p>
          </div>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => setIsManagePlansOpen(true)}
            className="gap-1.5 text-xs h-8 border-primary/30 text-primary hover:bg-primary/10 w-fit shrink-0"
          >
            <Edit3 className="h-3.5 w-3.5" />
            Kelola Paket Lisensi
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isPopular = plan.isPopular;
            return (
              <Card 
                key={plan.id} 
                className={`rounded-2xl relative overflow-hidden transition-all flex flex-col justify-between ${
                  isPopular 
                    ? 'border-primary/50 bg-primary/5 shadow-xs ring-1 ring-primary/20' 
                    : 'border-border bg-card'
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-0 right-3 bg-primary text-primary-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-b-md shadow-xs">
                    Paling Populer
                  </span>
                )}
                <CardHeader className="p-4 pb-2">
                  <Badge 
                    variant={isPopular ? 'default' : (plan.badgeVariant || 'secondary')} 
                    className="w-fit mb-1 text-[11px]"
                  >
                    {plan.badge || 'Paket'}
                  </Badge>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <p className={`text-2xl font-black mt-1 ${isPopular ? 'text-primary' : ''}`}>
                    {plan.price === 0 ? 'Rp 0' : `Rp ${plan.price.toLocaleString('id-ID')}`}{' '}
                    <span className="text-xs font-normal text-muted-foreground">{plan.billingCycleText || '/ bln'}</span>
                  </p>
                </CardHeader>
                <CardContent className="p-4 pt-2 text-xs text-muted-foreground space-y-1.5 flex-1">
                  {(plan.features || []).map((feat, idx) => (
                    <p key={idx} className="flex items-start gap-1.5">
                      <span className="text-primary font-bold shrink-0">•</span>
                      <span>{feat}</span>
                    </p>
                  ))}
                  {(!plan.features || plan.features.length === 0) && (
                    <p className="italic text-muted-foreground text-xs">• Tidak ada detail fitur</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-3 rounded-2xl border border-border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nomor invoice, nama sekolah, atau paket..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background border-none shadow-none focus-visible:ring-1"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[170px] bg-background">
            <SelectValue placeholder="Status Invoice" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="paid">Lunas</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="overdue">Jatuh Tempo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Nomor Invoice</th>
                <th className="px-5 py-3.5">Instansi Sekolah</th>
                <th className="px-5 py-3.5">Paket Layanan</th>
                <th className="px-5 py-3.5">Nominal</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Jatuh Tempo</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Memuat data tagihan dan invoice...
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    Belum ada invoice yang sesuai dengan kriteria.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-xs text-foreground">
                      {inv.invoice_number}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-foreground">{inv.workspaces?.name || 'Sekolah Tidak Diketahui'}</p>
                      {inv.workspaces?.subdomain && (
                        <p className="text-xs text-muted-foreground font-mono">{inv.workspaces.subdomain}.digiss.app</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-medium text-xs bg-muted px-2 py-0.5 rounded-md text-foreground">
                        {inv.plan_name}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-foreground">
                      Rp {Number(inv.amount).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(inv.status)}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(inv.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      {inv.status !== 'paid' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-500/30 hover:bg-emerald-50"
                          onClick={() => markAsPaidMutation.mutate(inv.id)}
                        >
                          <Check className="h-3.5 w-3.5" /> Tandai Lunas
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 text-xs gap-1.5"
                        onClick={() => { setSelectedInvoice(inv); setIsPreviewOpen(true); }}
                      >
                        <FileText className="h-3.5 w-3.5" /> Detail
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Terbitkan Invoice Baru */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Terbitkan Invoice Baru
            </DialogTitle>
            <DialogDescription>
              Buat tagihan biaya langganan platform SaaS untuk tenant sekolah.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ws">Pilih Instansi / Sekolah <span className="text-rose-500">*</span></Label>
              <Select value={formWorkspaceId} onValueChange={setFormWorkspaceId}>
                <SelectTrigger id="ws">
                  <SelectValue placeholder="Pilih sekolah..." />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws: any) => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Paket Layanan</Label>
              <Select 
                value={formPlanName} 
                onValueChange={(val) => {
                  setFormPlanName(val);
                  const selected = plans.find(p => p.name === val);
                  if (selected) {
                    setFormAmount(selected.price);
                  }
                }}
              >
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Pilih paket lisensi..." />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name} {p.price > 0 ? `(Rp ${p.price.toLocaleString('id-ID')})` : '(Gratis)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Nominal Tagihan (Rp)</Label>
              <Input 
                id="amount" 
                type="number" 
                value={formAmount} 
                onChange={(e) => setFormAmount(Number(e.target.value))} 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status Awal</Label>
              <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Menunggu Pembayaran</SelectItem>
                  <SelectItem value="paid">Langsung Lunas (Sudah Transfer)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan / Keterangan</Label>
              <Input 
                id="notes" 
                placeholder="Contoh: Tagihan Lisensi Semester Genap" 
                value={formNotes} 
                onChange={(e) => setFormNotes(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Batal</Button>
            <Button 
              onClick={() => createInvoiceMutation.mutate()}
              disabled={!formWorkspaceId || createInvoiceMutation.isPending}
            >
              {createInvoiceMutation.isPending ? 'Menerbitkan...' : 'Terbitkan Invoice'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Preview Invoice */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Detail Invoice
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4 py-2 border rounded-xl p-4 bg-card">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-mono text-sm font-bold text-primary">{selectedInvoice.invoice_number}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Diterbitkan: {new Date(selectedInvoice.created_at).toLocaleDateString('id-ID')}
                  </p>
                </div>
                {getStatusBadge(selectedInvoice.status)}
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Tertuju Kepada:</p>
                  <p className="font-bold text-foreground">{selectedInvoice.workspaces?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paket Layanan:</p>
                  <p className="font-medium text-foreground">{selectedInvoice.plan_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Metode Pembayaran:</p>
                  <p className="font-medium text-foreground">{selectedInvoice.payment_method || 'Transfer Bank'}</p>
                </div>
                <div className="pt-2 border-t flex justify-between items-center">
                  <p className="font-bold text-base">Total Tagihan:</p>
                  <p className="font-black text-lg text-primary">
                    Rp {Number(selectedInvoice.amount).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Kelola Paket Lisensi SaaS */}
      <ManageSaasPlansModal 
        open={isManagePlansOpen} 
        onOpenChange={setIsManagePlansOpen} 
      />
    </div>
  );
}
