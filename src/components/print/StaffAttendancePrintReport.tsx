import { forwardRef } from 'react';
import ReportPrintTemplate, { type SignerData } from './ReportPrintTemplate';

export interface StaffAttendancePrintRow {
  id: string;
  employeeId?: string | null;
  nama: string;
  hadir: number;
  sakit: number;
  izin: number;
  cuti: number;
  tidakHadir: number;
  persen: number;
}

export interface StaffAttendancePrintReportProps {
  periodeLabel: string;
  workDays: number;
  semester: 'ganjil' | 'genap';
  signer?: SignerData;
  rows: StaffAttendancePrintRow[];
}

const defaultSigner: SignerData = {
  name: 'Kepala Sekolah',
  jabatan: 'Kepala Sekolah',
};

const StaffAttendancePrintReport = forwardRef<HTMLDivElement, StaffAttendancePrintReportProps>(
  ({ periodeLabel, workDays, semester, signer = defaultSigner, rows }, ref) => {
    return (
      <ReportPrintTemplate
        ref={ref}
        title="LAPORAN KEHADIRAN STAFF"
        semester={semester}
        signer={signer}
      >
        <div className="mb-4">
          <table className="text-sm">
            <tbody>
              <tr>
                <td className="pr-4 py-1 text-muted-foreground">Periode</td>
                <td className="pr-2">:</td>
                <td className="font-semibold">{periodeLabel}</td>
              </tr>
              <tr>
                <td className="pr-4 py-1 text-muted-foreground">Hari Kerja</td>
                <td className="pr-2">:</td>
                <td className="font-semibold">{workDays} hari</td>
              </tr>
              <tr>
                <td className="pr-4 py-1 text-muted-foreground">Total Staff</td>
                <td className="pr-2">:</td>
                <td className="font-semibold">{rows.length} orang</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th className="text-center" style={{ width: '30px' }}>
                No
              </th>
              <th>NIP</th>
              <th>Nama</th>
              <th className="text-center">Hadir</th>
              <th className="text-center">Sakit</th>
              <th className="text-center">Izin</th>
              <th className="text-center">Cuti</th>
              <th className="text-center">TH</th>
              <th className="text-center">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td className="text-center">{index + 1}</td>
                <td>{row.employeeId || '-'}</td>
                <td>{row.nama}</td>
                <td className="text-center">{row.hadir}</td>
                <td className="text-center">{row.sakit}</td>
                <td className="text-center">{row.izin}</td>
                <td className="text-center">{row.cuti}</td>
                <td className="text-center">{row.tidakHadir}</td>
                <td className="text-center font-semibold">{row.persen}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportPrintTemplate>
    );
  }
);

StaffAttendancePrintReport.displayName = 'StaffAttendancePrintReport';

export default StaffAttendancePrintReport;