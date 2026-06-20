export function normalizeIndianMobile(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function isValidIndianMobile(input: string): boolean {
  const mobile = normalizeIndianMobile(input);
  return /^[6-9]\d{9}$/.test(mobile);
}

export function normalizeIndianPincode(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

export function isValidIndianPincode(input: string): boolean {
  const pin = normalizeIndianPincode(input);
  return /^\d{6}$/.test(pin);
}
