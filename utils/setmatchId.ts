/**
 * Gera ID amigável único no formato SM-A3K9P2 (fácil de digitar / admin adicionar aluno).
 */
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I/O/0/1

export function gerarCodigoSetmatch(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALFA[Math.floor(Math.random() * ALFA.length)];
  }
  return `SM-${code}`;
}

export function normalizarSetmatchId(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (t.startsWith('SM-')) return t;
  if (t.startsWith('SM')) return `SM-${t.slice(2)}`;
  return `SM-${t}`;
}

export function isSetmatchIdValido(id: string): boolean {
  return /^SM-[A-Z0-9]{6}$/.test(normalizarSetmatchId(id));
}
