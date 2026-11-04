import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/apiClient';
import { UserProfile } from '@/types/hrm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Send,
  ExternalLink,
  Phone,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface HrmPersonalWhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onPhoneUpdated?: (newPhone: string) => void;
}

export const HrmPersonalWhatsAppModal: React.FC<HrmPersonalWhatsAppModalProps> = ({
  open,
  onClose,
  user,
  onPhoneUpdated,
}) => {
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Pemberitahuan Khusus Superadmin');
  const [selectedTemplate, setSelectedTemplate] = useState('welcome_face');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const getTemplateText = (key: string, targetUser: UserProfile | null): string => {
    const name = targetUser?.fullName || 'Rekan Karyawan';
    const nip = targetUser?.nip || '-';
    const div = targetUser?.divisionName || 'Operasional Lapangan';

    switch (key) {
      case 'welcome_face':
        return `Halo Bpk/Ibu *${name}* (NIP: *${nip}*),\n\nSelamat! Pendaftaran wajah master biometrik dan akun presensi Anda di sistem HRM *PT. FAWWAZ RESKI PERWIRA* telah *BERHASIL DIVERIFIKASI*.\n\n📋 *Rincian Akun Terdaftar:*\n• NIP: ${nip}\n• Divisi: ${div}\n• Status Biometrik: Aktif & Terverifikasi (AI Face Recognition)\n\n🔒 *Panduan Presensi Mobile (PWA):*\n1. Buka aplikasi PWA: https://fawwazreskiperwira.com\n2. Masuk menggunakan akun Anda.\n3. Lakukan presensi masuk (Clock-In) dan pulang (Clock-Out) tepat waktu di radius titik pos tugas yang ditentukan dengan verifikasi biometrik wajah.\n4. Pastikan GPS ponsel aktif dengan akurasi yang baik.\n\nSelamat bertugas dan utamakan keselamatan kerja.\n\n_Pesan resmi Sistem HRM Terpadu PT. FAWWAZ RESKI PERWIRA._`;

      case 'announcement':
        return `Yth. Bpk/Ibu *${name}* (NIP: *${nip}*),\n\nBerikut adalah pemberitahuan penting dari Manajemen *PT. FAWWAZ RESKI PERWIRA*:\n\n[Tuliskan poin pengumuman di sini]\n\nHarap informasi ini diperhatikan dan dilaksanakan sebaik-baiknya. Terima kasih.\n\n_Manajemen PT. FAWWAZ RESKI PERWIRA_`;

      case 'summon':
        return `Yth. Bpk/Ibu *${name}* (NIP: *${nip}*),\n\nDiharapkan kehadiran Anda untuk menghadap Manajemen / HRD PT. FAWWAZ RESKI PERWIRA pada:\n• Hari/Tanggal: {tanggal}\n• Waktu: [Jam WITA]\n• Tempat: Kantor Operasional PT FRP\n• Agenda: Koordinasi Tugas & Evaluasi Kinerja\n\nMohon konfirmasi kesiapan Anda. Terima kasih.\n\n_HRD & Operasional PT. FAWWAZ RESKI PERWIRA_`;

      case 'discipline':
        return `*PEMBERITAHUAN KEDISIPLINAN PRESENSI*\nYth. Bpk/Ibu *${name}* (NIP: *${nip}*),\n\nBerdasarkan audit pemantauan sistem presensi PT. FAWWAZ RESKI PERWIRA per {tanggal}:\nAnda terdeteksi belum melakukan presensi atau memiliki catatan ketidakhadiran tanpa keterangan.\n\nHarap segera berkoordinasi dengan Korlap atau Admin Lapangan untuk klarifikasi data kehadiran Anda. Kedisiplinan tugas adalah prioritas perusahaan.\n\n_Manajemen PT. FAWWAZ RESKI PERWIRA_`;

      case 'urgent_field':
        return `🚨 *INSTRUKSI PENUGASAN LAPANGAN SEGERA*\nYth. Bpk/Ibu *${name}* (NIP: *${nip}*),\n\nTerdapat arahan penugasan operasional mendesak:\n• Lokasi Tugas: [Pos Penugasan]\n• Waktu: Pk [Jam] WITA\n• Rincian: [Keterangan Tugas Lapangan]\n\nHarap segera merapat ke lokasi pos tugas dan pastikan melakukan presensi di radius pos.\n\n_Operasional Lapangan PT. FAWWAZ RESKI PERWIRA_`;

      case 'custom':
      default:
        return `Yth. Bpk/Ibu *${name}* (NIP: *${nip}*),\n\n[Tulis pesan Anda di sini]\n\nTerima kasih.\n\n_PT. FAWWAZ RESKI PERWIRA_`;
    }
  };

  useEffect(() => {
    if (open && user) {
      const uPhone = user.phone || '';
      setPhone(uPhone);
      const isEnrolled = Boolean(user.isFaceEnrolled || user.faceEnrolledPhoto || (user as any).face_enrolled_photo || (user as any).facePhotoUrl);
      const defaultTpl = isEnrolled ? 'welcome_face' : 'announcement';
      setSelectedTemplate(defaultTpl);
      setMessage(getTemplateText(defaultTpl, user));
      setSubject(defaultTpl === 'welcome_face' ? 'Konfirmasi Verifikasi Biometrik Wajah' : 'Pemberitahuan Khusus Superadmin');
    }
  }, [open, user]);

  const handleTemplateChange = (val: string) => {
    setSelectedTemplate(val);
    setMessage(getTemplateText(val, user));
    if (val === 'welcome_face') setSubject('Konfirmasi Verifikasi Biometrik Wajah');
    else if (val === 'announcement') setSubject('Pemberitahuan Penting Manajemen');
    else if (val === 'summon') setSubject('Panggilan Menghadap Manajemen/HRD');
    else if (val === 'discipline') setSubject('Pemberitahuan Kedisiplinan Presensi');
    else if (val === 'urgent_field') setSubject('Instruksi Penugasan Lapangan Mendesak');
    else setSubject('Pemberitahuan Khusus Superadmin');
  };

  const insertTag = (tag: string) => {
    setMessage((prev) => `${prev} ${tag}`);
  };

  const handleSendViaGateway = async () => {
    if (!user) return;
    const clean = phone.replace(/\D/g, '');
    if (!clean || clean.length < 9) {
      toast.error('Nomor WhatsApp tidak valid atau belum terisi. Mohon lengkapi nomor telepon karyawan.');
      return;
    }
    if (!message.trim()) {
      toast.error('Isi pesan WhatsApp tidak boleh kosong.');
      return;
    }

    try {
      setIsSending(true);
      const res = await api.post<{ success: boolean; message: string }>('/whatsapp/send-personal', {
        userId: user.id,
        phone: phone.trim(),
        message: message.trim(),
        subject: subject.trim(),
      });

      if (res && res.success) {
        toast.success(res.message || `Pesan WhatsApp berhasil dikirim ke ${user.fullName}`);
        if (onPhoneUpdated && phone.trim() !== (user.phone || '').trim()) {
          onPhoneUpdated(phone.trim());
        }
        onClose();
      } else {
        toast.error((res as any)?.error || 'Gagal mengirim pesan WhatsApp via gateway.');
      }
    } catch (err: any) {
      console.error('[Send Personal WA Error]:', err);
      toast.error(err?.response?.data?.error || err.message || 'Gagal mengirim pesan WhatsApp.');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenWhatsAppDirect = () => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (!clean.startsWith('62')) clean = '62' + clean;

    const encoded = encodeURIComponent(
      message
        .replace(/{nama}/gi, user?.fullName || 'Rekan Karyawan')
        .replace(/{nip}/gi, user?.nip || '-')
        .replace(/{divisi}/gi, user?.divisionName || 'Operasional')
    );
    window.open(`https://wa.me/${clean}?text=${encoded}`, '_blank');
  };

  if (!user) return null;

  const isEnrolled = Boolean(user.isFaceEnrolled || user.faceEnrolledPhoto || (user as any).face_enrolled_photo || (user as any).facePhotoUrl);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 border-border shadow-2xl">
        <DialogHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Kirim Pesan WhatsApp Personal
                <Badge className="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider">
                  Superadmin
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Kirimkan notifikasi langsung ke WhatsApp karyawan terverifikasi atau buka percakapan resmi.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Info Karyawan Ringkas */}
        <div className="bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {user.fullName.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-foreground truncate">{user.fullName}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {user.nip} • {user.divisionName || 'Operasional'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEnrolled ? (
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] rounded-full gap-1 font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Wajah Terdaftar
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 text-[10px] rounded-full gap-1 font-semibold">
                <ShieldAlert className="w-3 h-3 text-amber-600" />
                Belum Registrasi Wajah
              </Badge>
            )}
            {user.welcomeWaSent ? (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 text-[10px] rounded-full gap-1 font-semibold" title={user.welcomeWaSentAt ? `Terkirim pada ${new Date(user.welcomeWaSentAt).toLocaleString('id-ID')}` : 'Notifikasi selamat datang sudah terkirim'}>
                <CheckCircle2 className="w-3 h-3 text-blue-600" />
                WA Sambutan Terkirim
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 text-[10px] rounded-full gap-1 font-semibold">
                Belum Ada WA Sambutan
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-1">
          {/* Nomor WhatsApp */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                Nomor WhatsApp Karyawan
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Format: 08xx / 628xx
              </span>
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Contoh: 081234567890"
              className="text-xs rounded-xl font-mono"
            />
          </div>

          {/* Pemilih Template Cepat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Pilih Template Pesan
              </Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger className="text-xs rounded-xl">
                  <SelectValue placeholder="Pilih Template..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome_face">1. Selamat! Registrasi Wajah & Akun</SelectItem>
                  <SelectItem value="announcement">2. Pengumuman Resmi Manajemen</SelectItem>
                  <SelectItem value="summon">3. Panggilan Menghadap Manajemen/HRD</SelectItem>
                  <SelectItem value="discipline">4. Peringatan Kedisiplinan Presensi</SelectItem>
                  <SelectItem value="urgent_field">5. Instruksi Penugasan Mendesak</SelectItem>
                  <SelectItem value="custom">6. Tulis Pesan Kustom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                Perihal / Subjek Notifikasi
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subjek notifikasi..."
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Area Pesan */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Isi Pesan WhatsApp</Label>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>Variabel:</span>
                <button
                  type="button"
                  onClick={() => insertTag('{nama}')}
                  className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono"
                >
                  {'{nama}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{nip}')}
                  className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono"
                >
                  {'{nip}'}
                </button>
                <button
                  type="button"
                  onClick={() => insertTag('{tanggal}')}
                  className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10px] font-mono"
                >
                  {'{tanggal}'}
                </button>
              </div>
            </div>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              placeholder="Tulis pesan lengkap..."
              className="text-xs rounded-2xl resize-none font-sans leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground text-right">
              {message.length} karakter
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2 gap-2 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl text-xs"
            disabled={isSending}
          >
            Batal
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleOpenWhatsAppDirect}
            className="rounded-xl text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
            disabled={isSending || !phone}
            title="Buka langsung di Web WhatsApp / Aplikasi WhatsApp"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka di WhatsApp Web
          </Button>

          <Button
            type="button"
            onClick={handleSendViaGateway}
            disabled={isSending || !phone || !message.trim()}
            className="rounded-xl text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Mengirim Pesan...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Kirim via Gateway WhatsApp
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

