import BankBCA from '@/assets/banks/Bank_BCA.png';
import BankBRI from '@/assets/banks/Bank_BRI.png';
import BankBSI from '@/assets/banks/Bank_BSI.png';
import BankPermata from '@/assets/banks/Bank_Permata.png';
import BankMandiri from '@/assets/banks/Bank_Mandiri.png';
import BankBNI from '@/assets/banks/Bank_BNI.png';

export const BANK_LIST = [
  { value: 'Bank Syariah Indonesia (BSI)', label: 'Bank Syariah Indonesia (BSI)', icon: BankBSI },
  { value: 'Bank Mandiri', label: 'Bank Mandiri', icon: BankMandiri },
  { value: 'Bank Central Asia (BCA)', label: 'Bank Central Asia (BCA)', icon: BankBCA },
  { value: 'Bank Permata', label: 'Bank Permata', icon: BankPermata },
  { value: 'Bank Negara Indonesia (BNI)', label: 'Bank Negara Indonesia (BNI)', icon: BankBNI },
  { value: 'Bank Rakyat Indonesia (BRI)', label: 'Bank Rakyat Indonesia (BRI)', icon: BankBRI },
] as const;

export function getBankIcon(namaBank: string): string | undefined {
  return BANK_LIST.find((b) => b.value === namaBank)?.icon;
}
