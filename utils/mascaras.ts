/** Máscaras de digitação BR (só dígitos → formatação). */

/** DD/MM/AAAA — digita só números. */
export function maskDateBR(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** HH:MM — digita só números. */
export function maskTimeHHMM(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function isDateBRCompleta(v: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return false;
  const [dd, mm, yyyy] = v.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}
