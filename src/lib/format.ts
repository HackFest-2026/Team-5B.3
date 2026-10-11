const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const inrDecimalFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number | null | undefined, allowDecimals: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  if (allowDecimals && !Number.isInteger(amount)) {
    return inrDecimalFormatter.format(amount);
  }
  return inrFormatter.format(amount);
}

export function formatDateIST(isoOrDate: string | undefined): string {
  if (!isoOrDate) return '—';
  try {
    const d = new Date(isoOrDate);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return isoOrDate;
  }
}

export function formatDateTimeIST(isoOrDate: string | undefined): string {
  if (!isoOrDate) return '—';
  try {
    const d = new Date(isoOrDate);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoOrDate;
  }
}
