import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Separator } from "@/components/ui/separator";
import { ListCard } from "@/components/ui/list-card";
import { CardListPri } from "@/components/ui/card-list-pri";
import { SantriListCard } from "@/components/ui/santri-list-card";
import { ActionButtonGroup, DetailButton, DeleteButton, EditButton, MoreButton, StartButton, StopButton, SubstituteButton, ShareButton, RefreshButton, BackButton } from "@/components/ui/action-buttons";
import {
  Sun, Moon, Palette, Type, RectangleHorizontal, Tag, LayoutGrid,
  FormInput, Columns3, AlertCircle, Box, Play, Users, BookOpen,
  GraduationCap, Star, TrendingUp, CheckCircle, AlertTriangle, XCircle,
  Edit, Trash2, MoreHorizontal, Square, StopCircle, RefreshCw, Share2, Eye,
  Menu, ArrowUp, PanelBottom, Info, Calendar, MapPin, User as UserIcon,
  ChevronDown, ChevronRight, Settings, ClipboardCheck, FileText, LifeBuoy,
  Search, Filter, Plus, SlidersHorizontal, Table as TableIcon,
  PanelTop, ArrowLeft, MessageSquare, ClipboardList, Award,
} from "lucide-react";
import {
  DetailSheet,
  DetailSheetFooter,
  DetailSheetInfoItem,
  DetailSheetInfoGrid,
  DetailSheetStatCard,
  DetailSheetSection,
} from "@/components/ui/detail-sheet";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

// Color definitions matching index.css
const colorSections = [
  {
    title: "Core",
    colors: [
      { name: "--background", label: "Background" },
      { name: "--foreground", label: "Foreground" },
      { name: "--card", label: "Card" },
      { name: "--card-foreground", label: "Card Foreground" },
      { name: "--popover", label: "Popover" },
      { name: "--popover-foreground", label: "Popover Foreground" },
    ],
  },
  {
    title: "Brand",
    colors: [
      { name: "--primary", label: "Primary" },
      { name: "--primary-foreground", label: "Primary Foreground" },
      { name: "--primary-light", label: "Primary Light" },
      { name: "--secondary", label: "Secondary" },
      { name: "--secondary-foreground", label: "Secondary Foreground" },
      { name: "--accent", label: "Accent" },
      { name: "--accent-foreground", label: "Accent Foreground" },
    ],
  },
  {
    title: "Semantic",
    colors: [
      { name: "--destructive", label: "Destructive" },
      { name: "--destructive-foreground", label: "Destructive FG" },
      { name: "--muted", label: "Muted" },
      { name: "--muted-foreground", label: "Muted Foreground" },
    ],
  },
  {
    title: "UI",
    colors: [
      { name: "--border", label: "Border" },
      { name: "--input", label: "Input" },
      { name: "--ring", label: "Ring" },
    ],
  },
  {
    title: "Chart",
    colors: [
      { name: "--chart-1", label: "Chart 1" },
      { name: "--chart-2", label: "Chart 2" },
      { name: "--chart-3", label: "Chart 3" },
      { name: "--chart-4", label: "Chart 4" },
      { name: "--chart-5", label: "Chart 5" },
    ],
  },
  {
    title: "Sidebar",
    colors: [
      { name: "--sidebar-background", label: "Sidebar BG" },
      { name: "--sidebar-foreground", label: "Sidebar FG" },
      { name: "--sidebar-primary", label: "Sidebar Primary" },
      { name: "--sidebar-primary-foreground", label: "Sidebar Primary FG" },
      { name: "--sidebar-accent", label: "Sidebar Accent" },
      { name: "--sidebar-accent-foreground", label: "Sidebar Accent FG" },
      { name: "--sidebar-border", label: "Sidebar Border" },
    ],
  },
];

const sections = [
  { id: "colors", label: "Colors", icon: Palette },
  { id: "typography", label: "Typography", icon: Type },
  { id: "buttons", label: "Buttons", icon: RectangleHorizontal },
  { id: "badges", label: "Badges", icon: Tag },
  { id: "cards", label: "Cards", icon: LayoutGrid },
  { id: "headers", label: "Headers", icon: PanelTop },
  { id: "listcards", label: "List Cards", icon: LayoutGrid },
  { id: "forms", label: "Forms", icon: FormInput },
  { id: "tabs", label: "Tabs", icon: Columns3 },
  { id: "user-table", label: "Tabs Terintegrasi", icon: TableIcon },
  { id: "alerts", label: "Alerts", icon: AlertCircle },
  { id: "sidebar", label: "Sidebar Menu", icon: Menu },
  { id: "drawers", label: "Drawers & Sheets", icon: PanelBottom },
  { id: "shadows", label: "Shadows & Radius", icon: Box },
  { id: "animations", label: "Animations", icon: Play },
];

function ColorSwatch({ name, label }: { name: string; label: string }) {
  const hsl = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div
        className="h-10 w-10 rounded-lg border border-border shadow-sm shrink-0"
        style={{ backgroundColor: `hsl(${hsl})` }}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{name}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{hsl || "—"}</p>
      </div>
    </div>
  );
}

function SectionWrapper({ id, title, icon: Icon, children }: { id: string; title: string; icon: any; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SubSection({ title, component, children }: { title: string; component?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
      {component && (
        <code className="block text-[11px] text-muted-foreground/80 font-mono bg-muted/40 px-2 py-1 rounded w-fit">
          {component}
        </code>
      )}
    </div>
  );
}

export default function DesignSystem() {
  const [dark, setDark] = useState(false);
  const [activeSection, setActiveSection] = useState("colors");
  const [showNav, setShowNav] = useState(false);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setShowNav(false);
  };

  return (
    <div className={cn("min-h-screen", dark && "dark")}>
      <div className="bg-background text-foreground min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowNav(!showNav)} className="lg:hidden p-2 rounded-lg hover:bg-muted">
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-lg font-bold">🎨 Design System</h1>
              <Badge variant="ta-badge">DIGISS</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDark(!dark)}
              className="gap-2"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {dark ? "Light" : "Dark"}
            </Button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto flex">
          {/* Sidebar nav */}
          <nav className={cn(
            "w-56 shrink-0 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto p-4 border-r border-border hidden lg:block"
          )}>
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      activeSection === s.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <s.icon className="h-4 w-4" />
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Mobile nav overlay */}
          {showNav && (
            <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setShowNav(false)}>
              <nav className="w-64 h-full bg-card border-r border-border p-4 space-y-1" onClick={(e) => e.stopPropagation()}>
                {sections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                      activeSection === s.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    <s.icon className="h-4 w-4" />
                    {s.label}
                  </button>
                ))}
              </nav>
            </div>
          )}

          {/* Main content */}
          <main className="flex-1 p-4 sm:p-8 space-y-12 max-w-full overflow-hidden">

            {/* 1. COLORS */}
            <SectionWrapper id="colors" title="Color Palette" icon={Palette}>
              {colorSections.map((section) => (
                <SubSection key={section.title} title={section.title}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {section.colors.map((c) => (
                      <ColorSwatch key={c.name} {...c} />
                    ))}
                  </div>
                </SubSection>
              ))}
              <SubSection title="Gradients">
                <div className="flex flex-wrap gap-4">
                  <div className="w-40 h-20 rounded-xl" style={{ background: "var(--gradient-primary)" }} />
                  <div className="w-40 h-20 rounded-xl border" style={{ background: "var(--gradient-subtle)" }} />
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">--gradient-primary &nbsp;|&nbsp; --gradient-subtle</p>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 2. TYPOGRAPHY */}
            <SectionWrapper id="typography" title="Typography" icon={Type}>
              <SubSection title="Headings">
                <div className="space-y-3 bg-card p-4 rounded-xl border">
                  <h1 className="text-4xl font-semibold tracking-tight">Heading 1 — 4xl</h1>
                  <h2 className="text-3xl font-semibold tracking-tight">Heading 2 — 3xl</h2>
                  <h3 className="text-2xl font-semibold tracking-tight">Heading 3 — 2xl</h3>
                  <h4 className="text-xl font-semibold tracking-tight">Heading 4 — xl</h4>
                  <h5 className="text-lg font-semibold tracking-tight">Heading 5 — lg</h5>
                  <h6 className="text-base font-semibold tracking-tight">Heading 6 — base</h6>
                </div>
              </SubSection>
              <SubSection title="Body Text">
                <div className="space-y-2 bg-card p-4 rounded-xl border">
                  <p className="text-base">Body text — base (16px). The quick brown fox jumps over the lazy dog.</p>
                  <p className="text-sm">Small text — sm (14px). The quick brown fox jumps over the lazy dog.</p>
                  <p className="text-xs">Extra small — xs (12px). The quick brown fox jumps over the lazy dog.</p>
                  <p className="text-sm text-muted-foreground">Muted text — text-muted-foreground.</p>
                </div>
              </SubSection>
              <SubSection title="Font Weights">
                <div className="space-y-1 bg-card p-4 rounded-xl border">
                  <p className="font-bold">Bold (700)</p>
                  <p className="font-semibold">Semibold (600)</p>
                  <p className="font-medium">Medium (500)</p>
                  <p className="font-normal">Normal (400)</p>
                </div>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 3. BUTTONS */}
            <SectionWrapper id="buttons" title="Buttons" icon={RectangleHorizontal}>
              <SubSection title="Standard Variants" component="<Button /> — @/components/ui/button">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-card p-4 rounded-xl border">
                  {([
                    { variant: "default", label: "default" },
                    { variant: "destructive", label: "destructive" },
                    { variant: "outline", label: "outline" },
                    { variant: "secondary", label: "secondary" },
                    { variant: "ghost", label: "ghost" },
                    { variant: "link", label: "link" },
                    { variant: "btn_sec", label: "btn_sec" },
                  ] as const).map((b) => (
                    <div key={b.variant} className="flex flex-col items-center gap-1.5">
                      <Button variant={b.variant}>{b.label}</Button>
                      <code className="text-[10px] text-muted-foreground font-mono">variant="{b.variant}"</code>
                    </div>
                  ))}
                </div>
              </SubSection>
              <SubSection title="Action Variants (action-buttons.tsx)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-card p-4 rounded-xl border">
                  {([
                    { comp: <DetailButton />, name: "DetailButton", variant: "action-detail" },
                    { comp: <EditButton />, name: "EditButton", variant: "action-edit" },
                    { comp: <DeleteButton />, name: "DeleteButton", variant: "action-delete" },
                    { comp: <MoreButton />, name: "MoreButton", variant: "action-more" },
                    { comp: <StartButton />, name: "StartButton", variant: "action-start" },
                    { comp: <StopButton />, name: "StopButton", variant: "action-stop" },
                    { comp: <SubstituteButton />, name: "SubstituteButton", variant: "action-substitute" },
                    { comp: <ShareButton />, name: "ShareButton", variant: "action-share" },
                    { comp: <RefreshButton />, name: "RefreshButton", variant: "action-edit" },
                    { comp: <BackButton />, name: "BackButton", variant: "ghost" },
                  ]).map((b, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      {b.comp}
                      <code className="text-[10px] text-muted-foreground font-mono text-center">&lt;{b.name} /&gt;</code>
                      <code className="text-[9px] text-muted-foreground/60 font-mono">{b.variant}</code>
                    </div>
                  ))}
                </div>
              </SubSection>
              <SubSection title="Action Button Variants (raw)">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-card p-4 rounded-xl border">
                  {([
                    { variant: "action-detail", icon: <Eye className="h-4 w-4" /> },
                    { variant: "action-edit", icon: <Edit className="h-4 w-4" /> },
                    { variant: "action-delete", icon: <Trash2 className="h-4 w-4" /> },
                    { variant: "action-more", icon: <MoreHorizontal className="h-4 w-4" /> },
                    { variant: "action-start", icon: <Play className="h-4 w-4" /> },
                    { variant: "action-stop", icon: <StopCircle className="h-4 w-4" /> },
                    { variant: "action-substitute", icon: <RefreshCw className="h-4 w-4" /> },
                    { variant: "action-share", icon: <Share2 className="h-4 w-4" /> },
                    { variant: "icon-outline", icon: <Star className="h-4 w-4" /> },
                  ] as const).map((b) => (
                    <div key={b.variant} className="flex flex-col items-center gap-1.5">
                      <Button variant={b.variant} size="icon-sm">{b.icon}</Button>
                      <code className="text-[10px] text-muted-foreground font-mono">"{b.variant}"</code>
                    </div>
                  ))}
                </div>
              </SubSection>
              <SubSection title="Sizes">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 bg-card p-4 rounded-xl border">
                  {([
                    { size: "lg" as const, label: "Large", isIcon: false },
                    { size: "default" as const, label: "Default", isIcon: false },
                    { size: "sm" as const, label: "Small", isIcon: false },
                    { size: "icon" as const, label: "Icon", isIcon: true },
                    { size: "icon-sm" as const, label: "Icon SM", isIcon: true },
                  ]).map((b) => (
                    <div key={b.size} className="flex flex-col items-center gap-1.5">
                      <Button size={b.size}>{b.isIcon ? <Star className="h-4 w-4" /> : b.label}</Button>
                      <code className="text-[10px] text-muted-foreground font-mono">size="{b.size}"</code>
                    </div>
                  ))}
                </div>
              </SubSection>
              <SubSection title="Disabled">
                <div className="flex flex-wrap gap-3 bg-card p-4 rounded-xl border">
                  <Button disabled>Disabled</Button>
                  <Button variant="outline" disabled>Disabled Outline</Button>
                </div>
              </SubSection>
              <SubSection title="ActionButtonGroup" component="<ActionButtonGroup /> — @/components/ui/action-buttons">
                <div className="flex flex-wrap gap-4 bg-card p-4 rounded-xl border">
                  <ActionButtonGroup>
                    <DetailButton />
                    <EditButton />
                    <DeleteButton />
                  </ActionButtonGroup>
                </div>
                <p className="text-xs text-muted-foreground mt-1">&lt;ActionButtonGroup&gt; — wrapper flex untuk mengelompokkan action buttons.</p>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 4. BADGES */}
            <SectionWrapper id="badges" title="Badges" icon={Tag}>
              <SubSection title="Standard Variants" component="<Badge /> — @/components/ui/badge">
                <div className="flex flex-wrap gap-2 bg-card p-4 rounded-xl border">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="pending">Pending</Badge>
                  <Badge variant="ta-badge">TA 2024/2025</Badge>
                </div>
              </SubSection>
              <SubSection title="Role Badges" component="<Badge variant='role-*' /> — @/components/ui/badge">
                <div className="flex flex-wrap gap-2 bg-card p-4 rounded-xl border">
                  <Badge variant="role-admin">Admin</Badge>
                  <Badge variant="role-guru">Guru</Badge>
                  <Badge variant="role-walikelas">Walikelas</Badge>
                  <Badge variant="role-santri">Santri</Badge>
                  <Badge variant="role-orangtua">Orangtua</Badge>
                  <Badge variant="role-pembina">Pembina</Badge>
                  <Badge variant="role-staff">Staff</Badge>
                  <Badge variant="role-guru_ekskul">Guru Ekskul</Badge>
                </div>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 5. CARDS */}
            <SectionWrapper id="cards" title="Cards" icon={LayoutGrid}>
              <SubSection title="Default Card" component="<Card /> — @/components/ui/card">
                <Card className="max-w-sm">
                  <CardHeader>
                    <CardTitle>Card Title</CardTitle>
                    <CardDescription>Card description goes here.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Card content area with some sample text.</p>
                  </CardContent>
                </Card>
              </SubSection>

              <SubSection title="StatCard Variants" component="<StatCard /> — @/components/ui/stat-card">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard title="Default" value={42} icon={Users} variant="default" />
                  <StatCard title="Success" value={128} icon={CheckCircle} variant="success" />
                  <StatCard title="Warning" value={7} icon={AlertTriangle} variant="warning" />
                  <StatCard title="Destructive" value={3} icon={XCircle} variant="destructive" />
                </div>
              </SubSection>

              <SubSection title="DashboardCard" component="<DashboardCard /> — @/components/dashboard/DashboardCard">
                <DashboardCard title="Dashboard Card" icon={TrendingUp}>
                  <p className="text-sm text-muted-foreground">Content inside a DashboardCard component with gradient header.</p>
                </DashboardCard>
              </SubSection>

              <SubSection title="container-base CSS Class">
                <div className="container-base max-w-sm">
                  <div className="title-card">
                    <div className="title-card-icon bg-primary/10 text-primary">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <h3>Container Base</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Uses .container-base, .title-card classes.</p>
                </div>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 5a. HEADERS */}
            <SectionWrapper id="headers" title="Headers" icon={PanelTop}>
              <SubSection
                title="Main Header (Detail Page)"
                component="<MainPageHeader /> — pola header utama, diadopsi dari halaman Detail Mata Pelajaran"
              >
                <div className="rounded-2xl bg-primary p-4 md:p-6 shadow-lg space-y-4">
                  <div className="flex flex-col gap-4">
                    {/* Row 1: Back button + title */}
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl h-10 w-10 shrink-0 border-2 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/30 transition-all duration-200"
                      >
                        <ArrowLeft className="h-4 w-4 text-white" />
                      </Button>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg md:text-xl font-bold text-primary-foreground truncate">
                          Matematika Dasar
                        </h2>
                        <p className="text-sm text-primary-foreground/70 truncate flex items-center gap-1.5">
                          <span className="inline-block w-2 h-2 rounded-full bg-primary-foreground"></span>
                          Kelas 7A
                        </p>
                      </div>
                    </div>

                    {/* Row 2: Integrated tabs */}
                    <Tabs defaultValue="forum" className="w-full">
                      <TabsList className="grid w-full grid-cols-4 gap-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-1.5 h-auto">
                        <TabsTrigger
                          value="forum"
                          className="rounded-lg py-2.5 px-3 text-primary-foreground/70 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm"
                        >
                          <MessageSquare className="h-4 w-4 mr-1.5" />
                          <span className="hidden md:inline">Forum</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="materi"
                          className="rounded-lg py-2.5 px-3 text-primary-foreground/70 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm"
                        >
                          <BookOpen className="h-4 w-4 mr-1.5" />
                          <span className="hidden md:inline">Materi</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="tugas"
                          className="rounded-lg py-2.5 px-3 text-primary-foreground/70 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm"
                        >
                          <ClipboardList className="h-4 w-4 mr-1.5" />
                          <span className="hidden md:inline">Tugas</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="penilaian"
                          className="rounded-lg py-2.5 px-3 text-primary-foreground/70 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=inactive]:hover:bg-white/10 transition-all duration-200 font-medium text-sm"
                        >
                          <Award className="h-4 w-4 mr-1.5" />
                          <span className="hidden md:inline">Penilaian</span>
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </SubSection>

              <SubSection
                title="List/Index Header (Page Header)"
                component="<PageHeader /> — pola header halaman index, diadopsi dari halaman Kelola Pengguna"
              >
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-3 sm:p-4 lg:p-6">
                  <div className="relative flex items-center justify-between gap-3">
                    <div>
                      <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">
                        Kelola Pengguna
                      </h1>
                      <p className="text-muted-foreground text-sm hidden lg:block">
                        Manajemen data pengguna dalam sistem
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button className="rounded-xl h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-4">
                        <Plus className="h-4 w-4 sm:mr-1.5 lg:mr-2" />
                        <span className="hidden sm:inline text-sm">Tambah</span>
                        <span className="hidden lg:inline ml-1">Staff</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 5b. LIST CARDS */}
            <SectionWrapper id="listcards" title="List Cards" icon={LayoutGrid}>
              <SubSection title="ListCard" component="<ListCard /> — @/components/ui/list-card">
                <div className="space-y-2">
                  <ListCard
                    icon={<BookOpen className="text-primary" />}
                    columns={[
                      { value: "Matematika Dasar", subValue: "MTK-001" },
                      { label: "Pengampu", value: "Ahmad Fauzi" },
                      { label: "Kelas", value: "7A - Ganjil" },
                    ]}
                    badge={{ label: "Aktif", variant: "success", title: "Status" }}
                    actions={
                      <>
                        <DetailButton />
                        <DeleteButton />
                      </>
                    }
                  />
                  <ListCard
                    icon={<GraduationCap className="text-primary" />}
                    columns={[
                      { value: "Bahasa Inggris", subValue: "ENG-002" },
                      { label: "Pengampu", value: "Sarah Dewi" },
                      { label: "Kelas", value: "8B - Genap" },
                    ]}
                    badge={{ label: "Nonaktif", variant: "pending", title: "Status" }}
                    actions={
                      <>
                        <DetailButton />
                        <DeleteButton />
                      </>
                    }
                  />
                </div>
              </SubSection>

              <SubSection title="CardListPri" component="<CardListPri /> — @/components/ui/card-list-pri">
                <div className="space-y-2 max-w-lg">
                  <CardListPri
                    icon={
                      <div className="rounded-lg p-1.5 bg-primary/10">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                    }
                    title="Ahmad Rizki"
                    subtitle="NIS: 2024001"
                    columns={[
                      { label: "Kelas:", value: "7A" },
                      { label: "Semester:", value: "Ganjil" },
                    ]}
                    badge={<Badge variant="success">Aktif</Badge>}
                    actions={<DetailButton />}
                    footer={
                      <p className="text-xs text-muted-foreground">Terakhir login: 2 jam lalu</p>
                    }
                  />
                  <CardListPri
                    icon={
                      <div className="rounded-lg p-1.5 bg-amber-500/10">
                        <Star className="h-4 w-4 text-amber-500" />
                      </div>
                    }
                    title="Siti Aisyah"
                    subtitle="NIS: 2024002"
                    columns={[
                      { label: "Kelas:", value: "8B" },
                      { label: "Hafalan:", value: "Juz 30" },
                    ]}
                    badge={<Badge variant="warning">Izin</Badge>}
                    actions={<DetailButton />}
                  />
                </div>
              </SubSection>

              <SubSection title="SantriListCard" component="<SantriListCard /> — @/components/ui/santri-list-card">
                <div className="space-y-2">
                  <SantriListCard
                    name="Muhammad Fadhil"
                    subtitle="NIS: 2024003 • Kelas 7A"
                    columns={[
                      { label: "Hafalan", value: "Juz 28" },
                      { label: "Nilai Rata-rata", value: "87.5" },
                    ]}
                    badge={<Badge variant="success">Aktif</Badge>}
                    actions={
                      <>
                        <DetailButton />
                        <EditButton />
                      </>
                    }
                  />
                  <SantriListCard
                    name="Zahra Putri Amelia"
                    subtitle="NIS: 2024004 • Kelas 8B"
                    columns={[
                      { label: "Hafalan", value: "Juz 30" },
                      { label: "Nilai Rata-rata", value: "92.3" },
                    ]}
                    badge={<Badge variant="default">Lulus</Badge>}
                    actions={<DetailButton />}
                  />
                </div>
              </SubSection>

            </SectionWrapper>

            <Separator />

            {/* 6. FORM ELEMENTS */}
            <SectionWrapper id="forms" title="Form Elements" icon={FormInput}>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4 bg-card p-4 rounded-xl border">
                  <div className="space-y-2">
                    <Label>Input</Label>
                    <Input placeholder="Placeholder text..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Textarea</Label>
                    <Textarea placeholder="Write something..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Slider</Label>
                    <Slider defaultValue={[50]} max={100} step={1} />
                  </div>
                  <div className="space-y-2">
                    <Label>Progress</Label>
                    <Progress value={66} />
                    <p className="text-xs text-muted-foreground">66%</p>
                  </div>
                </div>
                <div className="space-y-4 bg-card p-4 rounded-xl border">
                  <div className="flex items-center gap-3">
                    <Checkbox id="check-demo" />
                    <Label htmlFor="check-demo">Checkbox</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch id="switch-demo" />
                    <Label htmlFor="switch-demo">Switch</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Radio Group</Label>
                    <RadioGroup defaultValue="opt1">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="opt1" id="opt1" />
                        <Label htmlFor="opt1">Option 1</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="opt2" id="opt2" />
                        <Label htmlFor="opt2">Option 2</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="opt3" id="opt3" />
                        <Label htmlFor="opt3">Option 3</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            </SectionWrapper>

            <Separator />

            {/* 7. TABS */}
            <SectionWrapper id="tabs" title="Tabs" icon={Columns3}>
              <SubSection title="Default" component="<Tabs /> — @/components/ui/tabs">
                <Tabs defaultValue="tab1">
                  <TabsList>
                    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
                    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
                    <TabsTrigger value="tab3">Tab 3</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tab1"><p className="text-sm p-3">Default tab content 1</p></TabsContent>
                  <TabsContent value="tab2"><p className="text-sm p-3">Default tab content 2</p></TabsContent>
                  <TabsContent value="tab3"><p className="text-sm p-3">Default tab content 3</p></TabsContent>
                </Tabs>
              </SubSection>
              <SubSection title="Tabs Variant" component='<TabsList variant="tabs" />'>
                <Tabs defaultValue="t1">
                  <TabsList variant="tabs">
                    <TabsTrigger variant="tabs" value="t1">Overview</TabsTrigger>
                    <TabsTrigger variant="tabs" value="t2">Analytics</TabsTrigger>
                    <TabsTrigger variant="tabs" value="t3">Reports</TabsTrigger>
                  </TabsList>
                  <TabsContent value="t1"><p className="text-sm p-3">Tabs variant content</p></TabsContent>
                </Tabs>
              </SubSection>
              <SubSection title="Digiss Variant" component='<TabsList variant="digiss" />'>
                <Tabs defaultValue="d1">
                  <TabsList variant="digiss">
                    <TabsTrigger variant="digiss" value="d1">Informasi</TabsTrigger>
                    <TabsTrigger variant="digiss" value="d2">Penilaian</TabsTrigger>
                    <TabsTrigger variant="digiss" value="d3">Tugas</TabsTrigger>
                  </TabsList>
                  <TabsContent value="d1"><p className="text-sm p-3">Digiss variant content</p></TabsContent>
                </Tabs>
              </SubSection>
              <SubSection title="Admin Variant" component='<TabsList variant="admin" />'>
                <Tabs defaultValue="a1">
                  <TabsList variant="admin" className="grid-cols-3 max-w-md">
                    <TabsTrigger variant="admin" value="a1">Data</TabsTrigger>
                    <TabsTrigger variant="admin" value="a2">Settings</TabsTrigger>
                    <TabsTrigger variant="admin" value="a3">Log</TabsTrigger>
                  </TabsList>
                  <TabsContent value="a1"><p className="text-sm p-3">Admin variant content</p></TabsContent>
                </Tabs>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 7b. INTEGRATED TABS */}
            <SectionWrapper id="user-table" title="Tabs Terintegrasi" icon={TableIcon}>
              <SubSection
                title="Tabs + Konten Menyatu"
                component='<Tabs variant="panel" />'
              >
                <p className="text-xs text-muted-foreground">
                  Komponen tablist dan konten menyatu dalam satu kartu, dengan indikator aktif yang mengikuti garis kontainer.
                </p>

                {/* Container — tabs attached to table */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <Tabs defaultValue="staff">
                    <TabsList variant="panel" className="rounded-b-none border-b-0">
                      <TabsTrigger variant="panel" value="staff">
                        <Users className="h-4 w-4" strokeWidth={1.75} />
                        <span>Staff & Guru</span>
                        <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold leading-none">
                          24
                        </span>
                      </TabsTrigger>
                      <TabsTrigger variant="panel" value="ortu">
                        <UserIcon className="h-4 w-4" strokeWidth={1.75} />
                        <span>Orang Tua</span>
                        <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold leading-none">
                          152
                        </span>
                      </TabsTrigger>
                      <TabsTrigger variant="panel" value="santri">
                        <GraduationCap className="h-4 w-4" strokeWidth={1.75} />
                        <span>Santri</span>
                        <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold leading-none">
                          248
                        </span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="staff" className="mt-0">
                      <p className="text-sm p-8 text-muted-foreground text-center">Konten Staff & Guru ditampilkan di sini.</p>
                    </TabsContent>
                    <TabsContent value="ortu" className="mt-0">
                      <p className="text-sm p-8 text-muted-foreground text-center">Konten Orang Tua ditampilkan di sini.</p>
                    </TabsContent>
                    <TabsContent value="santri" className="mt-0">
                      <p className="text-sm p-8 text-muted-foreground text-center">Konten Santri ditampilkan di sini.</p>
                    </TabsContent>
                  </Tabs>
                </div>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 8. ALERTS */}
            <SectionWrapper id="alerts" title="Alerts" icon={AlertCircle}>
              <div className="space-y-3 max-w-lg">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Default Alert</AlertTitle>
                  <AlertDescription>This is a default alert message for general information.</AlertDescription>
                </Alert>
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Destructive Alert</AlertTitle>
                  <AlertDescription>Something went wrong. Please check and try again.</AlertDescription>
                </Alert>
              </div>
            </SectionWrapper>

            <Separator />

            {/* 9. SHADOWS & RADIUS */}
            <SectionWrapper id="shadows" title="Shadows & Radius" icon={Box}>
              <SubSection title="Shadows (CSS Variables)">
                <div className="flex flex-wrap gap-6">
                  {[
                    { name: "shadow-sm", css: "var(--shadow-sm)" },
                    { name: "shadow-md", css: "var(--shadow-md)" },
                    { name: "shadow-lg", css: "var(--shadow-lg)" },
                  ].map((s) => (
                    <div
                      key={s.name}
                      className="w-28 h-28 rounded-xl bg-card border border-border flex items-center justify-center text-xs font-mono text-muted-foreground"
                      style={{ boxShadow: s.css }}
                    >
                      {s.name}
                    </div>
                  ))}
                </div>
              </SubSection>
              <SubSection title="Border Radius (--radius: 1rem)">
                <div className="flex flex-wrap gap-6">
                  {[
                    { name: "rounded-lg", label: "lg (1rem)" },
                    { name: "rounded-md", label: "md (calc - 2px)" },
                    { name: "rounded-sm", label: "sm (calc - 4px)" },
                  ].map((r) => (
                    <div
                      key={r.name}
                      className={cn(
                        "w-28 h-28 bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-xs font-mono text-primary",
                        r.name
                      )}
                    >
                      {r.label}
                    </div>
                  ))}
                </div>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 9.4 SIDEBAR MENU */}
            <SectionWrapper id="sidebar" title="Sidebar Menu" icon={Menu}>
              <SubSection
                title="Anatomi & States — pola sidebar navigasi standar LMS Digiss"
                component='import { Sidebar, SidebarMenuButton } from "@/components/ui/sidebar"'
              >
                <p className="text-sm text-muted-foreground">
                  Sidebar menggunakan struktur: <strong>Brand Header</strong> → <strong>Group Label</strong> →
                  <strong> Menu Items</strong> (default / hover / active / disabled) → <strong>Submenu</strong> (collapsed/expanded) → <strong>Footer Card</strong>.
                  Lebar: <code className="font-mono text-xs">280px</code> (expanded), padding horizontal <code className="font-mono text-xs">16px</code>,
                  icon <code className="font-mono text-xs">20px</code>, gap icon-text <code className="font-mono text-xs">12px</code>, radius <code className="font-mono text-xs">12px</code>.
                </p>

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
                  {/* Live sidebar mock */}
                  <SidebarMockup />

                  {/* Spec details */}
                  <div className="space-y-4">
                    <SidebarStateRow label="Default" state="default" />
                    <SidebarStateRow label="Hover" state="hover" />
                    <SidebarStateRow label="Active" state="active" />
                    <SidebarStateRow label="Disabled" state="disabled" />

                    <div className="pt-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">SUBMENU (COLLAPSED)</p>
                      <SidebarSubmenuMock expanded={false} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">SUBMENU (EXPANDED)</p>
                      <SidebarSubmenuMock expanded={true} />
                    </div>

                    <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">SPACING & LAYOUT</p>
                      <p className="text-xs text-foreground">• Padding horizontal: <span className="font-mono">16px</span></p>
                      <p className="text-xs text-foreground">• Icon size: <span className="font-mono">20px</span></p>
                      <p className="text-xs text-foreground">• Gap icon → text: <span className="font-mono">12px</span></p>
                      <p className="text-xs text-foreground">• Border radius: <span className="font-mono">12px</span></p>
                      <p className="text-xs text-foreground">• Sidebar width: <span className="font-mono">280px</span> (expanded)</p>
                      <p className="text-xs text-foreground">• Menu typography: <span className="font-mono">14px / Medium</span></p>
                      <p className="text-xs text-foreground">• Submenu typography: <span className="font-mono">13px / Regular</span></p>
                    </div>
                  </div>
                </div>
              </SubSection>
            </SectionWrapper>

            <Separator />

            {/* 9.5 DRAWERS & SHEETS */}
            <SectionWrapper id="drawers" title="Drawers & Sheets" icon={PanelBottom}>
              <SubSection
                title="DetailSheet — bottom sheet untuk menampilkan detail entitas"
                component='import { DetailSheet, DetailSheetFooter, DetailSheetInfoGrid, DetailSheetInfoItem, DetailSheetStatCard, DetailSheetSection } from "@/components/ui/detail-sheet"'
              >
                <p className="text-sm text-muted-foreground">
                  Bottom sheet standar dengan header (icon + title + badge), area konten scrollable,
                  dan footer aksi opsional. Cocok untuk preview detail (Mapel, Buku, Santri, dll) tanpa
                  pindah halaman. Sub-komponen tersedia: <code className="font-mono text-xs">DetailSheetInfoGrid</code>,
                  <code className="font-mono text-xs"> DetailSheetInfoItem</code>,
                  <code className="font-mono text-xs"> DetailSheetStatCard</code>,
                  <code className="font-mono text-xs"> DetailSheetSection</code>, dan
                  <code className="font-mono text-xs"> DetailSheetFooter</code>.
                </p>
                <DetailSheetDemo />
              </SubSection>
            </SectionWrapper>

            {/* 10. ANIMATIONS */}
            <SectionWrapper id="animations" title="Animations" icon={Play}>
              <SubSection title="fade-in">
                <AnimationDemo className="animate-fade-in" label="animate-fade-in" />
              </SubSection>
              <SubSection title="scale-in">
                <AnimationDemo className="animate-scale-in" label="animate-scale-in" />
              </SubSection>
              <SubSection title="Accordion (see Tabs components for live demo)">
                <p className="text-sm text-muted-foreground">accordion-down / accordion-up — used internally by Radix Accordion.</p>
              </SubSection>
            </SectionWrapper>

            {/* Back to top */}
            <div className="flex justify-center pt-8 pb-16">
              <Button variant="outline" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                <ArrowUp className="h-4 w-4" /> Back to top
              </Button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function DetailSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Eye className="h-4 w-4" /> Buka DetailSheet
      </Button>
      <DetailSheet
        open={open}
        onOpenChange={setOpen}
        icon={<BookOpen className="h-5 w-5" />}
        title="Akidah Akhlak"
        subtitle="Kode: AA-7-17"
        badge={{ label: "Aktif", variant: "success" }}
        footer={
          <DetailSheetFooter
            onClose={() => setOpen(false)}
            primaryAction={{
              label: "Lihat Detail",
              icon: <Eye className="h-4 w-4" />,
              onClick: () => setOpen(false),
            }}
            secondaryAction={{
              label: "Edit",
              icon: <Edit className="h-4 w-4" />,
              onClick: () => {},
            }}
          />
        }
      >
        <DetailSheetInfoGrid columns={2}>
          <DetailSheetInfoItem
            icon={<UserIcon className="h-3 w-3" />}
            label="Guru Pengampu"
            value="Asriani, SH."
          />
          <DetailSheetInfoItem
            icon={<GraduationCap className="h-3 w-3" />}
            label="Kelas / Tingkatan"
            value="Digisstar - 7"
          />
          <DetailSheetInfoItem
            icon={<Tag className="h-3 w-3" />}
            label="Kategori"
            value="Asrama"
          />
          <DetailSheetInfoItem
            icon={<CheckCircle className="h-3 w-3" />}
            label="Status"
            value={<Badge variant="success">Aktif</Badge>}
          />
        </DetailSheetInfoGrid>

        <DetailSheetSection icon={<Info className="h-4 w-4" />} title="Deskripsi Singkat">
          <p className="text-sm text-foreground">
            Mata pelajaran yang membahas dasar-dasar akidah dan akhlak Islam untuk membentuk
            karakter santri yang berakhlakul karimah.
          </p>
        </DetailSheetSection>

        <DetailSheetInfoGrid columns={3}>
          <DetailSheetStatCard
            icon={<Users className="h-4 w-4" />}
            label="Jumlah Santri"
            value="24"
          />
          <DetailSheetStatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Pertemuan / Minggu"
            value="2"
          />
          <DetailSheetStatCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Rata-rata Nilai"
            value="87"
          />
        </DetailSheetInfoGrid>
      </DetailSheet>
    </div>
  );
}

function AnimationDemo({ className, label }: { className: string; label: string }) {
  const [key, setKey] = useState(0);
  return (
    <div className="flex items-center gap-4">
      <div
        key={key}
        className={cn("w-24 h-24 rounded-xl bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-xs font-mono text-primary", className)}
      >
        {label}
      </div>
      <Button variant="outline" size="sm" onClick={() => setKey((k) => k + 1)}>
        Replay
      </Button>
    </div>
  );
}

// ============= SIDEBAR MENU DEMO =============

const sidebarItems = [
  { label: "Dashboard", icon: LayoutGrid, active: false },
  { label: "Users", icon: Users, active: false },
  { label: "Kehadiran Belajar", icon: ClipboardCheck, active: false },
  { label: "Jadwal Mengajar", icon: Calendar, active: false },
  { label: "Mata Pelajaran", icon: BookOpen, active: true },
  { label: "Kelas", icon: GraduationCap, active: false },
];

function SidebarMockup() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm w-full max-w-[280px]">
      {/* Brand */}
      <div className="p-4 flex items-center gap-3 border-b border-border">
        <img src={logo} alt="LMS Digiss" className="h-10 w-10 rounded-xl shadow-sm object-contain" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight">LMS Digiss</p>
          <p className="text-[11px] text-muted-foreground truncate">Learning Management System</p>
        </div>
      </div>

      {/* Menu */}
      <div className="p-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground">MENU UTAMA</p>
        {sidebarItems.map((item) => (
          <div
            key={item.label}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors",
              item.active
                ? "bg-primary/10 text-primary"
                : "text-foreground hover:bg-muted",
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        ))}

        {/* Submenu parent (collapsed) */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted cursor-pointer">
          <ClipboardCheck className="h-5 w-5 shrink-0" />
          <span className="flex-1 truncate">Absensi</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted cursor-pointer">
          <FileText className="h-5 w-5 shrink-0" />
          <span className="flex-1 truncate">Laporan</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted cursor-pointer">
          <Settings className="h-5 w-5 shrink-0" />
          <span className="truncate">Pengaturan</span>
        </div>
      </div>

      {/* Help footer */}
      <div className="p-3 border-t border-border">
        <p className="px-3 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground">BANTUAN</p>
        <div className="rounded-xl bg-primary/5 border border-primary/10 p-3 flex items-start gap-3">
          <LifeBuoy className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">Butuh bantuan?</p>
            <p className="text-[11px] text-muted-foreground">Kunjungi Pusat Bantuan</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarStateRow({ label, state }: { label: string; state: "default" | "hover" | "active" | "disabled" }) {
  const stateClass = {
    default: "text-foreground",
    hover: "bg-muted text-foreground",
    active: "bg-primary/10 text-primary",
    disabled: "text-muted-foreground/50 opacity-60",
  }[state];

  const desc = {
    default: "Tampilan normal",
    hover: "Saat kursor hover",
    active: "Halaman aktif",
    disabled: "Tidak dapat diakses",
  }[state];

  return (
    <div className="grid grid-cols-[80px_1fr_auto] items-center gap-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border border-border", stateClass)}>
        <LayoutGrid className="h-5 w-5 shrink-0" />
        <span className="truncate">Dashboard</span>
      </div>
      <p className="text-xs text-muted-foreground hidden md:block">{desc}</p>
    </div>
  );
}

function SidebarSubmenuMock({ expanded }: { expanded: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2 space-y-1 max-w-md">
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted cursor-pointer">
        <FileText className="h-5 w-5 shrink-0" />
        <span className="flex-1 truncate">Laporan</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-primary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {expanded && (
        <div className="ml-6 pl-3 border-l border-border space-y-0.5">
          {["Laporan Akademik", "Laporan Absensi", "Laporan Keuangan"].map((s, i) => (
            <div
              key={s}
              className={cn(
                "px-3 py-2 rounded-lg text-[13px] cursor-pointer transition-colors",
                i === 0 ? "text-primary font-medium" : "text-foreground hover:bg-muted",
              )}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
