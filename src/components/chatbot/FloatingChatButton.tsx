import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageCircle,
  PenTool,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChatMessage } from './ChatMessage';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  text: string;
  apiContent?: string;
  isBot: boolean;
  timestamp: Date;
}

type AssistantMode = 'teacher' | 'student';
type LearningEffort = 'belum_mencoba' | 'butuh_petunjuk' | 'sudah_mencoba' | 'cek_jawaban';

const TEACHER_ROLES = ['guru', 'walikelas', 'pembina', 'guru_ekskul'];

type MapelOption = {
  id: string;
  nama: string;
  kelasLabel?: string;
};

type MapelContext = {
  id: string;
  nama: string;
  kelasLabel?: string;
};

const STUDENT_CHEATING_PATTERNS = [
  /jawab(?:kan)?\s+(semua|langsung|aja|saja)/i,
  /jawaban(?:nya)?\s+(saja|aja|langsung)/i,
  /kerjakan\s+(semua|tugas|pr|soal)/i,
  /buatkan\s+(tugas|pr|jawaban)\s+(lengkap|full|semua)?/i,
  /tanpa\s+penjelasan/i,
  /jangan\s+(pakai|beri)\s+penjelasan/i,
  /biar\s+guru\s+(tidak|nggak|gak)\s+tahu/i,
  /cara\s+(curang|mencontek|nyontek)/i,
  /cheat|bypass|contekan/i,
];

const getMode = (role?: string): AssistantMode | null => {
  const normalizedRole = role?.toLowerCase();
  if (normalizedRole === 'santri') return 'student';
  if (normalizedRole && TEACHER_ROLES.includes(normalizedRole)) return 'teacher';
  return null;
};

const getModeCopy = (mode: AssistantMode) => {
  if (mode === 'teacher') {
    return {
      label: 'Teaching Copilot',
      badge: 'Teacher Mode',
      intro: 'Saya siap membantu menyiapkan pembelajaran, evaluasi, rubrik, dan analisis kelas. Draft AI tetap perlu ditinjau guru sebelum digunakan.',
    };
  }
  if (mode === 'student') {
    return {
      label: 'Socratic Tutor',
      badge: 'Student Mode',
      intro: 'Saya akan membantumu memahami konsep, memberi petunjuk bertahap, dan mengecek usahamu. Saya tidak menggantikan proses berpikirmu.',
    };
  }
};

const getWelcomeMessage = (mode: AssistantMode): Message => ({
  id: 'welcome',
  text: `Halo! Saya RuangBlajar AI dari ruangblajar.com.\n\n${getModeCopy(mode).intro}\n\nBelajar, berkembang, berkarya.`,
  isBot: true,
  timestamp: new Date(),
});

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const AI_LAST_MAPEL_ID_KEY = 'rb:ai:lastMapelId';

export function FloatingChatButton() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const assistantMode = useMemo(() => getMode(user?.role), [user?.role]);
  const modeCopy = useMemo(() => assistantMode ? getModeCopy(assistantMode) : null, [assistantMode]);
  const [messages, setMessages] = useState<Message[]>(() => [getWelcomeMessage('student')]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [learningEffort, setLearningEffort] = useState<LearningEffort>('butuh_petunjuk');
  const [mapelOptions, setMapelOptions] = useState<MapelOption[]>([]);
  const [selectedMapelId, setSelectedMapelId] = useState<string | null>(null);
  const [lockedMapelId, setLockedMapelId] = useState<string | null>(null);
  const [isMapelLoading, setIsMapelLoading] = useState(false);
  const [activeMapel, setActiveMapel] = useState<MapelContext | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const routeMapelId = useMemo(() => {
    const path = location.pathname;
    const match = path.match(/\/(?:app|admin)\/mapel\/([^/?#]+)/i);
    return match?.[1] ?? null;
  }, [location.pathname]);

  const formatKelasLabel = useCallback((kelas: any) => {
    if (!kelas) return undefined;
    const nama = typeof kelas?.nama === 'string' ? kelas.nama : null;
    const tingkat = kelas?.tingkat != null ? String(kelas.tingkat) : null;
    if (nama && tingkat) return `${nama} (Tingkat ${tingkat})`;
    return nama ?? tingkat ?? undefined;
  }, []);

  const fetchMapelById = useCallback(async (mapelId: string): Promise<MapelContext | null> => {
    const { data, error } = await supabase
      .from('mapel')
      .select('id,nama,kelas:kelas_id(nama,tingkat)')
      .eq('id', mapelId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      id: data.id,
      nama: data.nama,
      kelasLabel: formatKelasLabel((data as any).kelas),
    };
  }, [formatKelasLabel]);

  const fetchMapelOptions = useCallback(async () => {
    if (!assistantMode || !user?.id) return;

    setIsMapelLoading(true);
    try {
      if (assistantMode === 'teacher') {
        const { data, error } = await supabase
          .from('mapel')
          .select('id,nama,kelas:kelas_id(nama,tingkat),status')
          .eq('pengampu_id', user.id)
          .order('nama', { ascending: true });

        if (error) throw error;
        const opts = (data ?? []).map((m: any) => ({
          id: m.id,
          nama: m.nama,
          kelasLabel: formatKelasLabel(m.kelas),
        }));
        setMapelOptions(opts);
        return;
      }

      // student: detect kelas from santri row, then load mapel by kelas_id
      const { data: santri, error: santriErr } = await supabase
        .from('santri')
        .select('kelas_id')
        .eq('id', user.id)
        .maybeSingle();
      if (santriErr) throw santriErr;

      const kelasId = (santri as any)?.kelas_id as string | null | undefined;
      if (!kelasId) {
        setMapelOptions([]);
        return;
      }

      const { data: mapel, error: mapelErr } = await supabase
        .from('mapel')
        .select('id,nama,kelas:kelas_id(nama,tingkat),status')
        .eq('kelas_id', kelasId)
        .order('nama', { ascending: true });
      if (mapelErr) throw mapelErr;

      const opts = (mapel ?? []).map((m: any) => ({
        id: m.id,
        nama: m.nama,
        kelasLabel: formatKelasLabel(m.kelas),
      }));
      setMapelOptions(opts);
    } catch (e) {
      console.error('Failed to load mapel options:', e);
      setMapelOptions([]);
    } finally {
      setIsMapelLoading(false);
    }
  }, [assistantMode, user?.id, formatKelasLabel]);

  // Resolve selected mapel (route-locked > explicit selection > last used)
  useEffect(() => {
    if (!assistantMode) return;

    if (routeMapelId) {
      setLockedMapelId(routeMapelId);
      setSelectedMapelId(routeMapelId);
      try { localStorage.setItem(AI_LAST_MAPEL_ID_KEY, routeMapelId); } catch { /* ignore */ }
      return;
    }

    setLockedMapelId(null);
    if (selectedMapelId) return;

    try {
      const last = localStorage.getItem(AI_LAST_MAPEL_ID_KEY);
      if (last) setSelectedMapelId(last);
    } catch { /* ignore */ }
  }, [assistantMode, routeMapelId, selectedMapelId]);

  // Load mapel options when chat opens (and when role changes)
  useEffect(() => {
    if (!isOpen) return;
    void fetchMapelOptions();
  }, [isOpen, fetchMapelOptions]);

  // Load active mapel display data (for header context bar + payload)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const mapelId = selectedMapelId;
      if (!mapelId) {
        setActiveMapel(null);
        return;
      }

      const fromOptions = mapelOptions.find((m) => m.id === mapelId);
      if (fromOptions) {
        setActiveMapel({ id: fromOptions.id, nama: fromOptions.nama, kelasLabel: fromOptions.kelasLabel });
        return;
      }

      const fetched = await fetchMapelById(mapelId);
      if (!cancelled) setActiveMapel(fetched);
    };

    void run();
    return () => { cancelled = true; };
  }, [selectedMapelId, mapelOptions, fetchMapelById]);

  const quickActions = useMemo(() => {
    if (assistantMode === 'teacher') {
      return [
        { label: 'Buat Soal HOTS', icon: PenTool, prompt: 'Bantu saya membuat draft soal HOTS yang sesuai materi dan tingkat kelas. Tanyakan mapel, kelas, materi, jumlah soal, dan bentuk soal jika belum jelas.' },
        { label: 'RPP Singkat', icon: BookOpen, prompt: 'Bantu saya menyusun draft RPP singkat. Tanyakan tujuan pembelajaran, kelas, mapel, durasi, dan aktivitas kelas jika belum jelas.' },
        { label: 'Analisis Nilai', icon: Target, prompt: 'Bantu analisis performa belajar kelas dan berikan rekomendasi remedial/pengayaan. Gunakan data yang relevan jika tersedia dan sesuai hak akses.' },
        { label: 'Feedback Tugas', icon: CheckCircle2, prompt: 'Bantu saya membuat feedback tugas yang konstruktif, spesifik, dan mudah dipahami siswa. Tanyakan konteks tugas jika belum jelas.' },
      ];
    }
    if (assistantMode === 'student') {
      return [
        { label: 'Jelaskan Konsep', icon: BookOpen, prompt: 'Saya ingin memahami konsep dari materi ini. Jelaskan bertahap, beri analogi sederhana, lalu beri quiz mini tanpa langsung memberi jawaban tugas.' },
        { label: 'Petunjuk Bertahap', icon: Lightbulb, prompt: 'Beri saya petunjuk bertahap untuk memahami soal. Jangan berikan jawaban akhir. Mulai dari konsep dan langkah pertama.' },
        { label: 'Cek Pemahaman', icon: Brain, prompt: 'Uji pemahaman saya dengan beberapa pertanyaan singkat. Beri feedback setelah saya menjawab.' },
        { label: 'Cek Jawaban Saya', icon: CheckCircle2, prompt: 'Saya akan mengirim jawaban saya. Tolong cek proses berpikir dan berikan koreksi tanpa menggantikan usaha saya.' },
      ];
    }
    return [];
  }, [assistantMode]);

  useEffect(() => {
    if (assistantMode) {
      setMessages([getWelcomeMessage(assistantMode)]);
    }
  }, [assistantMode]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) viewport.scrollTop = viewport.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, scrollToBottom]);

  const shouldBlockStudentPrompt = (text: string) => (
    assistantMode === 'student' && STUDENT_CHEATING_PATTERNS.some((pattern) => pattern.test(text))
  );

  const handleSend = async (overrideText?: string, displayText?: string) => {
    const trimmed = (overrideText ?? input).trim();
    if (!assistantMode || !trimmed || isLoading) return;
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const s = Math.max(1, Math.ceil((cooldownUntil - Date.now()) / 1000));
      toast.error(`Terlalu banyak permintaan. Coba lagi dalam ${s} detik.`);
      return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      text: displayText || trimmed,
      apiContent: displayText ? trimmed : undefined,
      isBot: false,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    if (shouldBlockStudentPrompt(trimmed)) {
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          isBot: true,
          timestamp: new Date(),
          text: 'Saya tidak bisa memberikan jawaban langsung atau membantu mencontek.\n\nSaya bisa bantu dengan cara yang aman:\n- menjelaskan konsep yang dipakai,\n- memberi petunjuk langkah pertama,\n- membuat contoh soal serupa,\n- mengecek jawaban yang sudah kamu coba.\n\nKirim bagian yang sudah kamu pahami atau pilih **Petunjuk Bertahap**.',
        },
      ]);
      return;
    }

    // Build conversation history for API
    const apiMessages = updatedMessages
      .filter(m => m.id !== 'welcome')
      .map(m => ({
        role: m.isBot ? 'assistant' as const : 'user' as const,
        content: m.apiContent || m.text,
      }));

    const botMsgId = crypto.randomUUID();
    let assistantSoFar = '';

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const mapelContext = activeMapel ? {
        id: activeMapel.id,
        nama: activeMapel.nama,
        kelasLabel: activeMapel.kelasLabel,
      } : null;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          messages: apiMessages,
          userContext: user ? {
            name: user.name,
            role: user.role,
            userId: user.id,
            assistantMode,
            activePath: location.pathname,
            learningEffort: assistantMode === 'student' ? learningEffort : undefined,
            mapelContext,
            contextLocked: Boolean(lockedMapelId),
            contextSource: lockedMapelId ? 'route' : (selectedMapelId ? 'picker' : null),
          } : null,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          toast.error('Terlalu banyak permintaan, coba lagi nanti.');
          // Cooldown to prevent spamming and to improve UX.
          setCooldownUntil(Date.now() + 30_000);
        } else if (resp.status === 402) {
          toast.error('Kuota AI habis, hubungi admin.');
        } else {
          toast.error(errData.error || 'Gagal menghubungi AI.');
        }
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (content: string) => {
        assistantSoFar = content;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === botMsgId) {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, text: content } : m);
          }
          return [...prev, { id: botMsgId, text: content, isBot: true, timestamp: new Date() }];
        });
        scrollToBottom();
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              upsertAssistant(assistantSoFar);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              upsertAssistant(assistantSoFar);
            }
          } catch { /* ignore */ }
        }
      }

      // If no response received
      if (!assistantSoFar) {
        upsertAssistant('Maaf, saya tidak bisa memproses permintaan Anda saat ini. Coba lagi nanti.');
      }
    } catch (e) {
      console.error('Chat error:', e);
      toast.error('Gagal terhubung ke server.');
      setMessages(prev => [
        ...prev,
        { id: botMsgId, text: 'Maaf, terjadi kesalahan. Silakan coba lagi.', isBot: true, timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  if (!assistantMode || !modeCopy) return null;

  return (
    <>
      {isOpen && (
        <div className={cn(
          'fixed z-50 flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden',
          'animate-in fade-in-0 slide-in-from-bottom-4 duration-300',
          'inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] top-14 md:inset-auto md:bottom-24 md:right-6 md:w-[420px] md:h-[640px]'
        )}>
          <div className="relative overflow-hidden bg-primary text-primary-foreground">
            <div className="absolute inset-x-0 top-0 h-px bg-primary-foreground/30" />
            <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary-foreground/15 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block font-semibold text-sm leading-tight truncate">RuangBlajar AI</span>
                <span className="block text-[11px] leading-tight text-primary-foreground/75 truncate">The Integrated Learning Ecosystem</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            </div>
            <div className="px-4 pb-4">
              <div className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                    {assistantMode === 'teacher' ? <GraduationCap className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {modeCopy.badge}
                  </span>
                  <span className="text-[11px] text-primary-foreground/75 truncate">{modeCopy.label}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-primary-foreground/80">
                  {assistantMode === 'student'
                    ? 'Tutor ini memberi konsep, petunjuk, dan feedback. Bukan mesin jawaban instan.'
                    : 'Copilot untuk draft pembelajaran. Guru tetap memvalidasi hasil akhir.'}
                </p>
              </div>

              <div className="mt-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
                      <BookOpen className="h-3.5 w-3.5" />
                      Konteks Mapel
                      {lockedMapelId && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-semibold tracking-normal">
                          Terkunci
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-primary-foreground/80">
                      {activeMapel
                        ? `${activeMapel.nama}${activeMapel.kelasLabel ? ` • ${activeMapel.kelasLabel}` : ''}`
                        : 'Pilih mapel agar AI lebih spesifik dan profesional.'}
                    </p>
                  </div>
                </div>

                {!lockedMapelId && (
                  <div className="mt-2">
                    <Select
                      value={selectedMapelId ?? undefined}
                      onValueChange={(val) => {
                        const next = val || null;
                        setSelectedMapelId(next);
                        if (next) {
                          try { localStorage.setItem(AI_LAST_MAPEL_ID_KEY, next); } catch { /* ignore */ }
                        }
                      }}
                      disabled={isMapelLoading}
                    >
                      <SelectTrigger className="h-9 bg-primary-foreground/10 border-primary-foreground/15 text-primary-foreground placeholder:text-primary-foreground/70 focus:ring-primary-foreground/30">
                        <SelectValue placeholder={isMapelLoading ? 'Memuat mapel...' : 'Pilih mata pelajaran'} />
                      </SelectTrigger>
                      <SelectContent>
                        {mapelOptions.length === 0 && (
                          <SelectItem value="__none__" disabled>
                            {assistantMode === 'teacher' ? 'Belum ada mapel yang kamu ampuh.' : 'Belum ada mapel untuk kelasmu.'}
                          </SelectItem>
                        )}
                        {mapelOptions.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nama}{m.kelasLabel ? ` • ${m.kelasLabel}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <ScrollArea ref={scrollRef} className="flex-1 min-h-0">
            <div className="p-4 space-y-3">
              <div className="rounded-2xl border bg-muted/35 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Aksi Cepat
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleSend(action.prompt, action.label)}
                        disabled={isLoading}
                        className="min-h-[42px] rounded-xl border bg-background px-2.5 py-2 text-left text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                      >
                        <span className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="leading-tight">{action.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {assistantMode === 'student' && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Learning Effort</p>
                      <p className="text-[11px] leading-snug text-muted-foreground">
                        Pilih posisi belajarmu supaya AI memberi bantuan yang tepat tanpa mengambil alih jawaban.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      ['belum_mencoba', 'Belum mencoba'],
                      ['butuh_petunjuk', 'Butuh petunjuk'],
                      ['sudah_mencoba', 'Sudah mencoba'],
                      ['cek_jawaban', 'Cek jawaban saya'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLearningEffort(value as LearningEffort)}
                        className={cn(
                          'rounded-lg px-2 py-1.5 text-[11px] font-medium transition',
                          learningEffort === value
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-background text-foreground hover:bg-amber-500/10'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <ChatMessage key={msg.id} message={msg.text} isBot={msg.isBot} timestamp={msg.timestamp} />
              ))}
              {isLoading && messages[messages.length - 1]?.isBot !== true && (
                <div className="flex gap-2 mb-3">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2">
                    <span className="text-sm text-muted-foreground">Mengetik...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border p-3 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder={assistantMode === 'student' ? 'Tulis konsep atau jawaban yang ingin dicek...' : 'Tanya materi, tugas, nilai, atau pembelajaran...'}
              disabled={isLoading || (cooldownUntil != null && Date.now() < cooldownUntil)}
              className="flex-1 text-sm bg-muted rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50"
            />
            <Button
              size="icon"
              className="rounded-xl shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || isLoading || (cooldownUntil != null && Date.now() < cooldownUntil)}
              title={cooldownUntil != null && Date.now() < cooldownUntil ? "Tunggu sebentar sebelum mengirim lagi" : undefined}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'fixed z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center',
          'hover:scale-105 active:scale-95 transition-all duration-200',
          'bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
        aria-label={isOpen ? 'Tutup RuangBlajar AI' : 'Buka RuangBlajar AI'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!isOpen && (
          <span className="absolute -left-28 hidden w-24 rounded-full border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm md:block">
            {assistantMode === 'teacher' ? 'AI Guru' : 'AI Tutor'}
          </span>
        )}
      </button>
    </>
  );
}
