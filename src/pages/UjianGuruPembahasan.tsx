// UjianGuruPembahasan - Wrapper for AdminUjianPembahasan with guru-specific base path
import AdminUjianPembahasan from './AdminUjianPembahasan';

export default function UjianGuruPembahasan() {
  return <AdminUjianPembahasan basePath="/app/ujian-guru" />;
}
