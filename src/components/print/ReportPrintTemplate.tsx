import React, { forwardRef } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import logoSekolah from '@/assets/logo.png?inline';
import './print-styles.css';
export interface StudentData {
  nama: string;
  nisn?: string;
  nis?: string;
  kelas: string;
}
export interface SignerData {
  name: string;
  jabatan: string;
  nip?: string;
}
export interface ReportPrintTemplateProps {
  title: string;
  tahunAjaran?: string;
  semester?: 'ganjil' | 'genap';
  studentData?: StudentData;
  signer?: SignerData;
  printDate?: Date;
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
}
const ReportPrintTemplate = forwardRef<HTMLDivElement, ReportPrintTemplateProps>(({
  title,
  tahunAjaran,
  semester,
  studentData,
  signer,
  printDate = new Date(),
  children,
  showHeader = true,
  showFooter = true,
  className = ''
}, ref) => {
  const formattedDate = format(printDate, "d MMMM yyyy", {
    locale: id
  });
  return <div ref={ref} className={`print-container bg-white text-foreground mx-auto ${className}`} style={{ width: '210mm', minHeight: '297mm', padding: '15mm', boxSizing: 'border-box' }}>
        {/* Header - KOP SURAT */}
        {showHeader && <div className="print-header-line">
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="flex-shrink-0">
                <img src={logoSekolah} alt="Logo Sekolah" loading="eager" className="w-20 h-20 object-contain" />
              </div>

              {/* School Info */}
              <div className="flex-1 text-center">
                
                <h1 className="text-xl font-bold text-foreground uppercase tracking-wide">
                  SMPIT Digital Islamic Boarding School
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Jln. Bintang Mujur, Pangkajene Kepulauan, Sulawesi Selatan
                </p>
                <p className="text-sm text-muted-foreground">
                  Website: digiss.co.id | Email: digissemail@gmail.com

                </p>
              </div>

              {/* Spacer for symmetry */}
              <div className="w-20 flex-shrink-0" />
            </div>
          </div>}

        {/* Sub-Header - Document Title & Info */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-center uppercase tracking-wide mb-4">
            {title}
          </h2>

          {/* Academic Year & Semester Info */}
          {(tahunAjaran || semester) && <div className="flex justify-center gap-4 mb-4">
              {tahunAjaran && <div className="px-3 py-1 bg-muted rounded-md text-sm">
                  <span className="text-muted-foreground">Tahun Ajaran: </span>
                  <span className="font-semibold">{tahunAjaran}</span>
                </div>}
              {semester && <div className="px-3 py-1 bg-muted rounded-md text-sm">
                  <span className="text-muted-foreground">Semester: </span>
                  <span className="font-semibold capitalize">{semester}</span>
                </div>}
            </div>}

          {/* Student Data Table */}
          {studentData && <div className="mb-4">
              <table className="text-sm">
                <tbody>
                  <tr>
                    <td className="pr-4 py-1 text-muted-foreground">Nama</td>
                    <td className="pr-2">:</td>
                    <td className="font-semibold">{studentData.nama}</td>
                  </tr>
                  {studentData.nisn && <tr>
                      <td className="pr-4 py-1 text-muted-foreground">NISN</td>
                      <td className="pr-2">:</td>
                      <td className="font-semibold">{studentData.nisn}</td>
                    </tr>}
                  {studentData.nis && <tr>
                      <td className="pr-4 py-1 text-muted-foreground">NIS</td>
                      <td className="pr-2">:</td>
                      <td className="font-semibold">{studentData.nis}</td>
                    </tr>}
                  <tr>
                    <td className="pr-4 py-1 text-muted-foreground">Kelas</td>
                    <td className="pr-2">:</td>
                    <td className="font-semibold">{studentData.kelas}</td>
                  </tr>
                </tbody>
              </table>
            </div>}
        </div>

        {/* Body Content */}
        <div className="min-h-[500px]">{children}</div>

        {/* Footer - Signature Area */}
        {showFooter && signer && <div className="print-signature-area mt-8">
            <div className="print-signature-box">
              <p className="text-sm text-muted-foreground mb-1">
                Pangkajene, {formattedDate}
              </p>
              <p className="text-sm font-medium">{signer.jabatan}</p>
              <div className="print-signature-line" />
              <p className="font-semibold">{signer.name}</p>
              {signer.nip && <p className="text-sm text-muted-foreground">NIP. {signer.nip}</p>}
            </div>
          </div>}
      </div>;
});
ReportPrintTemplate.displayName = 'ReportPrintTemplate';
export default ReportPrintTemplate;