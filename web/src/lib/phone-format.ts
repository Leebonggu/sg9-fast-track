export function isValidPhone(v: string): boolean {
  const digits = v.replace(/[^0-9]/g, '');
  return digits.length >= 9 && digits.length <= 11;
}
