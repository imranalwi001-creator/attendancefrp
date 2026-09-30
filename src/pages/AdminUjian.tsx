import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileQuestion, Database } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAutoEndExpiredExams } from '@/hooks/useUjian';
import UjianListTab from '@/components/ujian/UjianListTab';
import BankSoalTab from '@/components/ujian/BankSoalTab';

export default function AdminUjian() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('daftar');
  const autoEndExpiredExams = useAutoEndExpiredExams();

  // Auto-end expired exams on page load
  useEffect(() => {
    autoEndExpiredExams.mutate();
  }, []);

  return (
    <div className="container mx-auto p-4 pb-24 space-y-6">
      {/* Header */}
      <PageHeader title="Kelola Ujian & Bank Soal" subtitle="Atur ujian dan kelola koleksi soal">
        {activeTab === 'daftar' && (
          <Button onClick={() => navigate('/admin/ujian/baru')}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Ujian
          </Button>
        )}
      </PageHeader>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="admin" className="grid grid-cols-2">
          <TabsTrigger value="daftar" variant="admin">
            <FileQuestion className="h-4 w-4 mr-2" />
            Daftar Ujian
          </TabsTrigger>
          <TabsTrigger value="bank-soal" variant="admin">
            <Database className="h-4 w-4 mr-2" />
            Bank Soal
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daftar">
          <UjianListTab />
        </TabsContent>

        <TabsContent value="bank-soal">
          <BankSoalTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
