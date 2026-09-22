/** Agenda de confrontos de torneio (texto amigável DD/MM HH:MM). */

const INTERVALO_JOGO_MIN_DEFAULT = 60;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatAgendaTorneio(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

function parseDateBR(s: string): { y: number; m: number; d: number } | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { y, m: mo, d };
}

function parseTimeHHMM(s: string): { h: number; min: number } | null {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

/**
 * Combina `dataInicio` (DD/MM/AAAA) + `horarioPadrao` (HH:MM ou "DD/MM HH:MM").
 * Se só houver horário, usa a data de hoje.
 */
export function parseBaseAgendaTorneio(
  dataInicio?: string,
  horarioPadrao?: string
): Date | null {
  const di = (dataInicio || '').trim();
  const hp = (horarioPadrao || '').trim();
  if (!di && !hp) return null;

  const full = hp.match(/^(\d{2})\/(\d{2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})$/);
  if (full) {
    const fromDi = parseDateBR(di);
    const year = full[3]
      ? Number(full[3])
      : fromDi?.y ?? new Date().getFullYear();
    const h = Number(full[4]);
    const min = Number(full[5]);
    if (h > 23 || min > 59) return null;
    return new Date(year, Number(full[2]) - 1, Number(full[1]), h, min);
  }

  const datePart = parseDateBR(di);
  const timePart = parseTimeHHMM(hp) ?? { h: 9, min: 0 };
  if (datePart) {
    return new Date(datePart.y, datePart.m - 1, datePart.d, timePart.h, timePart.min);
  }

  const now = new Date();
  if (parseTimeHHMM(hp)) {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      timePart.h,
      timePart.min
    );
  }
  return null;
}

/** Troca só a data (DD/MM[/AAAA]) de um rótulo "DD/MM HH:MM", mantendo o horário. */
export function trocarDataNoRotuloAgenda(
  rotuloAtual: string,
  novaDataBR: string,
  fallbackHora = '09:00'
): string {
  const data = parseDateBR(novaDataBR.trim());
  if (!data) throw new Error('Data inválida. Use DD/MM/AAAA.');
  const atual = (rotuloAtual || '').trim();
  const timeMatch = atual.match(/(\d{1,2}):(\d{2})\s*$/);
  const hora = timeMatch
    ? `${pad2(Number(timeMatch[1]))}:${pad2(Number(timeMatch[2]))}`
    : fallbackHora;
  const [hh, mm] = hora.split(':').map(Number);
  return formatAgendaTorneio(new Date(data.y, data.m - 1, data.d, hh, mm));
}

export type SlotAgendaChave = {
  id: string;
  round: number;
  pos: number;
  status: string;
};

export type AgendaSlotResult = {
  hora: string;
  quadra?: string;
};

/** Lista de quadras a partir de texto (uma por linha ou separadas por vírgula). */
export function parseListaQuadras(raw: string | string[] | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.map((q) => String(q).trim()).filter(Boolean);
  }
  const t = (raw || '').trim();
  if (!t) return [];
  return t
    .split(/[\n,;]+/)
    .map((q) => q.trim())
    .filter(Boolean);
}

export const INTERVALOS_JOGO_OPCOES = [
  { min: 45, label: '45 min' },
  { min: 60, label: '1 hora' },
  { min: 90, label: '1h30' },
  { min: 120, label: '2 horas' },
  { min: 150, label: '2h30' },
  { min: 180, label: '3 horas' },
] as const;

/**
 * Distribui horários (+ quadras opcionais) a partir da base do torneio.
 * Espaçamento entre jogos = `intervaloJogoMin` (definido pelo organizador).
 * Entre rodadas = 2× o intervalo (ou `intervaloRodadaMin` se passado).
 */
export function calcularAgendaChaveamento(opts: {
  dataInicio?: string;
  horarioPadrao?: string;
  slots: SlotAgendaChave[];
  offsetCategoriaMin?: number;
  intervaloJogoMin?: number;
  intervaloRodadaMin?: number;
  /** Se true e houver lista, sorteia/distribui quadras nos jogos. */
  atribuirQuadras?: boolean;
  quadras?: string[];
  /** Fallback se atribuir e lista vazia — mesma quadra em todos. */
  quadraUnica?: string;
}): Map<string, AgendaSlotResult> {
  const base = parseBaseAgendaTorneio(opts.dataInicio, opts.horarioPadrao);
  const out = new Map<string, AgendaSlotResult>();
  if (!base) return out;

  const gapJogo = Math.max(
    15,
    Number(opts.intervaloJogoMin) || INTERVALO_JOGO_MIN_DEFAULT
  );
  const gapRodada = Math.max(
    gapJogo,
    Number(opts.intervaloRodadaMin) || gapJogo * 2
  );
  const catOff = opts.offsetCategoriaMin ?? 0;

  const jogaveis = opts.slots
    .filter((s) => s.status !== 'bye')
    .sort((a, b) => a.round - b.round || a.pos - b.pos);

  const posNaRodada = new Map<number, number>();
  const porHora = new Map<string, string[]>();

  for (const s of jogaveis) {
    const idx = posNaRodada.get(s.round) ?? 0;
    posNaRodada.set(s.round, idx + 1);
    const mins = catOff + (s.round - 1) * gapRodada + idx * gapJogo;
    const when = new Date(base.getTime() + mins * 60_000);
    const hora = formatAgendaTorneio(when);
    out.set(s.id, { hora });
    const list = porHora.get(hora) ?? [];
    list.push(s.id);
    porHora.set(hora, list);
  }

  if (opts.atribuirQuadras) {
    const pool = parseListaQuadras(opts.quadras);
    const unica = (opts.quadraUnica || '').trim();
    const courts = pool.length > 0 ? pool : unica ? [unica] : [];
    if (courts.length > 0) {
      for (const [, ids] of porHora) {
        ids.forEach((id, i) => {
          const cur = out.get(id);
          if (!cur) return;
          out.set(id, { ...cur, quadra: courts[i % courts.length] });
        });
      }
    }
  }

  return out;
}

/** @deprecated Prefer `calcularAgendaChaveamento`. */
export function calcularHorariosChaveamento(opts: {
  dataInicio?: string;
  horarioPadrao?: string;
  slots: SlotAgendaChave[];
  offsetCategoriaMin?: number;
  intervaloJogoMin?: number;
  intervaloRodadaMin?: number;
}): Map<string, string> {
  const agenda = calcularAgendaChaveamento(opts);
  const out = new Map<string, string>();
  agenda.forEach((v, k) => out.set(k, v.hora));
  return out;
}

export function offsetCategoriaAgendaMin(
  categoriasJaAgendadas: number,
  intervaloJogoMin?: number
): number {
  const gap = Math.max(15, Number(intervaloJogoMin) || INTERVALO_JOGO_MIN_DEFAULT);
  return Math.max(0, categoriasJaAgendadas) * Math.min(45, gap);
}
