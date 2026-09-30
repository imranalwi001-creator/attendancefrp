import { useState, useMemo } from 'react';
import { Search, Calendar } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useNotifications } from '@/hooks/useNotifications';
import { Skeleton } from '@/components/ui/skeleton';

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NotifikasiUser = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const { notifications, isLoading, markAsRead } = useNotifications();

  const filterByTime = (timestamp: string) => {
    const notifDate = new Date(timestamp);
    const now = new Date();
    
    if (timeFilter === 'today') {
      return notifDate.toDateString() === now.toDateString();
    } else if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return notifDate >= weekAgo;
    } else if (timeFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return notifDate >= monthAgo;
    }
    return true;
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      const matchesSearch =
        notif.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notif.message.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTime = filterByTime(notif.created_at);
      return matchesSearch && matchesTime;
    });
  }, [notifications, searchQuery, timeFilter]);

  const handleRowClick = async (notifId: string, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notifId);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifikasi"
        subtitle="Lihat semua notifikasi Anda"
      />

      {/* Filters & Table */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari notifikasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Pilih waktu" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Waktu</SelectItem>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="week">Minggu Ini</SelectItem>
                  <SelectItem value="month">Bulan Ini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="-mx-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Judul</TableHead>
                  <TableHead>Pesan</TableHead>
                  <TableHead className="w-[180px]">Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredNotifications.length > 0 ? (
                  filteredNotifications.map((notif) => (
                    <TableRow 
                      key={notif.id}
                      onClick={() => handleRowClick(notif.id, notif.is_read)}
                      className={`cursor-pointer ${!notif.is_read ? 'bg-primary/5' : ''}`}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {!notif.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <span>{notif.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {notif.message}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {formatDate(notif.created_at)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Tidak ada notifikasi ditemukan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotifikasiUser;
