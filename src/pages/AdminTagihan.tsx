import { Receipt, List, CheckCircle, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MetodePembayaranTab, TagihanListTab, VerifikasiTab } from '@/components/tagihan';

export default function AdminTagihan() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-white/20 bg-white/10 backdrop-blur-sm">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-white">Tagihan</h1>
            <p className="text-sm text-white/70">Kelola tagihan SPP santri</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="daftar" className="space-y-4">
        <TabsList variant="admin" className="grid-cols-3">
          <TabsTrigger variant="admin" value="daftar">
            <List className="h-4 w-4 mr-1.5" /> Daftar Tagihan
          </TabsTrigger>
          <TabsTrigger variant="admin" value="verifikasi">
            <CheckCircle className="h-4 w-4 mr-1.5" /> Verifikasi
          </TabsTrigger>
          <TabsTrigger variant="admin" value="metode">
            <Building2 className="h-4 w-4 mr-1.5" /> Metode Pembayaran
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daftar">
          <TagihanListTab />
        </TabsContent>

        <TabsContent value="verifikasi">
          <VerifikasiTab />
        </TabsContent>

        <TabsContent value="metode">
          <MetodePembayaranTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
