import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { 
  ArrowRight, BookOpen, Users, UserCog, MonitorSmartphone, 
  ShieldCheck, CheckCircle2, ChevronRight, GraduationCap, 
  BookMarked, Wallet, Building2, LayoutGrid, Settings 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LandingPageSettings } from '@/components/settings/LandingPageConfigTab';
import { Skeleton } from '@/components/ui/skeleton';

const defaultSettings: LandingPageSettings = {
  hero_title: 'Sistem Informasi Akademik Terpadu untuk Pesantren',
  hero_subtitle: 'Digitalisasi manajemen sekolah, guru, siswa, dan orang tua dalam satu platform modern yang terintegrasi penuh.',
  hero_cta_text: 'Masuk ke Sistem',
  school_features_title: 'Manajemen Otomatis untuk Sekolah',
  school_features_desc: 'Kelola tagihan, data santri, dan laporan dengan mudah dan cepat.',
  teacher_features_title: 'Kemudahan untuk Guru',
  teacher_features_desc: 'Input nilai, rekap absen, dan buat ujian CBT tanpa hambatan.',
  student_features_title: 'Portal untuk Siswa',
  student_features_desc: 'Akses raport, jadwal, dan progres hafalan secara real-time.',
  parent_features_title: 'Pantauan Orang Tua',
  parent_features_desc: 'Monitor perkembangan anak dari rumah dengan presisi.',
  footer_text: '© 2026 LMS Boarding School. Hak Cipta Dilindungi.',
};

const ACCENT_COLOR = '#c2e078'; // Impeccify Lime/Olive Accent
const DARK_BG = '#111111';

export default function LandingPage() {
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<LandingPageSettings>(defaultSettings);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Jika user login dan memiliki sesi valid, redirect ke dashboard
  useEffect(() => {
    if (!authLoading && session && user) {
      if (session.expires_at && new Date(session.expires_at * 1000) > new Date()) {
        if (user.role === 'admin') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/app/dashboard', { replace: true });
        }
      }
    }
  }, [user, session, authLoading, navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('landing_page_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          setSettings(data as LandingPageSettings);
        }
      } catch (err) {
        // use defaults
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchSettings();
  }, []);

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#111111]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c2e078] mx-auto"></div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans selection:bg-[#c2e078]/30 selection:text-white" style={{ backgroundColor: DARK_BG }}>
      
      {/* ----------------- SECTION 1: HERO (DARK) ----------------- */}
      <section className="relative w-full pt-6 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto min-h-screen flex flex-col">
        {/* Navbar */}
        <nav className="flex items-center justify-between py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-2xl tracking-tight">ruangblajar.com</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Fitur</a>
            <a href="#journey" className="hover:text-white transition-colors">Transformasi</a>
            <a href="#explore" className="hover:text-white transition-colors">Modul</a>
          </div>
          <div className="flex items-center gap-4">
            <Button asChild className="rounded-full font-semibold text-black hover:bg-opacity-90 px-6 h-10" style={{ backgroundColor: ACCENT_COLOR }}>
              <Link to="/login">Mulai <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="flex-1 flex flex-col justify-center mt-12 relative z-10">
          <div className="max-w-[850px] mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: 50 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-6xl md:text-8xl lg:text-[110px] font-black uppercase leading-[0.85] tracking-tight text-white mb-6"
            >
              EKOSISTEM <br/> 
              <span style={{ color: ACCENT_COLOR }}>PENDIDIKAN</span>
            </motion.h1>
            
            <motion.h2 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-2xl md:text-3xl font-semibold text-white tracking-wide uppercase mb-4"
            >
              {loadingConfig ? <Skeleton className="h-8 w-96 bg-white/10" /> : 'PLATFORM MODERN. TERINTEGRASI PENUH.'}
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="text-slate-400 text-lg md:text-xl max-w-xl font-light leading-relaxed mb-10"
            >
              {loadingConfig ? (
                 <Skeleton className="h-16 w-full bg-white/10" />
              ) : settings.hero_subtitle}
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="flex flex-wrap items-center gap-4">
              <Button asChild size="lg" className="rounded-full px-8 h-14 text-lg font-semibold text-black hover:brightness-110 transition-all border-none" style={{ backgroundColor: ACCENT_COLOR }}>
                <Link to="/login">{settings.hero_cta_text} <ArrowRight className="w-5 h-5 ml-2" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-8 h-14 text-lg font-semibold text-white border-slate-600 hover:bg-slate-800 hover:text-white transition-all bg-transparent">
                <a href="#features">Pelajari Fitur</a>
              </Button>
            </motion.div>
          </div>

          {/* Floating Badges */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 1 }}
            className="flex flex-wrap items-center gap-8 text-slate-400 mt-auto pb-10"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-white">EST. 2026</p>
                <p className="text-xs">Sistem Terpercaya</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-slate-700 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-white">LMS Certified</p>
                <p className="text-xs">Standar Kurikulum</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Hero Image / Graphic (Absolute positioned on right for large screens) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, x: 50 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="absolute right-0 top-[20%] w-[45%] h-[60%] hidden lg:block rounded-l-3xl overflow-hidden pointer-events-none"
        >
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#111111] z-10" />
          <img 
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop" 
            alt="Students collaborating" 
            className="w-full h-full object-cover opacity-70"
          />
          {/* Decorative Floating Element */}
          <div className="absolute right-[20%] bottom-[20%] z-20 bg-[#1A1A1A] border border-slate-800 p-4 rounded-2xl flex items-center gap-4 shadow-2xl backdrop-blur-md">
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">RILIS TERBARU</p>
              <p className="text-white font-bold text-sm">Versi 2.0.26</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-black" style={{ backgroundColor: ACCENT_COLOR }}>
              <ArrowRight className="w-5 h-5 -rotate-45" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* ----------------- SECTION 2: FITTING OPTIONS (LIGHT ROUNDED CARD) ----------------- */}
      <section id="features" className="px-4 md:px-8 pb-12 w-full max-w-[1600px] mx-auto relative z-20 -mt-8">
        <div className="bg-white rounded-[40px] p-8 md:p-14 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-slate-200 pb-6">
            <h3 className="text-2xl md:text-3xl font-bold text-black uppercase tracking-tight">PILIHAN AKSES PERAN</h3>
            <a href="#" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-black mt-4 md:mt-0 transition-colors uppercase tracking-wider">
              Lihat Detail Modul <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* Card 1 */}
            <motion.div variants={fadeUp} className="bg-slate-50 hover:bg-slate-100 rounded-3xl p-8 flex flex-col justify-between aspect-square transition-colors group cursor-pointer border border-transparent hover:border-slate-200">
              <div className="w-14 h-14 rounded-full bg-[#f0f2eb] text-[#8fa850] flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-black mb-2">{loadingConfig ? <Skeleton className="h-6 w-3/4" /> : settings.school_features_title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">{loadingConfig ? <Skeleton className="h-10 w-full" /> : settings.school_features_desc}</p>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all ml-auto">
                  <ArrowRight className="w-4 h-4 -rotate-45" />
                </div>
              </div>
            </motion.div>

            {/* Card 2 */}
            <motion.div variants={fadeUp} className="bg-slate-50 hover:bg-slate-100 rounded-3xl p-8 flex flex-col justify-between aspect-square transition-colors group cursor-pointer border border-transparent hover:border-slate-200">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-6">
                <UserCog className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-black mb-2">{loadingConfig ? <Skeleton className="h-6 w-3/4" /> : settings.teacher_features_title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">{loadingConfig ? <Skeleton className="h-10 w-full" /> : settings.teacher_features_desc}</p>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all ml-auto">
                  <ArrowRight className="w-4 h-4 -rotate-45" />
                </div>
              </div>
            </motion.div>

            {/* Card 3 */}
            <motion.div variants={fadeUp} className="bg-slate-50 hover:bg-slate-100 rounded-3xl p-8 flex flex-col justify-between aspect-square transition-colors group cursor-pointer border border-transparent hover:border-slate-200">
              <div className="w-14 h-14 rounded-full bg-purple-50 text-purple-500 flex items-center justify-center mb-6">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-black mb-2">{loadingConfig ? <Skeleton className="h-6 w-3/4" /> : settings.student_features_title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">{loadingConfig ? <Skeleton className="h-10 w-full" /> : settings.student_features_desc}</p>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all ml-auto">
                  <ArrowRight className="w-4 h-4 -rotate-45" />
                </div>
              </div>
            </motion.div>

            {/* Card 4 */}
            <motion.div variants={fadeUp} className="bg-slate-50 hover:bg-slate-100 rounded-3xl p-8 flex flex-col justify-between aspect-square transition-colors group cursor-pointer border border-transparent hover:border-slate-200">
              <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center mb-6">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-black mb-2">{loadingConfig ? <Skeleton className="h-6 w-3/4" /> : settings.parent_features_title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">{loadingConfig ? <Skeleton className="h-10 w-full" /> : settings.parent_features_desc}</p>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all ml-auto">
                  <ArrowRight className="w-4 h-4 -rotate-45" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ----------------- SECTION 3: YOUR JOURNEY (DARK) ----------------- */}
      <section id="journey" className="px-4 md:px-8 py-20 w-full max-w-[1600px] mx-auto text-white">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Text Content */}
          <div className="lg:w-1/3 flex flex-col justify-center">
            <h3 className="text-3xl md:text-5xl font-bold uppercase tracking-tight leading-[1.1] mb-6">
              TRANSFORMASI <br/> MENJADI <span style={{ color: ACCENT_COLOR }}>LEBIH BAIK</span>
            </h3>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Terima laporan real-time, pantau hafalan santri, kelola tagihan secara transparan, dan pastikan komunikasi sekolah-wali murid terjalin sempurna.
            </p>
            
            <ul className="space-y-4 mb-10 text-slate-300 text-sm md:text-base">
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" style={{ color: ACCENT_COLOR }} />
                Pemantauan presensi dan nilai akademik.
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" style={{ color: ACCENT_COLOR }} />
                Integrasi pembayaran & tagihan SPP online.
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" style={{ color: ACCENT_COLOR }} />
                Ujian Berbasis Komputer (CBT) terpusat.
              </li>
            </ul>

            <div>
              <Button asChild className="rounded-full font-semibold text-black hover:bg-opacity-90 px-8 h-12" style={{ backgroundColor: ACCENT_COLOR }}>
                <Link to="/login">Daftar Sekarang <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
            </div>
          </div>

          {/* Masonry Image Grid */}
          <div className="lg:w-2/3 grid grid-cols-2 md:grid-cols-4 gap-4 h-[500px]">
            <img src="https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=2070&auto=format&fit=crop" alt="Student" className="w-full h-full object-cover rounded-2xl md:mt-12" />
            <img src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop" alt="Learning" className="w-full h-full object-cover rounded-2xl" />
            <img src="https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=2071&auto=format&fit=crop" alt="Focus" className="w-full h-full object-cover rounded-2xl md:mt-8" />
            <img src="https://images.unsplash.com/photo-1627556704290-2b1f5853ff78?q=80&w=2070&auto=format&fit=crop" alt="Campus" className="w-full h-full object-cover rounded-2xl md:mt-16 hidden md:block" />
          </div>
        </div>
      </section>

      {/* ----------------- SECTION 4: EXPLORE (LIGHT ROUNDED CARD) ----------------- */}
      <section id="explore" className="px-4 md:px-8 pb-12 w-full max-w-[1600px] mx-auto">
        <div className="bg-white rounded-[40px] p-8 md:p-14 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6 border-b border-slate-200 pb-6">
            <h3 className="text-2xl md:text-3xl font-bold text-black uppercase tracking-tight">EKSPLORASI MODUL</h3>
            
            {/* Tab Pills */}
            <div className="flex overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide gap-2">
              <button className="whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-colors" style={{ backgroundColor: '#485e25' }}>
                Semua Modul
              </button>
              <button className="whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Akademik
              </button>
              <button className="whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Keuangan
              </button>
              <button className="whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Asrama
              </button>
              <div className="w-10 h-10 ml-auto rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Module 1 */}
            <div className="group cursor-pointer">
              <div className="relative h-64 rounded-3xl overflow-hidden mb-4 bg-slate-100">
                <img src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Akademik" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="font-bold text-lg text-black mb-1">Manajemen Nilai</h4>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Akademik & Raport</p>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:border-black group-hover:text-white transition-all">
                  <ArrowRight className="w-3 h-3 -rotate-45" />
                </div>
              </div>
            </div>

            {/* Module 2 */}
            <div className="group cursor-pointer">
              <div className="relative h-64 rounded-3xl overflow-hidden mb-4 bg-slate-100">
                <img src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Keuangan" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="font-bold text-lg text-black mb-1">Tagihan SPP</h4>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Keuangan & Invoice</p>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:border-black group-hover:text-white transition-all">
                  <ArrowRight className="w-3 h-3 -rotate-45" />
                </div>
              </div>
            </div>

            {/* Module 3 */}
            <div className="group cursor-pointer">
              <div className="relative h-64 rounded-3xl overflow-hidden mb-4 bg-slate-100">
                <img src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="CBT" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="font-bold text-lg text-black mb-1">Ujian CBT</h4>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Evaluasi Digital</p>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:border-black group-hover:text-white transition-all">
                  <ArrowRight className="w-3 h-3 -rotate-45" />
                </div>
              </div>
            </div>

            {/* Module 4 */}
            <div className="group cursor-pointer">
              <div className="relative h-64 rounded-3xl overflow-hidden mb-4 bg-slate-100">
                <img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Hafalan" />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="font-bold text-lg text-black mb-1">Buku Mutabaah</h4>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Tahfidz & Ibadah</p>
                </div>
                <div className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 group-hover:bg-black group-hover:border-black group-hover:text-white transition-all">
                  <ArrowRight className="w-3 h-3 -rotate-45" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer (Dark) */}
      <footer className="text-slate-500 py-10 text-center text-sm border-t border-slate-800 mt-10">
        <p>{loadingConfig ? <Skeleton className="h-4 w-64 mx-auto bg-white/10" /> : settings.footer_text}</p>
      </footer>
    </div>
  );
}