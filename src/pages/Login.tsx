import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, Eye, EyeOff, User, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo.png';

type WorkspaceType = 'mandiri' | 'sekolah';
type EducationLevel = 'paud' | 'sd' | 'smp' | 'sma' | 'smk' | 'pesantren';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Registration States
  const [registerStep, setRegisterStep] = useState<number>(1);
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('mandiri');
  const [educationLevel, setEducationLevel] = useState<EducationLevel>('pesantren');
  const [institutionName, setInstitutionName] = useState<string>('');

  const { user, session, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (session && user) {
      if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
        return; 
      }
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/app/dashboard', { replace: true });
      }
    }
  }, [user, session, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Error", description: "Email dan password harus diisi", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (result.success) {
      if (rememberMe) localStorage.setItem('rememberedEmail', email);
      else localStorage.removeItem('rememberedEmail');
      toast({ title: "Login Berhasil", description: "Selamat datang kembali!" });
    } else {
      toast({ title: "Login Gagal", description: result.error || "Email atau password salah", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep < 3) {
      setRegisterStep(registerStep + 1);
      return;
    }

    if (!email || !password || !name) {
      toast({ title: "Error", description: "Mohon lengkapi data diri Anda", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const result = await register(email, password, { 
      name, 
      workspaceType, 
      educationLevel, 
      institutionName 
    });
    
    setIsLoading(false);
    
    if (result.success) {
      toast({ title: "Pendaftaran Berhasil", description: "Selamat datang di ekosistem LMS Digiss!" });
      if (workspaceType === 'sekolah') {
        navigate('/admin/dashboard');
      } else {
        navigate('/app/dashboard');
      }
    } else {
      toast({ title: "Pendaftaran Gagal", description: result.error, variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-background p-3 sm:p-4">
      <Card className="w-full max-w-md shadow-lg border-0 rounded-xl sm:rounded-2xl overflow-hidden">
        <CardHeader className="space-y-3 sm:space-y-4 text-center pb-4 sm:pb-6 px-4 sm:px-6 pt-5 sm:pt-6 bg-card relative">
          <div className="mx-auto flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-primary/10 text-primary shadow-sm">
            <img src={logo} alt="Logo LMS" className="h-9 w-9 sm:h-12 sm:w-12 object-contain" />
          </div>
          <div>
            <CardTitle className="text-xl sm:text-2xl font-bold">LMS Digiss</CardTitle>
            <CardDescription className="mt-1.5 sm:mt-2 text-xs sm:text-sm">
              Sistem Informasi Akademik Terpadu
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="px-4 sm:px-6 pb-5 sm:pb-6 pt-2">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6" variant="tabs">
              <TabsTrigger value="login" variant="tabs">Masuk</TabsTrigger>
              <TabsTrigger value="register" variant="tabs">Daftar Baru</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="Masukkan email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" disabled={isLoading} />
                  </div>
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Masukkan password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10" disabled={isLoading} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center space-x-2 pt-1 pb-2">
                  <Checkbox id="remember" checked={rememberMe} onCheckedChange={(c) => setRememberMe(c as boolean)} disabled={isLoading} />
                  <Label htmlFor="remember" className="text-sm font-medium cursor-pointer">Ingat saya</Label>
                </div>
                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  {isLoading ? 'Loading...' : 'Masuk ke Dashboard'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-5">
                
                {/* STEP 1: Akun */}
                {registerStep === 1 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-1.5">
                      <Label>Nama Lengkap</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Budi Santoso" className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email aktif" className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 6 karakter" className="pl-10" required />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Tipe Pendaftaran */}
                {registerStep === 2 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-lg">Pilih Tipe Akun</h3>
                      <p className="text-sm text-muted-foreground">Bagaimana Anda akan menggunakan aplikasi ini?</p>
                    </div>
                    <div className="grid gap-3">
                      <div 
                        onClick={() => setWorkspaceType('mandiri')}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${workspaceType === 'mandiri' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg"><User className="h-5 w-5" /></div>
                          <div>
                            <div className="font-semibold">Guru Mandiri</div>
                            <div className="text-xs text-muted-foreground">Kelola kelas dan siswa Anda sendiri</div>
                          </div>
                        </div>
                      </div>
                      <div 
                        onClick={() => setWorkspaceType('sekolah')}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${workspaceType === 'sekolah' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-lg"><Building className="h-5 w-5" /></div>
                          <div>
                            <div className="font-semibold">Admin Sekolah</div>
                            <div className="text-xs text-muted-foreground">Kelola data seluruh guru dan siswa</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {workspaceType === 'sekolah' && (
                       <div className="space-y-1.5 mt-4">
                         <Label>Nama Institusi / Sekolah</Label>
                         <Input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Misal: SMA Negeri 1 Jakarta" required />
                       </div>
                    )}
                  </div>
                )}

                {/* STEP 3: Jenjang Pendidikan */}
                {registerStep === 3 && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="text-center mb-4">
                      <h3 className="font-semibold text-lg">Jenjang Pendidikan</h3>
                      <p className="text-sm text-muted-foreground">Pilih jenjang untuk menyesuaikan fitur dashboard</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(['paud', 'sd', 'smp', 'sma', 'smk', 'pesantren'] as EducationLevel[]).map((level) => (
                        <div 
                          key={level}
                          onClick={() => setEducationLevel(level)}
                          className={`p-3 rounded-lg border text-center cursor-pointer transition-all ${educationLevel === level ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-border hover:bg-muted'}`}
                        >
                          <div className="font-medium uppercase">{level}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {registerStep > 1 && (
                    <Button type="button" variant="outline" onClick={() => setRegisterStep(registerStep - 1)} className="w-1/3 h-11">
                      Kembali
                    </Button>
                  )}
                  <Button type="submit" className={`h-11 ${registerStep > 1 ? 'w-2/3' : 'w-full'}`} disabled={isLoading}>
                    {isLoading ? 'Memproses...' : registerStep < 3 ? 'Lanjut' : 'Selesaikan Pendaftaran'}
                  </Button>
                </div>
                
                <div className="flex justify-center gap-1 text-xs mt-4">
                  {[1, 2, 3].map((step) => (
                    <div key={step} className={`h-1.5 w-8 rounded-full ${registerStep >= step ? 'bg-primary' : 'bg-muted'}`} />
                  ))}
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}