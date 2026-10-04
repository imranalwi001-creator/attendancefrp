import React, { useState, useEffect } from 'react';
import { UserProfile, Division, FieldAssignedPost } from '@/types/hrm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { MapPin, Navigation, Crosshair, CheckCircle2, Radio, Loader2, Trash2, Plus, Building2, BellRing, Smartphone } from 'lucide-react';
import { fieldSentinelService } from '@/services/fieldSentinelService';

interface HrmAssignFieldLocationModalProps {
  open: boolean;
  user: UserProfile | null;
  divisions?: Division[];
  onClose: () => void;
  onSuccess?: (updatedUser?: UserProfile) => void;
  onSaved?: (updatedUser?: UserProfile) => void;
}

export const HrmAssignFieldLocationModal: React.FC<HrmAssignFieldLocationModalProps> = ({
  open,
  user,
  divisions = [],
  onClose,
  onSuccess,
  onSaved,
}) => {
  const [savedPosts, setSavedPosts] = useState<FieldAssignedPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Form states for new post
  const [postCode, setPostCode] = useState('POS-A');
  const [postName, setPostName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [description, setDescription] = useState('');
  const [copyToAll, setCopyToAll] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Fetch saved posts when modal opens
  const loadPosts = async () => {
    if (!user) return;
    setIsLoadingPosts(true);
    try {
      const posts = await fieldSentinelService.getFieldPosts(user.id);
      setSavedPosts(posts);

      // Auto calculate next post code (POS-A, POS-B, POS-C, ...)
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const nextIndex = posts.length;
      if (nextIndex < letters.length) {
        setPostCode(`POS-${letters[nextIndex]}`);
      }
    } catch (err) {
      console.warn('Load posts error:', err);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (user && open) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setPostName('');
      setLatitude('');
      setLongitude('');
      setRadiusMeters(150);
      loadPosts();
    }
  }, [user, open]);

  // 2. Read live device GPS
  const handleUseCurrentGps = () => {
    if (!navigator.geolocation) {
      alert('Peramban Anda tidak mendukung geolokasi GPS.');
      return;
    }
    setIsDetectingGps(true);
    setErrorMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsDetectingGps(false);
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      (err) => {
        setIsDetectingGps(false);
        alert('Gagal mendeteksi koordinat GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // 3. Save new post to Bank Pos Lapangan
  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMsg('Harap masukkan koordinat Latitude dan Longitude yang valid.');
      return;
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setErrorMsg('Nilai koordinat tidak valid (Latitude: -90 s/d 90, Longitude: -180 s/d 180).');
      return;
    }

    if (!postName.trim()) {
      setErrorMsg('Nama Pos wajib diisi (contoh: Pos A - Dermaga FRP).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await fieldSentinelService.saveFieldPost({
        userId: user.id,
        postCode: postCode.trim().toUpperCase(),
        postName: postName.trim(),
        latitude: latNum,
        longitude: lngNum,
        radiusMeters: radiusMeters,
        description: description.trim(),
        copyToAllFieldAgents: copyToAll,
      });

      setSuccessMsg(`Pos ${postName} (${postCode}) berhasil disimpan ke Bank Pos!`);
      setPostName('');
      setLatitude('');
      setLongitude('');
      setDescription('');
      await loadPosts();

      if (typeof onSuccess === 'function') onSuccess();
      if (typeof onSaved === 'function') onSaved();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan titik pos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 4. Delete post from bank
  const handleDeletePost = async (postId: string, pName: string) => {
    if (!confirm(`Hapus titik pos "${pName}" dari Bank Pos Lapangan?`)) return;
    setDeletingId(postId);
    try {
      await fieldSentinelService.deleteFieldPost(postId);
      await loadPosts();
      if (typeof onSuccess === 'function') onSuccess();
      if (typeof onSaved === 'function') onSaved();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus pos.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl p-6 border-border shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left space-y-1.5 border-b border-border pb-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
              <Radio className="w-3.5 h-3.5" />
              <span>Multi-Titik / Bank Pos Lapangan</span>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {savedPosts.length} Pos Terdaftar
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            Bank Pos &amp; Titik Tugas Khusus: {user.fullName}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            Daftarkan titik tugas (Titik A, B, C, dst.) agar tersimpan permanen dan tidak saling menimpa. Sistem otomatis mengirim notifikasi real-time &amp; WhatsApp ke Pimpinan setiap kali petugas terdeteksi tiba di salah satu pos ini.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl mt-3">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl mt-3 flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-5 pt-3">
          {/* ─── SECTION 1: DAFTAR POS YANG SUDAH TERSIMPAN ─── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <MapPin size={13} className="text-indigo-600" />
                Daftar Pos Terdaftar ({savedPosts.length} Titik Sah):
              </Label>
              <span className="text-[11px] text-muted-foreground">Karyawan sah absen di titik manapun di bawah</span>
            </div>

            {isLoadingPosts ? (
              <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin text-primary" /> Memuat daftar pos...
              </div>
            ) : savedPosts.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-border/80 text-center text-xs text-muted-foreground bg-muted/20">
                Belum ada titik pos terdaftar untuk petugas ini. Tambahkan Titik A melalui formulir di bawah.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                {savedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-3 bg-card rounded-xl border border-border/80 hover:border-indigo-500/50 transition-all flex items-start justify-between gap-2 shadow-2xs"
                  >
                    <div className="space-y-1 text-xs flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-indigo-600 text-white font-mono text-[9px] px-1.5 py-0">
                          {post.postCode}
                        </Badge>
                        <span className="font-bold text-foreground truncate" title={post.postName}>
                          {post.postName}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground truncate">
                        {post.latitude.toFixed(6)}, {post.longitude.toFixed(6)}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                        <span>Radius: {post.radiusMeters} Meter</span>
                        {post.description && (
                          <span className="text-muted-foreground truncate">• {post.description}</span>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === post.id}
                      onClick={() => handleDeletePost(post.id, post.postName)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-lg shrink-0"
                      title="Hapus titik pos ini dari bank"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── SECTION 2: FORM TAMBAH TITIK POS BARU ─── */}
          <form onSubmit={handleAddPost} className="p-4 bg-muted/30 border border-border rounded-2xl space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <Plus size={13} className="text-emerald-600" />
                Tambah Titik Pos Baru ke Bank:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleUseCurrentGps}
                disabled={isDetectingGps}
                className="text-xs h-7 rounded-lg gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                {isDetectingGps ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mendeteksi GPS...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Ambil Koordinat Saya Saat Ini</span>
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kode Pos:</Label>
                <Input
                  placeholder="POS-A / POS-B"
                  value={postCode}
                  onChange={(e) => setPostCode(e.target.value.toUpperCase())}
                  className="text-xs font-mono rounded-xl h-8"
                  required
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-medium">Nama Pos / Titik Tugas:</Label>
                <Input
                  placeholder="Contoh: Pos A - Dermaga FRP / Pos B - Gudang"
                  value={postName}
                  onChange={(e) => setPostName(e.target.value)}
                  className="text-xs rounded-xl h-8"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Latitude:</Label>
                <Input
                  placeholder="-3.978210"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="text-xs font-mono rounded-xl h-8"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Longitude:</Label>
                <Input
                  placeholder="122.589140"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="text-xs font-mono rounded-xl h-8"
                  required
                />
              </div>
            </div>

            {/* Radius Options */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Radius Toleransi Kerja (Perimeter):</Label>
                <span className="font-bold text-primary font-mono">{radiusMeters} Meter</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[50, 100, 150, 200, 500].map((r) => (
                  <Button
                    key={r}
                    type="button"
                    variant={radiusMeters === r ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRadiusMeters(r)}
                    className="text-xs h-7 rounded-lg font-mono"
                  >
                    {r}m
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">Catatan / Deskripsi Lokasi (Opsional):</Label>
              <Input
                placeholder="Contoh: Area gerbang utama, dermaga sisi timur..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs rounded-xl h-8"
              />
            </div>

            {/* Checkbox: Copy to all 3 Field Agents */}
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="copyToAll"
                checked={copyToAll}
                onCheckedChange={(checked) => setCopyToAll(Boolean(checked))}
              />
              <label
                htmlFor="copyToAll"
                className="text-xs font-medium text-foreground cursor-pointer select-none"
              >
                Terapkan titik ini juga ke ke-3 petugas lapangan sekaligus (Aslam, La Unga, Takdir)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-8 px-4 font-semibold gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <Plus size={13} /> Simpan ke Bank Pos Lapangan
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Feature Info Box */}
          <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-800/50 text-[11px] space-y-1 text-muted-foreground">
            <p className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <BellRing size={12} /> Aturan Otomatisasi Notifikasi Multi-Titik:
            </p>
            <p className="leading-relaxed">
              Saat petugas berada di <strong>Titik A</strong>, sistem otomatis mengirim notifikasi radar &amp; pesan WhatsApp ke nomor HP Pimpinan dan Superadmin. Demikian juga saat petugas berpindah ke <strong>Titik B</strong>, <strong>Titik C</strong>, dst. Petugas terjamin sah absen di salah satu titik yang tersimpan di atas.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end pt-3 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl text-xs h-8 px-4"
          >
            Selesai &amp; Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
