import React, { useState, useEffect, useRef } from 'react';
import { useHrmAuth } from '@/contexts/HrmAuthContext';
import { hrmService } from '@/services/hrmService';
import { UserProfile, Role, Division, Shift, EmployeeDocument, EmployeeDocumentType } from '@/types/hrm';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  Image as ImageIcon,
  Camera,
  RotateCcw,
  FileSpreadsheet,
  Download,
  FileUp,
  AlertTriangle,
  FileText,
  Smartphone,
  ArrowRightLeft,
  Undo2,
  Building2,
  MapPin,
  Send,
  X,
  Briefcase,
  UserCircle,
  BookOpen,
  Phone,
  Mail,
  Home,
  HeartHandshake,
  Shield,
  ScanFace,
  KeyRound,
} from 'lucide-react';
import { HrmFaceEnrollmentModal } from '@/components/hrm/HrmFaceEnrollmentModal';
import {
  preprocessKtpImage,
  parseAndValidateNik,
  extractKtpFieldsFromText,
  ParsedKTP
} from '@/services/documentOcrService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import * as XLSX from 'xlsx';

export const HrmEmployeesPage: React.FC = () => {
  const { user: currentUser } = useHrmAuth();
  const isSuperAdmin = (currentUser?.roleName || '').toLowerCase() === 'superadmin';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Biometric Face Enrollment Modal State
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollUser, setEnrollUser] = useState<UserProfile | null>(null);

  // Reassignment / Location Mutation Modal
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignUser, setReassignUser] = useState<UserProfile | null>(null);
  const [targetDivisionId, setTargetDivisionId] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignMessage, setReassignMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk Import State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkInputMethod, setBulkInputMethod] = useState<'file' | 'text'>('file');
  const [bulkText, setBulkText] = useState('');
  const [bulkParsedRows, setBulkParsedRows] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // KTP Vision OCR State
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | null>(null);
  const [ocrParsed, setOcrParsed] = useState<ParsedKTP | null>(null);
  const [ocrInputText, setOcrInputText] = useState('');
  const ktpFileRef = useRef<HTMLInputElement>(null);

  const handleKtpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrProcessing(true);
    setOcrModalOpen(true);
    try {
      const processed = await preprocessKtpImage(file);
      setOcrPreviewUrl(processed.processedDataUrl);
      // Run extraction heuristics on filename / initial hints
      const parsed = extractKtpFieldsFromText(file.name);
      setOcrParsed(parsed);
    } catch (err: any) {
      console.error(err);
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleApplyOcrData = () => {
    if (!ocrParsed) return;
    if (ocrParsed.nik) {
      setNik(ocrParsed.nik);
      if (!nip) setNip(ocrParsed.nik);
    }
    if (ocrParsed.fullName) setFullName(ocrParsed.fullName);
    if (ocrParsed.gender) setGender(ocrParsed.gender === 'PEREMPUAN' ? 'P' : 'L');
    if (ocrParsed.birthDate) setBirthDate(ocrParsed.birthDate);
    if (ocrParsed.birthPlace) setBirthPlace(ocrParsed.birthPlace);
    if (ocrParsed.address) setAddress(ocrParsed.address);
    if (ocrParsed.religion) setReligion(ocrParsed.religion);
    if (ocrParsed.maritalStatus) setMaritalStatus(ocrParsed.maritalStatus);
    setOcrModalOpen(false);
  };

  // Form Fields — Basic
  const [nip, setNip] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [kepalaReguId, setKepalaReguId] = useState('');
  const [annualLeave, setAnnualLeave] = useState(12);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form Fields — Extended Personal
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'L' | 'P' | ''>('');
  const [birthPlace, setBirthPlace] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [religion, setReligion] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [education, setEducation] = useState('');
  const [nik, setNik] = useState('');
  const [npwpPersonal, setNpwpPersonal] = useState('');

  // Form Fields — Contact & Address
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState('');

  // Form Fields — Employment
  const [joinDate, setJoinDate] = useState('');
  const [contractType, setContractType] = useState<'PKWT' | 'PKWTT' | 'Magang' | 'Freelance' | ''>('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [bpjsKesehatan, setBpjsKesehatan] = useState('');
  const [bpjsKetenagakerjaan, setBpjsKetenagakerjaan] = useState('');

  // Form Fields — Employee Documents
  const [empDocs, setEmpDocs] = useState<EmployeeDocument[]>([]);
  const [empDocModalOpen, setEmpDocModalOpen] = useState(false);
  const [empDocName, setEmpDocName] = useState('');
  const [empDocType, setEmpDocType] = useState<EmployeeDocumentType>('ktp');
  const [empDocFileUrl, setEmpDocFileUrl] = useState<string | null>(null);
  const [empDocFileType, setEmpDocFileType] = useState('');
  const [empDocFileSizeKb, setEmpDocFileSizeKb] = useState(0);
  const [empDocNotes, setEmpDocNotes] = useState('');
  const empDocFileRef = useRef<HTMLInputElement>(null);

  // Form Tab
  const [formTab, setFormTab] = useState<'identitas' | 'kontak' | 'kepegawaian' | 'dokumen'>('identitas');

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Silakan pilih file gambar yang valid (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran foto maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const loadData = async () => {
    setUsers(hrmService.getUsers());
    setRoles(hrmService.getRoles());
    setDivisions(hrmService.getDivisions());
    setShifts(hrmService.getShifts());

    // Synchronize with PostgreSQL database to ensure fresh records
    const synced = await hrmService.syncWithBackend().catch(() => false);
    if (synced) {
      setUsers(hrmService.getUsers());
      setRoles(hrmService.getRoles());
      setDivisions(hrmService.getDivisions());
      setShifts(hrmService.getShifts());
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      setUsers(hrmService.getUsers());
      setRoles(hrmService.getRoles());
      setDivisions(hrmService.getDivisions());
      setShifts(hrmService.getShifts());
    };
    window.addEventListener('hrm_users_updated', handleUpdate);
    window.addEventListener('hrm_data_updated', handleUpdate);
    return () => {
      window.removeEventListener('hrm_users_updated', handleUpdate);
      window.removeEventListener('hrm_data_updated', handleUpdate);
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormTab('identitas');
    setNip(`EMP${String(users.length + 1).padStart(3, '0')}`);
    setFullName(''); setEmail(''); setPassword('password123'); setPhone('');
    setRoleId(roles.find((r) => r.name === 'karyawan')?.id || roles[0]?.id || '');
    setDivisionId(divisions[0]?.id || ''); setShiftId(shifts[0]?.id || '');
    setKepalaReguId('');
    setAnnualLeave(12); setAvatarUrl(null); setFormError(null);
    // Extended
    setNickname(''); setGender(''); setBirthPlace(''); setBirthDate(''); setReligion('');
    setMaritalStatus(''); setBloodType(''); setEducation(''); setNik(''); setNpwpPersonal('');
    setAddress(''); setCity(''); setProvince(''); setPostalCode('');
    setEmergencyContactName(''); setEmergencyContactPhone(''); setEmergencyContactRelation('');
    setJoinDate(''); setContractType(''); setContractEndDate('');
    setBpjsKesehatan(''); setBpjsKetenagakerjaan('');
    setEmpDocs([]);
    setModalOpen(true);
  };

  const handleOpenEdit = (user: UserProfile) => {
    setEditingUser(user);
    setFormTab('identitas');
    setNip(user.nip); setFullName(user.fullName); setEmail(user.email);
    setPassword(user.password || 'password123'); setPhone(user.phone || '');
    setRoleId(user.roleId || ''); setDivisionId(user.divisionId || '');
    setShiftId(user.shiftId || ''); setAnnualLeave(user.annualLeaveQuota || 12);
    setKepalaReguId(user.kepalaReguId || '');
    setAvatarUrl(user.avatarUrl || null); setFormError(null);
    // Extended personal
    setNickname(user.nickname || ''); setGender(user.gender || '');
    setBirthPlace(user.birthPlace || ''); setBirthDate(user.birthDate || '');
    setReligion(user.religion || ''); setMaritalStatus(user.maritalStatus || '');
    setBloodType(user.bloodType || ''); setEducation(user.education || '');
    setNik(user.nik || ''); setNpwpPersonal(user.npwpPersonal || '');
    // Contact
    setAddress(user.address || ''); setCity(user.city || '');
    setProvince(user.province || ''); setPostalCode(user.postalCode || '');
    setEmergencyContactName(user.emergencyContactName || '');
    setEmergencyContactPhone(user.emergencyContactPhone || '');
    setEmergencyContactRelation(user.emergencyContactRelation || '');
    // Employment
    setJoinDate(user.joinDate || ''); setContractType(user.contractType || '');
    setContractEndDate(user.contractEndDate || '');
    setBpjsKesehatan(user.bpjsKesehatan || '');
    setBpjsKetenagakerjaan(user.bpjsKetenagakerjaan || '');
    setEmpDocs(user.employeeDocuments || []);
    setModalOpen(true);
  };

  const handleSave = () => {
    setFormError(null);
    if (!nip.trim()) { setFormError('NIP / NIK karyawan wajib diisi'); return; }
    if (!fullName.trim()) { setFormError('Nama lengkap karyawan wajib diisi'); return; }
    if (!email.trim()) { setFormError('Email karyawan wajib diisi'); return; }

    const selectedRole = roles.find((r) => r.id === roleId);
    // Enforce: Hanya Superadmin yang bisa menentukan role Superadmin
    if (selectedRole?.name === 'superadmin' && !isSuperAdmin) {
      setFormError('Akses Ditolak: Hanya Superadmin yang berhak menetapkan akun dengan role Superadmin.');
      return;
    }

    const selectedDivision = divisions.find((d) => d.id === divisionId);
    const selectedKr = users.find((u) => u.id === kepalaReguId);

    const extendedFields = {
      nickname: nickname || undefined,
      gender: (gender as 'L' | 'P') || undefined,
      birthPlace: birthPlace || undefined,
      birthDate: birthDate || undefined,
      religion: religion || undefined,
      maritalStatus: maritalStatus || undefined,
      bloodType: bloodType || undefined,
      education: education || undefined,
      nik: nik || undefined,
      npwpPersonal: npwpPersonal || undefined,
      address: address || undefined,
      city: city || undefined,
      province: province || undefined,
      postalCode: postalCode || undefined,
      emergencyContactName: emergencyContactName || undefined,
      emergencyContactPhone: emergencyContactPhone || undefined,
      emergencyContactRelation: emergencyContactRelation || undefined,
      joinDate: joinDate || undefined,
      contractType: (contractType as any) || undefined,
      contractEndDate: contractEndDate || undefined,
      bpjsKesehatan: bpjsKesehatan || undefined,
      bpjsKetenagakerjaan: bpjsKetenagakerjaan || undefined,
      employeeDocuments: empDocs,
      kepalaReguId: kepalaReguId && kepalaReguId !== 'none' ? kepalaReguId : undefined,
      kepalaReguName: selectedKr ? selectedKr.fullName : undefined,
    };

    try {
      if (editingUser) {
        hrmService.updateUser(editingUser.id, {
          nip, fullName, email, phone, password, roleId,
          roleName: selectedRole?.name || 'karyawan',
          divisionId, divisionName: selectedDivision?.name || '-',
          shiftId, annualLeaveQuota: Number(annualLeave),
          avatarUrl: avatarUrl || undefined,
          kepalaReguId: kepalaReguId && kepalaReguId !== 'none' ? kepalaReguId : '',
          kepalaReguName: selectedKr ? selectedKr.fullName : '',
          ...extendedFields,
        });
      } else {
        hrmService.addUser({
          nip, fullName, email, phone, password, roleId,
          roleName: selectedRole?.name || 'karyawan',
          divisionId, divisionName: selectedDivision?.name || '-',
          shiftId, annualLeaveQuota: Number(annualLeave),
          usedLeaveDays: 0, isActive: true,
          avatarUrl: avatarUrl || undefined,
          kepalaReguId: kepalaReguId && kepalaReguId !== 'none' ? kepalaReguId : undefined,
          kepalaReguName: selectedKr ? selectedKr.fullName : undefined,
          ...extendedFields,
        });
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data karyawan');
    }
  };

  const handleToggleStatus = (user: UserProfile) => {
    if (user.roleName === 'superadmin') {
      alert('Akun Super Admin utama tidak dapat dinonaktifkan.');
      return;
    }
    hrmService.updateUser(user.id, { isActive: !user.isActive });
    loadData();
  };

  const handleDelete = (user: UserProfile) => {
    if (user.roleName === 'superadmin') {
      alert('Akun Super Admin tidak dapat dihapus');
      return;
    }
    if (confirm(`Hapus karyawan "${user.fullName}" (${user.nip}) dari sistem?`)) {
      hrmService.deleteUser(user.id);
      loadData();
    }
  };

  // Reassignment & Mutation Handlers
  const handleOpenReassign = (user: UserProfile) => {
    setReassignUser(user);
    setTargetDivisionId(user.divisionId || divisions[0]?.id || '');
    setReassignNotes(user.assignmentNotes || '');
    setReassignMessage(null);
    setReassignModalOpen(true);
  };

  const handleConfirmReassign = () => {
    if (!reassignUser || !targetDivisionId) return;
    setReassignSubmitting(true);
    try {
      hrmService.assignUserDivision(
        reassignUser.id,
        targetDivisionId,
        reassignNotes.trim(),
        'Admin HRD'
      );
      setReassignModalOpen(false);
      loadData();
      alert(`Berhasil memindahkan ${reassignUser.fullName}. Notifikasi otomatis telah dikirim ke karyawan dan log admin.`);
    } catch (err: any) {
      alert(err.message || 'Gagal memindahkan lokasi karyawan.');
    } finally {
      setReassignSubmitting(false);
    }
  };

  const handleRestoreDivision = (user: UserProfile) => {
    if (!user.originalDivisionId) return;
    if (
      confirm(
        `Kembalikan ${user.fullName} ke divisi asalnya (${user.originalDivisionName || 'Divisi Asal'})?`
      )
    ) {
      try {
        hrmService.restoreUserOriginalDivision(user.id, 'Admin HRD');
        loadData();
        alert(`Karyawan ${user.fullName} telah dikembalikan ke divisi asal. Notifikasi telah dikirimkan.`);
      } catch (err: any) {
        alert(err.message || 'Gagal mengembalikan karyawan ke divisi asal.');
      }
    }
  };

  // Bulk Import Handlers
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        NIP: 'EMP010',
        Nama_Lengkap: 'Budi Pratama',
        Email: 'budi.pratama@perusahaan.co.id',
        Password: 'password123',
        Divisi: divisions[0]?.name || 'Teknologi Informasi (IT)',
        Role: 'karyawan',
        Shift: shifts[0]?.name || 'Normal Day (Pagi)',
        Kuota_Cuti: 12,
        Telepon: '081234567890',
      },
      {
        NIP: 'EMP011',
        Nama_Lengkap: 'Siti Rahmawati',
        Email: 'siti.rahma@perusahaan.co.id',
        Password: 'password123',
        Divisi: divisions[1]?.name || 'Human Resource (HRD)',
        Role: 'karyawan',
        Shift: shifts[0]?.name || 'Normal Day (Pagi)',
        Kuota_Cuti: 12,
        Telepon: '081234567891',
      },
    ];

    const refDivisions = divisions.map((d) => ({ Kode: d.code, Nama_Divisi: d.name }));
    const refRoles = roles.map((r) => ({ Role_Key: r.name, Nama_Label: r.label }));

    const wb = XLSX.utils.book_new();
    const wsTemplate = XLSX.utils.json_to_sheet(templateData);
    const wsDiv = XLSX.utils.json_to_sheet(refDivisions);
    const wsRoles = XLSX.utils.json_to_sheet(refRoles);

    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Template_Karyawan');
    XLSX.utils.book_append_sheet(wb, wsDiv, 'Referensi_Divisi');
    XLSX.utils.book_append_sheet(wb, wsRoles, 'Referensi_Role');

    XLSX.writeFile(wb, 'Template_Import_Karyawan_HRM.xlsx');
  };

  const validateAndMapRow = (row: any, index: number, currentBatchNips: Set<string>, currentBatchEmails: Set<string>) => {
    const errors: string[] = [];
    const nipVal = String(row.NIP || row.nip || row['No. Induk'] || '').trim();
    const nameVal = String(row.Nama_Lengkap || row.nama || row.FullName || row.fullName || '').trim();
    const emailVal = String(row.Email || row.email || '').trim().toLowerCase();
    const passVal = String(row.Password || row.password || 'password123').trim();
    const divNameVal = String(row.Divisi || row.divisi || row.Division || '').trim();
    const roleNameVal = String(row.Role || row.role || 'karyawan').trim().toLowerCase();
    const shiftNameVal = String(row.Shift || row.shift || '').trim();
    const leaveVal = Number(row.Kuota_Cuti || row.kuota_cuti || 12);
    const phoneVal = String(row.Telepon || row.telepon || row.phone || '').trim();

    if (!nipVal) errors.push(`Baris ${index + 1}: NIP wajib diisi`);
    if (currentBatchNips.has(nipVal) || users.some((u) => u.nip.toLowerCase() === nipVal.toLowerCase())) {
      errors.push(`Baris ${index + 1}: NIP "${nipVal}" sudah terdaftar / duplikat`);
    }

    if (!nameVal) errors.push(`Baris ${index + 1}: Nama Lengkap wajib diisi`);

    if (!emailVal) {
      errors.push(`Baris ${index + 1}: Email wajib diisi`);
    } else if (!emailVal.includes('@')) {
      errors.push(`Baris ${index + 1}: Format email "${emailVal}" tidak valid`);
    } else if (currentBatchEmails.has(emailVal) || users.some((u) => u.email.toLowerCase() === emailVal)) {
      errors.push(`Baris ${index + 1}: Email "${emailVal}" sudah terdaftar / duplikat`);
    }

    // Match division
    const matchedDiv = divisions.find(
      (d) =>
        d.id === divNameVal ||
        d.code.toLowerCase() === divNameVal.toLowerCase() ||
        d.name.toLowerCase().includes(divNameVal.toLowerCase())
    ) || divisions[0];

    // Match role
    const matchedRole = roles.find(
      (r) =>
        r.id === roleNameVal ||
        r.name.toLowerCase() === roleNameVal.toLowerCase() ||
        r.label.toLowerCase() === roleNameVal.toLowerCase()
    ) || roles.find((r) => r.name === 'karyawan') || roles[0];

    // Match shift
    const matchedShift = shifts.find(
      (s) =>
        s.id === shiftNameVal ||
        s.name.toLowerCase().includes(shiftNameVal.toLowerCase())
    ) || shifts[0];

    if (nipVal) currentBatchNips.add(nipVal);
    if (emailVal) currentBatchEmails.add(emailVal);

    return {
      _index: index + 1,
      _isValid: errors.length === 0,
      _errors: errors,
      nip: nipVal,
      fullName: nameVal,
      email: emailVal,
      password: passVal,
      roleId: matchedRole?.id || '',
      roleName: matchedRole?.name || 'karyawan',
      divisionId: matchedDiv?.id || '',
      divisionName: matchedDiv?.name || '-',
      shiftId: matchedShift?.id || '',
      annualLeaveQuota: isNaN(leaveVal) || leaveVal < 0 ? 12 : leaveVal,
      usedLeaveDays: 0,
      phone: phoneVal,
      isActive: true,
    };
  };

  const handleBulkFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setBulkErrors(['File Excel/CSV tidak memiliki data baris atau kosong.']);
          setBulkParsedRows([]);
          return;
        }

        const batchNips = new Set<string>();
        const batchEmails = new Set<string>();
        const parsed = rawJson.map((row, idx) => validateAndMapRow(row, idx, batchNips, batchEmails));

        const collectedErrors: string[] = [];
        parsed.forEach((p) => {
          if (!p._isValid) collectedErrors.push(...p._errors);
        });

        setBulkParsedRows(parsed);
        setBulkErrors(collectedErrors);
        setBulkSuccessMsg(null);
      } catch (err: any) {
        setBulkErrors([`Gagal membaca file: ${err.message || 'Format tidak dikenali'}`]);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleBulkTextParse = () => {
    if (!bulkText.trim()) {
      setBulkErrors(['Silakan tempel (paste) data terlebih dahulu.']);
      return;
    }

    const lines = bulkText.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setBulkErrors(['Tidak ada baris data yang ditemukan.']);
      return;
    }

    // Determine separator: Tab (from Excel/Sheets) or comma or semicolon
    const firstLine = lines[0];
    let sep = '\t';
    if (!firstLine.includes('\t')) {
      if (firstLine.includes(';')) sep = ';';
      else if (firstLine.includes(',')) sep = ',';
    }

    // Check if first line is header
    const lowerFirst = firstLine.toLowerCase();
    const hasHeader = lowerFirst.includes('nip') || lowerFirst.includes('nama') || lowerFirst.includes('email');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const batchNips = new Set<string>();
    const batchEmails = new Set<string>();

    const parsed = dataLines.map((line, idx) => {
      const cols = line.split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      const rowObj: any = {
        NIP: cols[0] || '',
        Nama_Lengkap: cols[1] || '',
        Email: cols[2] || '',
        Password: cols[3] || 'password123',
        Divisi: cols[4] || '',
        Role: cols[5] || 'karyawan',
        Shift: cols[6] || '',
        Kuota_Cuti: cols[7] || '12',
        Telepon: cols[8] || '',
      };
      return validateAndMapRow(rowObj, idx, batchNips, batchEmails);
    });

    const collectedErrors: string[] = [];
    parsed.forEach((p) => {
      if (!p._isValid) collectedErrors.push(...p._errors);
    });

    setBulkParsedRows(parsed);
    setBulkErrors(collectedErrors);
    setBulkSuccessMsg(null);
  };

  const handleExecuteBulkImport = () => {
    const validRows = bulkParsedRows.filter((r) => r._isValid);
    if (validRows.length === 0) {
      alert('Tidak ada data valid yang dapat diimpor. Silakan periksa kembali daftar data.');
      return;
    }

    try {
      const usersToInsert = validRows.map((r) => ({
        nip: r.nip,
        fullName: r.fullName,
        email: r.email,
        password: r.password,
        phone: r.phone,
        roleId: r.roleId,
        roleName: r.roleName,
        divisionId: r.divisionId,
        divisionName: r.divisionName,
        shiftId: r.shiftId,
        annualLeaveQuota: r.annualLeaveQuota,
        usedLeaveDays: 0,
        isActive: true,
      }));

      const inserted = hrmService.bulkAddUsers(usersToInsert);
      loadData();
      setBulkSuccessMsg(`Berhasil mengimpor ${inserted.successCount} data karyawan secara massal!`);
      setBulkParsedRows([]);
      setBulkText('');
      setTimeout(() => {
        setBulkModalOpen(false);
        setBulkSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setBulkErrors([`Gagal mengimpor data: ${err.message || 'Terjadi kesalahan sistem'}`]);
    }
  };

  // Filtered list
  const filteredUsers = users.filter((u) => {
    const matchQuery =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchDiv = filterDivision === 'all' || u.divisionId === filterDivision;
    const matchRole = filterRole === 'all' || u.roleId === filterRole || u.roleName?.toLowerCase() === filterRole.toLowerCase();
    return matchQuery && matchDiv && matchRole;
  });

  const handleResetDevice = (u: UserProfile) => {
    if (window.confirm(`Reset kunci perangkat fisik untuk ${u.fullName}?\n\nKaryawan akan dapat menautkan HP/laptop baru saat presensi berikutnya.`)) {
      hrmService.resetUserDeviceBinding(u.id);
      loadData();
      alert(`Kunci perangkat untuk ${u.fullName} berhasil di-reset.`);
    }
  };

  const handleOpenFaceEnrollment = (u: UserProfile) => {
    setEnrollUser(u);
    setEnrollModalOpen(true);
  };

  const handleResetFace = async (u: UserProfile) => {
    if (window.confirm(`Reset data biometrik wajah master untuk ${u.fullName}?\n\nKaryawan harus mendaftarkan wajahnya kembali agar bisa presensi.`)) {
      await hrmService.resetMasterFace(u.id);
      loadData();
      alert(`Wajah master untuk ${u.fullName} berhasil di-reset.`);
    }
  };

  // Reset Password State for Superadmin
  const [resetPasswordUser, setResetPasswordUser] = useState<UserProfile | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('password123');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const handleOpenResetPassword = (u: UserProfile) => {
    setResetPasswordUser(u);
    setNewResetPassword('password123');
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPasswordUser) return;
    if (!newResetPassword || newResetPassword.length < 6) {
      alert('Kata sandi minimal 6 karakter.');
      return;
    }
    setIsResettingPassword(true);
    try {
      const res = await hrmService.resetPassword(resetPasswordUser.id, newResetPassword);
      if (res.success) {
        alert(`Kata sandi untuk ${resetPasswordUser.fullName} berhasil di-reset menjadi "${newResetPassword}". Karyawan dapat langsung masuk menggunakan sandi baru.`);
        setResetPasswordUser(null);
        loadData();
      } else {
        alert(res.error || 'Gagal mereset kata sandi');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal mereset kata sandi');
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Data Karyawan & Hak Akses
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Daftarkan akun karyawan, tentukan divisinya, role akses, serta penugasan shift kerja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setBulkParsedRows([]);
              setBulkErrors([]);
              setBulkSuccessMsg(null);
              setBulkText('');
              setBulkModalOpen(true);
            }}
            className="border-primary/30 text-primary hover:bg-primary/10 rounded-xl gap-2 font-medium shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Banyak (Excel/CSV)
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-sm gap-2"
          >
            <Plus className="w-4 h-4" />
            Daftarkan Karyawan
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border rounded-xl shadow-sm">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Cari Nama, NIP, atau Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs rounded-xl"
              />
            </div>

            <Select value={filterDivision} onValueChange={setFilterDivision}>
              <SelectTrigger className="text-xs rounded-xl">
                <SelectValue placeholder="Semua Divisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Divisi</SelectItem>
                {divisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="text-xs rounded-xl">
                <SelectValue placeholder="Semua Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.name}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee Table */}
      <Card className="border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted/40 border-b border-border uppercase text-[11px] text-muted-foreground font-medium tracking-wider">
              <tr>
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">NIP / NIK</th>
                <th className="py-3 px-4">Divisi</th>
                <th className="py-3 px-4">Role Akses</th>
                <th className="py-3 px-4">Biometrik Wajah</th>
                <th className="py-3 px-4">Sisa Cuti</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    Tidak ada karyawan yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const remaining = (u.annualLeaveQuota || 12) - (u.usedLeaveDays || 0);
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {u.avatarUrl ? (
                            <img
                              src={u.avatarUrl}
                              alt={u.fullName}
                              className="w-8 h-8 rounded-full object-cover border border-primary/20 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                              {u.fullName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-foreground">{u.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-medium text-foreground">
                        {u.nip}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-foreground whitespace-nowrap">
                        {u.originalDivisionId ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{u.divisionName}</span>
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-300 text-[10px] px-1.5 py-0">
                                Mutasi
                              </Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground block">
                              Asal: {u.originalDivisionName}
                            </span>
                          </div>
                        ) : (
                          <span>{u.divisionName || '-'}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                          {u.roleName}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {u.isFaceEnrolled ? (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] py-0 px-2 rounded-full font-medium">
                              ✓ Terdaftar (128-D)
                            </Badge>
                            <button
                              type="button"
                              onClick={() => handleResetFace(u)}
                              className="text-muted-foreground hover:text-rose-600 transition-colors p-1 rounded"
                              title="Reset Data Wajah Master Karyawan"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenFaceEnrollment(u)}
                            className="h-6 text-[10px] px-2 py-0 border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 rounded-lg gap-1 font-medium"
                          >
                            <ScanFace className="w-3 h-3" />
                            Daftarkan
                          </Button>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-foreground text-xs">{remaining} Hari</span>
                        <span className="text-[10px] text-muted-foreground block">
                          Terpakai: {u.usedLeaveDays || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" /> Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Mutasi / Pindah Lokasi Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReassign(u)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Pindah Lokasi / Divisi Kerja Karyawan"
                          >
                            <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                          </Button>

                          {/* Kembalikan ke Divisi Asal Button */}
                          {u.originalDivisionId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRestoreDivision(u)}
                              className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 rounded-lg transition-colors"
                              title={`Kembalikan ke divisi asal (${u.originalDivisionName})`}
                            >
                              <Undo2 className="w-4 h-4" />
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetDevice(u)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title={u.registeredDeviceId ? `Kunci Perangkat Terikat (${u.deviceModel || 'Perangkat'}). Klik untuk Reset.` : 'Belum Ada Perangkat Terikat'}
                          >
                            <Smartphone className={`w-4 h-4 ${u.registeredDeviceId ? 'text-blue-600' : 'text-muted-foreground/30'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenResetPassword(u)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title={`Reset Kata Sandi ${u.fullName} (Superadmin)`}
                          >
                            <KeyRound className="w-4 h-4 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                            title="Ubah Data Karyawan"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(u)}
                            className={`h-8 w-8 p-0 rounded-lg transition-colors ${
                              u.isActive
                                ? 'text-muted-foreground hover:text-amber-600 hover:bg-amber-500/10'
                                : 'text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10'
                            }`}
                            title={u.isActive ? 'Nonaktifkan Karyawan' : 'Aktifkan Karyawan'}
                          >
                            {u.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(u)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title="Hapus Karyawan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Employee Dialog — 4-Tab Version */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl rounded-2xl">
          <DialogHeader className="pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {editingUser ? `Edit Data: ${editingUser.fullName}` : 'Pendaftaran Karyawan Baru'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Lengkapi data karyawan pada setiap tab. Tab bertanda (*) wajib diisi.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          {/* Tab Navigation */}
          <div className="flex gap-1 border-b border-border pb-0 -mb-2 overflow-x-auto">
            {[
              { id: 'identitas', label: 'Identitas *', icon: UserCircle },
              { id: 'kontak', label: 'Kontak & Alamat', icon: Home },
              { id: 'kepegawaian', label: 'Kepegawaian *', icon: Briefcase },
              { id: 'dokumen', label: 'Foto & Dokumen', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = formTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setFormTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all -mb-px whitespace-nowrap ${
                    active ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{tab.label}
                </button>
              );
            })}
          </div>

          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4 pt-2">

            {/* ── TAB: IDENTITAS ────────────────────────────── */}
            {formTab === 'identitas' && (
              <div className="space-y-4">
                {/* KTP Document Scan Banner */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-background text-foreground border border-border">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">Pindai Dokumen e-KTP</p>
                      <p className="text-[11px] text-muted-foreground">
                        Unggah foto KTP untuk pengisian data identitas secara otomatis.
                      </p>
                    </div>
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={ktpFileRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleKtpFileChange}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs gap-1.5 border-border hover:bg-background text-foreground font-medium w-full sm:w-auto h-8 shadow-xs"
                      onClick={() => ktpFileRef.current?.click()}
                    >
                      <Upload size={13} /> Unggah e-KTP
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">NIP / NIK <span className="text-destructive">*</span></Label>
                    <Input value={nip} onChange={(e) => setNip(e.target.value)} placeholder="EMP010" className="text-xs rounded-xl font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nama Lengkap <span className="text-destructive">*</span></Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama Lengkap dengan Gelar" className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Nama Panggilan / Alias</Label>
                    <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Budi" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Jenis Kelamin</Label>
                    <Select value={gender} onValueChange={(v) => setGender(v as any)}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tempat Lahir</Label>
                    <Input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="Jakarta" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tanggal Lahir</Label>
                    <DatePicker value={birthDate} onChange={(v) => setBirthDate(v)} placeholder="Tanggal lahir" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Agama</Label>
                    <Select value={religion} onValueChange={setReligion}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        {['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'].map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Status Pernikahan</Label>
                    <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        {['Belum Menikah', 'Menikah', 'Cerai'].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Golongan Darah</Label>
                    <Select value={bloodType} onValueChange={setBloodType}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        {['A', 'B', 'AB', 'O', 'A+', 'B+', 'AB+', 'O+', 'A-', 'B-', 'AB-', 'O-'].map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Pendidikan Terakhir</Label>
                    <Select value={education} onValueChange={setEducation}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        {['SD', 'SMP', 'SMA/SMK', 'D1', 'D2', 'D3', 'D4/S1', 'S2', 'S3'].map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">NIK KTP (16 digit)</Label>
                    <Input value={nik} onChange={(e) => setNik(e.target.value)} placeholder="3271xxxxxxxx0001" className="text-xs rounded-xl font-mono" maxLength={16} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">NPWP Pribadi</Label>
                    <Input value={npwpPersonal} onChange={(e) => setNpwpPersonal(e.target.value)} placeholder="00.000.000.0-000.000" className="text-xs rounded-xl font-mono" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: KONTAK & ALAMAT ──────────────────────── */}
            {formTab === 'kontak' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Email (Login) <span className="text-destructive">*</span></Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="karyawan@perusahaan.com" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Kata Sandi Awal</Label>
                    <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password123" className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nomor Telepon / WhatsApp</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxxx" className="text-xs rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Alamat Lengkap</Label>
                  <Textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. Nama Jalan No. 1, RT/RW..." className="text-xs rounded-xl resize-none" rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Kota</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Jakarta" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Provinsi</Label>
                    <Input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="DKI Jakarta" className="text-xs rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Kode Pos</Label>
                    <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="12345" className="text-xs rounded-xl font-mono" maxLength={5} />
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-3">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><HeartHandshake className="w-3.5 h-3.5 text-primary" /> Kontak Darurat</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Nama Kontak Darurat</Label>
                      <Input value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} placeholder="Nama Ayah / Suami / dll" className="text-xs rounded-xl" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Hubungan</Label>
                      <Input value={emergencyContactRelation} onChange={(e) => setEmergencyContactRelation(e.target.value)} placeholder="Ayah / Suami / Istri / Saudara" className="text-xs rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">No. Telepon Darurat</Label>
                    <Input value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} placeholder="0812xxxxxxxx" className="text-xs rounded-xl" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: KEPEGAWAIAN ──────────────────────────── */}
            {formTab === 'kepegawaian' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Divisi / Departemen <span className="text-destructive">*</span></Label>
                    <Select value={divisionId} onValueChange={setDivisionId}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih Divisi" /></SelectTrigger>
                      <SelectContent>
                        {divisions.map((d) => (<SelectItem key={d.id} value={d.id}>{d.name} ({d.code})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Role Akses <span className="text-destructive">*</span></Label>
                    <Select value={roleId} onValueChange={setRoleId}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih Role" /></SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (<SelectItem key={r.id} value={r.id}>{r.label} ({r.name})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Shift Kerja</Label>
                    <Select value={shiftId} onValueChange={setShiftId}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih Shift" /></SelectTrigger>
                      <SelectContent>
                        {shifts.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Kuota Cuti Tahunan (Hari)</Label>
                    <Input type="number" value={annualLeave} onChange={(e) => setAnnualLeave(Number(e.target.value))} className="text-xs rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Jenis Kontrak</Label>
                    <Select value={contractType} onValueChange={(v) => setContractType(v as any)}>
                      <SelectTrigger className="text-xs rounded-xl"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                      <SelectContent>
                        {['PKWTT', 'PKWT', 'Magang', 'Freelance'].map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tanggal Bergabung</Label>
                    <DatePicker value={joinDate} onChange={(v) => setJoinDate(v)} placeholder="Tanggal bergabung" />
                  </div>
                </div>
                {contractType === 'PKWT' && (
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tanggal Kontrak Berakhir</Label>
                    <DatePicker value={contractEndDate} onChange={(v) => setContractEndDate(v)} placeholder="Tanggal kontrak berakhir" />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">No. BPJS Kesehatan</Label>
                    <Input value={bpjsKesehatan} onChange={(e) => setBpjsKesehatan(e.target.value)} placeholder="0001234567890" className="text-xs rounded-xl font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">No. BPJS Ketenagakerjaan</Label>
                    <Input value={bpjsKetenagakerjaan} onChange={(e) => setBpjsKetenagakerjaan(e.target.value)} placeholder="12345678901234" className="text-xs rounded-xl font-mono" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: FOTO & DOKUMEN ───────────────────────── */}
            {formTab === 'dokumen' && (
              <div className="space-y-5">
                {/* Foto Profil */}
                <div className="p-4 bg-muted/30 border border-border rounded-xl">
                  <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-primary" /> Foto Profil Karyawan</p>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-primary shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-card border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground">
                          <Camera className="w-6 h-6" />
                          <span className="text-[9px] mt-0.5">Foto</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input type="file" ref={fileInputRef} onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!file.type.startsWith('image/')) { alert('Pilih file gambar'); return; }
                        if (file.size > 2 * 1024 * 1024) { alert('Maks 2MB'); return; }
                        const reader = new FileReader();
                        reader.onload = () => setAvatarUrl(reader.result as string);
                        reader.readAsDataURL(file);
                      }} accept="image/*" className="hidden" />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs gap-1.5 h-8 rounded-lg border-border">
                          <Upload className="w-3.5 h-3.5 text-primary" /> Unggah Foto
                        </Button>
                        {avatarUrl && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(null)} className="text-xs h-8 rounded-lg text-muted-foreground hover:text-destructive">
                            Hapus
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">JPG/PNG/WebP, maks 2 MB. Foto tampil di tabel dan profil karyawan.</p>
                    </div>
                  </div>
                </div>

                {/* Dokumen Karyawan */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-primary" /> Dokumen Karyawan ({empDocs.length})</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                      setEmpDocName(''); setEmpDocType('ktp'); setEmpDocFileUrl(null);
                      setEmpDocFileType(''); setEmpDocFileSizeKb(0); setEmpDocNotes('');
                      if (empDocFileRef.current) empDocFileRef.current.value = '';
                      setEmpDocModalOpen(true);
                    }} className="text-xs h-7 gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10">
                      <Plus className="w-3 h-3" /> Tambah Dokumen
                    </Button>
                  </div>

                  {empDocs.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">Belum ada dokumen</p>
                      <p className="text-[11px] mt-0.5">KTP, Ijazah, Kontrak, BPJS, dll</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {empDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-3 p-2.5 bg-muted/30 border border-border rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{doc.name}</p>
                            <p className="text-[11px] text-muted-foreground">{doc.type.replace('_', ' ')} · {doc.fileType?.toUpperCase()} {doc.fileSizeKb ? `· ${doc.fileSizeKb} KB` : ''}</p>
                          </div>
                          <button type="button" onClick={() => setEmpDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setModalOpen(false)} className="rounded-xl text-xs">Batal</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold">
              {editingUser ? 'Simpan Perubahan' : 'Daftarkan Karyawan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Document Sub-Modal */}
      <Dialog open={empDocModalOpen} onOpenChange={setEmpDocModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm"><FileText className="w-4 h-4 text-primary" /> Tambah Dokumen Karyawan</DialogTitle>
            <DialogDescription className="text-xs">Upload berkas karyawan (PDF, JPG, PNG, DOCX) — maks 5 MB.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 my-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nama Dokumen <span className="text-destructive">*</span></Label>
              <Input value={empDocName} onChange={(e) => setEmpDocName(e.target.value)} placeholder="KTP atas nama Budi Pratama" className="text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Jenis Dokumen</Label>
              <Select value={empDocType} onValueChange={(v) => setEmpDocType(v as EmployeeDocumentType)}>
                <SelectTrigger className="text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {([
                    ['ktp', 'KTP'], ['kk', 'Kartu Keluarga'], ['npwp', 'NPWP Pribadi'],
                    ['ijazah', 'Ijazah Terakhir'], ['transkrip', 'Transkrip Nilai'],
                    ['cv', 'CV / Resume'], ['sertifikat', 'Sertifikat'],
                    ['kontrak_kerja', 'Kontrak Kerja'],
                    ['bpjs_kesehatan', 'BPJS Kesehatan'], ['bpjs_ketenagakerjaan', 'BPJS Ketenagakerjaan'],
                    ['surat_referensi', 'Surat Referensi'], ['lainnya', 'Lainnya'],
                  ] as [EmployeeDocumentType, string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Catatan</Label>
              <Input value={empDocNotes} onChange={(e) => setEmpDocNotes(e.target.value)} placeholder="Keterangan tambahan..." className="text-xs rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">File <span className="text-destructive">*</span></Label>
              <input type="file" ref={empDocFileRef} onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { alert('Maks 5 MB'); return; }
                const reader = new FileReader();
                reader.onload = () => {
                  setEmpDocFileUrl(reader.result as string);
                  setEmpDocFileType(file.name.split('.').pop()?.toLowerCase() || '');
                  setEmpDocFileSizeKb(Math.round(file.size / 1024));
                };
                reader.readAsDataURL(file);
              }} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" />
              {empDocFileUrl ? (
                <div className="flex items-center gap-2 p-2.5 bg-muted/40 border border-border rounded-xl">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{empDocName || 'File terpilih'}</p>
                    <p className="text-[11px] text-muted-foreground">{empDocFileType.toUpperCase()} · {empDocFileSizeKb} KB</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setEmpDocFileUrl(null); if (empDocFileRef.current) empDocFileRef.current.value = ''; }} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive rounded">
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button type="button" onClick={() => empDocFileRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Klik untuk pilih file</span>
                  <span className="text-[11px]">PDF, JPG, PNG, DOCX — maks 5 MB</span>
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmpDocModalOpen(false)} className="text-xs rounded-xl">Batal</Button>
            <Button onClick={() => {
              if (!empDocName.trim()) { alert('Nama dokumen wajib diisi'); return; }
              if (!empDocFileUrl) { alert('Pilih file terlebih dahulu'); return; }
              const newDoc: EmployeeDocument = {
                id: `edoc-${Date.now()}`,
                userId: editingUser?.id || 'new',
                name: empDocName.trim(),
                type: empDocType,
                fileUrl: empDocFileUrl,
                fileType: empDocFileType,
                fileSizeKb: empDocFileSizeKb,
                notes: empDocNotes || undefined,
                uploadedAt: new Date().toISOString(),
              };
              setEmpDocs((prev) => [newDoc, ...prev]);
              setEmpDocModalOpen(false);
            }} className="bg-primary text-primary-foreground text-xs rounded-xl gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Tambahkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Modal */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Import Data Karyawan Massal
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Tambahkan banyak data karyawan sekaligus via file Excel (.xlsx), CSV, atau salin-tempel dari spreadsheet.
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-xs rounded-xl border-primary/30 text-primary hover:bg-primary/10 gap-1.5 h-8 w-fit shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Template Excel
              </Button>
            </div>
          </DialogHeader>

          {bulkSuccessMsg && (
            <Alert className="bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-xs font-medium">{bulkSuccessMsg}</AlertDescription>
            </Alert>
          )}

          {bulkErrors.length > 0 && (
            <Alert variant="destructive" className="text-xs">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <p className="font-semibold mb-1">Ditemukan kendala pada data:</p>
                <ul className="list-disc pl-4 space-y-0.5 max-h-24 overflow-y-auto text-[11px]">
                  {bulkErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Tab Selector Input Method */}
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <button
              type="button"
              onClick={() => setBulkInputMethod('file')}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                bulkInputMethod === 'file'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              Unggah File (Excel / CSV)
            </button>
            <button
              type="button"
              onClick={() => setBulkInputMethod('text')}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                bulkInputMethod === 'text'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Salin-Tempel (Copy-Paste) Teks
            </button>
          </div>

          {/* File Method */}
          {bulkInputMethod === 'file' && (
            <div className="space-y-3">
              <div
                onClick={() => bulkFileInputRef.current?.click()}
                className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-colors rounded-xl p-6 text-center cursor-pointer"
              >
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleBulkFileUpload}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                  <FileUp className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  Klik untuk memilih file Excel atau CSV
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Format yang didukung: .xlsx, .xls, .csv. Pastikan menggunakan format kolom sesuai template.
                </p>
              </div>
            </div>
          )}

          {/* Text Method */}
          {bulkInputMethod === 'text' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Tempel data dari Google Sheets / Excel di sini:</Label>
                <span className="text-[11px] text-muted-foreground">Format: NIP | Nama | Email | Password | Divisi | Role | Shift | Kuota | Telp</span>
              </div>
              <Textarea
                placeholder="EMP010	Budi Pratama	budi@perusahaan.co.id	password123	IT	karyawan	Reguler	12	081234567890"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={5}
                className="text-xs font-mono rounded-xl resize-none"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleBulkTextParse}
                className="text-xs rounded-xl h-8"
              >
                Proses & Validasi Teks
              </Button>
            </div>
          )}

          {/* Preview Table */}
          {bulkParsedRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  Pratinjau Data ({bulkParsedRows.filter((r) => r._isValid).length} valid dari {bulkParsedRows.length} baris)
                </p>
                <span className="text-[11px] text-muted-foreground">
                  Hanya baris bertanda hijau (valid) yang akan dimasukkan ke sistem.
                </span>
              </div>

              <div className="rounded-xl border border-border overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-16">Status</th>
                      <th className="px-3 py-2">NIP</th>
                      <th className="px-3 py-2">Nama Lengkap</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Divisi</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bulkParsedRows.map((row, idx) => (
                      <tr key={idx} className={row._isValid ? 'hover:bg-muted/20' : 'bg-red-50/40 dark:bg-red-950/20'}>
                        <td className="px-3 py-2">
                          {row._isValid ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-0 text-[10px] px-1.5 py-0.5">
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                              Error
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono font-medium">{row.nip || '-'}</td>
                        <td className="px-3 py-2 font-medium">{row.fullName || '-'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.email || '-'}</td>
                        <td className="px-3 py-2">{row.divisionName || '-'}</td>
                        <td className="px-3 py-2 capitalize">{row.roleName || '-'}</td>
                        <td className="px-3 py-2 text-[11px]">
                          {row._isValid ? (
                            <span className="text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Siap
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">
                              {row._errors.join(', ')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => {
                setBulkModalOpen(false);
                setBulkParsedRows([]);
                setBulkErrors([]);
              }}
              className="rounded-xl text-xs"
            >
              Batal
            </Button>
            <Button
              onClick={handleExecuteBulkImport}
              disabled={bulkParsedRows.filter((r) => r._isValid).length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-semibold gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Impor {bulkParsedRows.filter((r) => r._isValid).length} Karyawan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG MUTASI / PEMINDAHAN LOKASI KERJA KARYAWAN ─── */}
      <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
        <DialogContent className="max-w-md rounded-2xl border border-border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Mutasi / Pemindahan Lokasi Kerja
              </DialogTitle>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                Otoritas Admin
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Pindahkan penugasan lokasi kerja karyawan ke divisi lain dengan pembaruan geofence &amp; barcode otomatis.
            </DialogDescription>
          </DialogHeader>

          {reassignUser && (
            <div className="space-y-4 py-2 text-xs">
              {/* Employee Summary Card */}
              <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>{reassignUser.fullName}</span>
                  <span className="font-mono text-muted-foreground">{reassignUser.nip}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Divisi Saat Ini:</span>
                  <strong className="text-foreground">{reassignUser.divisionName || 'Umum'}</strong>
                </div>
                {reassignUser.originalDivisionId && (
                  <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                    <span>Divisi Asal (Sebelum Mutasi):</span>
                    <strong className="text-foreground">{reassignUser.originalDivisionName}</strong>
                  </div>
                )}
              </div>

              {/* Select Target Division */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Pilih Divisi / Lokasi Kerja Baru <span className="text-rose-500">*</span>
                </Label>
                <Select value={targetDivisionId} onValueChange={setTargetDivisionId}>
                  <SelectTrigger className="text-xs rounded-xl h-9">
                    <SelectValue placeholder="Pilih Divisi Tujuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {divisions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.code}) — {d.locationName || 'Lokasi Kantor'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetDivisionId && (() => {
                  const target = divisions.find((d) => d.id === targetDivisionId);
                  if (!target) return null;
                  return (
                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-950 dark:text-blue-200 mt-1">
                      📍 <strong>Titik Baru:</strong> {target.locationName || target.address} (Radius: {target.radiusMeters || 150}m)
                    </div>
                  );
                })()}
              </div>

              {/* Assignment Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Catatan Penugasan / Alasan Pemindahan
                </Label>
                <Textarea
                  placeholder="Contoh: Bantuan operasional sementara untuk proyek peluncuran di Graha Sudirman selama 1 bulan..."
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  className="text-xs rounded-xl min-h-[75px]"
                />
              </div>

              {/* Notification Notice */}
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-950 dark:text-emerald-200 flex items-start gap-2">
                <Send className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Sistem akan <strong>secara otomatis mengirim notifikasi</strong> ke portal karyawan {reassignUser.fullName} dan menyimpan log pemindahan ke riwayat admin.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setReassignModalOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmReassign}
              disabled={reassignSubmitting || !targetDivisionId || (reassignUser?.divisionId === targetDivisionId)}
              className="rounded-xl text-xs font-semibold h-9 gap-1.5"
            >
              {reassignSubmitting ? 'Memproses...' : 'Konfirmasi & Kirim Notifikasi'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MASTER FACE ENROLLMENT MODAL (ADMIN INITIATED) ─── */}
      <HrmFaceEnrollmentModal
        open={enrollModalOpen}
        user={enrollUser}
        onClose={() => {
          setEnrollModalOpen(false);
          setEnrollUser(null);
        }}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* ─── AI VISION KTP OCR REVIEW MODAL ─── */}
      <Dialog open={ocrModalOpen} onOpenChange={setOcrModalOpen}>
        <DialogContent className="max-w-2xl rounded-2xl p-6 border border-border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FileText className="w-5 h-5 text-primary" /> Hasil Pembacaan Dokumen e-KTP
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verifikasi kelengkapan data NIK dan identitas kependudukan sebelum diterapkan ke formulir karyawan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {ocrPreviewUrl && (
              <div className="relative rounded-xl overflow-hidden border border-border bg-black/5 max-h-48 flex items-center justify-center">
                <img
                  src={ocrPreviewUrl}
                  alt="KTP Preprocessed"
                  className="max-h-48 object-contain w-full"
                />
                <Badge className="absolute bottom-2 right-2 bg-black/70 text-[10px] text-white">
                  Contrast Enhanced
                </Badge>
              </div>
            )}

            {/* Manual text / OCR input box for fast paste or refinement */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground flex justify-between">
                <span>Teks Hasil Scan / Tempel Teks KTP</span>
                <span className="text-[10px] text-primary">Deteksi Otomatis Format Dukcapil</span>
              </Label>
              <Textarea
                rows={2}
                placeholder="Tempel teks KTP jika tersedia, atau perbaiki field di bawah ini secara langsung..."
                className="text-xs rounded-xl font-mono min-h-[50px]"
                value={ocrInputText}
                onChange={(e) => {
                  setOcrInputText(e.target.value);
                  const parsed = extractKtpFieldsFromText(e.target.value);
                  setOcrParsed(parsed);
                }}
              />
            </div>

            {/* Parsed Fields Review */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-muted/20 text-xs">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">NIK (16 Digit)</Label>
                <Input
                  className="rounded-xl text-xs h-8 font-mono font-bold text-primary"
                  value={ocrParsed?.nik || ''}
                  placeholder="3171xxxxxxxxxxxx"
                  onChange={(e) => {
                    const val = e.target.value;
                    const res = parseAndValidateNik(val);
                    setOcrParsed((prev) => ({
                      ...(prev || {
                        nik: '',
                        fullName: '',
                        birthPlace: '',
                        birthDate: '',
                        gender: '',
                        address: '',
                        rtRw: '',
                        kelDesa: '',
                        kecamatan: '',
                        religion: '',
                        maritalStatus: '',
                        occupation: '',
                        confidence: 80,
                        validationNotes: []
                      }),
                      nik: val,
                      birthDate: res.birthDate || prev?.birthDate || '',
                      gender: res.gender || prev?.gender || ''
                    }));
                  }}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Nama Lengkap</Label>
                <Input
                  className="rounded-xl text-xs h-8 font-bold"
                  value={ocrParsed?.fullName || ''}
                  placeholder="Nama Lengkap"
                  onChange={(e) => setOcrParsed((p) => (p ? { ...p, fullName: e.target.value } : null))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Tanggal Lahir</Label>
                <Input
                  type="date"
                  className="rounded-xl text-xs h-8 font-mono"
                  value={ocrParsed?.birthDate || ''}
                  onChange={(e) => setOcrParsed((p) => (p ? { ...p, birthDate: e.target.value } : null))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-muted-foreground">Jenis Kelamin</Label>
                <Select
                  value={ocrParsed?.gender || ''}
                  onValueChange={(v: any) => setOcrParsed((p) => (p ? { ...p, gender: v } : null))}
                >
                  <SelectTrigger className="rounded-xl text-xs h-8">
                    <SelectValue placeholder="Pilih..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LAKI-LAKI">LAKI-LAKI</SelectItem>
                    <SelectItem value="PEREMPUAN">PEREMPUAN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <Label className="text-[11px] font-semibold text-muted-foreground">Alamat</Label>
                <Input
                  className="rounded-xl text-xs h-8"
                  value={ocrParsed?.address || ''}
                  placeholder="Jl. / RT / RW / Kelurahan"
                  onChange={(e) => setOcrParsed((p) => (p ? { ...p, address: e.target.value } : null))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => setOcrModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold gap-1.5"
              onClick={handleApplyOcrData}
              disabled={!ocrParsed?.nik && !ocrParsed?.fullName}
            >
              <CheckCircle2 size={14} /> Terapkan ke Form Pendaftaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog for Superadmin */}
      <Dialog open={!!resetPasswordUser} onOpenChange={(open) => !open && setResetPasswordUser(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <KeyRound className="w-5 h-5 text-amber-600" />
              Reset Kata Sandi Karyawan
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atur ulang kata sandi login untuk {resetPasswordUser?.fullName} ({resetPasswordUser?.nip}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-1">
              <span className="text-muted-foreground">Karyawan:</span>
              <p className="font-semibold text-foreground">{resetPasswordUser?.fullName}</p>
              <p className="text-muted-foreground font-mono">{resetPasswordUser?.email} • NIP: {resetPasswordUser?.nip}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kata Sandi Baru</Label>
              <Input
                type="text"
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
                placeholder="Masukkan kata sandi baru..."
                className="text-xs rounded-xl font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Default: <code className="bg-muted px-1 rounded">password123</code>. Karyawan dapat langsung masuk menggunakan sandi baru ini.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => setResetPasswordUser(null)}
              disabled={isResettingPassword}
            >
              Batal
            </Button>
            <Button
              size="sm"
              className="rounded-xl text-xs font-semibold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmResetPassword}
              disabled={isResettingPassword || !newResetPassword}
            >
              <KeyRound size={14} />
              {isResettingPassword ? 'Mereset...' : 'Simpan Sandi Baru'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

