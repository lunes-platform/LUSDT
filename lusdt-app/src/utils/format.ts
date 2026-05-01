export function formatAddress(addr: string, head: number = 8, tail: number = 6): string {
  if (!addr) return '';
  if (addr.length <= head + tail) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

export function formatNumber(value: number, decimals: number = 4): string {
  if (Number.isNaN(value)) return '0';
  return value.toFixed(decimals);
}
