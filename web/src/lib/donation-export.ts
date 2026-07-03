import * as XLSX from 'xlsx';
import type { DonationRecord } from './donation';

// 후원자 공유용 심플 포맷 (내부 관리 필드인 등록자/비고/상태는 제외)
export function downloadDonationsAsXlsx(donations: DonationRecord[], filename: string) {
  if (donations.length === 0) {
    alert('다운로드할 내역이 없습니다.');
    return;
  }
  const headers = ['납부일', '동', '호수', '금액'];
  const dataRows = donations.map((d) => [d.paidDate, d.dong, d.ho, d.amount]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '후원금');
  XLSX.writeFile(wb, filename);
}
