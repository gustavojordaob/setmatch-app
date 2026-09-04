import type { AppLocale } from '../i18n/types';

/** YYYY-MM-DD local (não UTC). */
export function toDiaISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toDiaISO(new Date());
}

export function parseDiaISO(diaISO: string): Date {
  const [y, m, d] = diaISO.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDiasISO(diaISO: string, delta: number): string {
  const d = parseDiaISO(diaISO);
  d.setDate(d.getDate() + delta);
  return toDiaISO(d);
}

/** Locale BCP-47 do app → formatação de datas. */
export function localeTag(locale: AppLocale): string {
  if (locale === 'en-US') return 'en-US';
  if (locale === 'es') return 'es-ES';
  return 'pt-BR';
}

/** Ex.: pt-BR → 03/09/2026 · en-US → 09/03/2026 */
export function formatDiaCurto(diaISO: string, locale: AppLocale): string {
  return parseDiaISO(diaISO).toLocaleDateString(localeTag(locale), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Ex.: quarta-feira, 3 de setembro */
export function formatDiaLongo(diaISO: string, locale: AppLocale): string {
  return parseDiaISO(diaISO).toLocaleDateString(localeTag(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Cabeçalho da seção semanal. */
export function formatDiaSecao(diaISO: string, locale: AppLocale): string {
  return parseDiaISO(diaISO).toLocaleDateString(localeTag(locale), {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/** Placeholder do campo de data conforme locale. */
export function placeholderData(locale: AppLocale): string {
  if (locale === 'en-US') return 'MM/DD/YYYY';
  if (locale === 'es') return 'DD/MM/AAAA';
  return 'DD/MM/AAAA';
}

/**
 * Aceita digitação no padrão do locale e devolve YYYY-MM-DD, ou null se inválido.
 * Também aceita YYYY-MM-DD.
 */
export function parseDataDigitada(raw: string, locale: AppLocale): string | null {
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = parseDiaISO(t);
    return Number.isNaN(d.getTime()) ? null : t;
  }
  const digits = t.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  let y: number;
  let m: number;
  let d: number;
  if (locale === 'en-US') {
    m = Number(digits.slice(0, 2));
    d = Number(digits.slice(2, 4));
    y = Number(digits.slice(4, 8));
  } else {
    d = Number(digits.slice(0, 2));
    m = Number(digits.slice(2, 4));
    y = Number(digits.slice(4, 8));
  }
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return toDiaISO(dt);
}

/** Máximo liberado para reserva: hoje + N meses (calendário). */
export function dataLimiteMeses(meses: number, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(23, 59, 59, 999);
  d.setMonth(d.getMonth() + Math.max(1, meses));
  return d;
}

export function diaDentroDaJanela(
  diaISO: string,
  mesesAntecipacao: number
): boolean {
  const dia = parseDiaISO(diaISO);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  if (dia < hoje) return false;
  return dia <= dataLimiteMeses(mesesAntecipacao);
}

/** Lista YYYY-MM-DD a partir de start, n dias. */
export function listaDiasISO(startISO: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(addDiasISO(startISO, i));
  return out;
}

/** Primeiro dia do mês (YYYY-MM-DD) contendo a data. */
export function inicioMesISO(diaISO: string): string {
  const d = parseDiaISO(diaISO);
  return toDiaISO(new Date(d.getFullYear(), d.getMonth(), 1, 12));
}

export function fimMesISO(diaISO: string): string {
  const d = parseDiaISO(diaISO);
  return toDiaISO(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
}

export function addMesesISO(diaISO: string, deltaMeses: number): string {
  const d = parseDiaISO(diaISO);
  return toDiaISO(new Date(d.getFullYear(), d.getMonth() + deltaMeses, 1, 12));
}

/** Nome do mês + ano no locale. */
export function formatMesAno(diaISO: string, locale: AppLocale): string {
  return parseDiaISO(diaISO).toLocaleDateString(localeTag(locale), {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Semanas do mês (segunda → domingo), só dias do mês.
 * Cada semana: lista de YYYY-MM-DD.
 */
export function semanasDoMes(mesRefISO: string): string[][] {
  const ini = parseDiaISO(inicioMesISO(mesRefISO));
  const fim = parseDiaISO(fimMesISO(mesRefISO));
  const semanas: string[][] = [];
  let atual: string[] = [];

  // Começa na segunda-feira da semana do dia 1
  const cursor = new Date(ini);
  const dow = cursor.getDay(); // 0=dom
  const back = dow === 0 ? 6 : dow - 1;
  cursor.setDate(cursor.getDate() - back);

  while (cursor <= fim || atual.length > 0) {
    const iso = toDiaISO(cursor);
    const noMes = cursor.getMonth() === ini.getMonth();
    if (noMes) atual.push(iso);
    cursor.setDate(cursor.getDate() + 1);
    // Fecha semana no domingo (após processar domingo)
    if (cursor.getDay() === 1) {
      if (atual.length) semanas.push(atual);
      atual = [];
      if (cursor > fim) break;
    }
  }
  if (atual.length) semanas.push(atual);
  return semanas;
}

/** Rótulo curto da semana: 01–07 set. */
export function formatFaixaSemana(
  diasISO: string[],
  locale: AppLocale
): string {
  if (!diasISO.length) return '';
  const a = parseDiaISO(diasISO[0]);
  const b = parseDiaISO(diasISO[diasISO.length - 1]);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${a.toLocaleDateString(localeTag(locale), opts)} – ${b.toLocaleDateString(localeTag(locale), opts)}`;
}

