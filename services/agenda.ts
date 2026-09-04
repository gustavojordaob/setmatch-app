import {
  Timestamp,
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import {
  normalizarAgenda,
  horarioEfetivoQuadra,
  type AgendaClubeConfig,
  type GradeSlot,
  type QuadraClube,
  type ReservaQuadra,
  type ReservaStatus,
  type ReservaTipo,
  type SlotLivre,
} from '../types/agenda';
import { criarDesafio } from './desafios';
import type { FormatoPartidaId } from '../constants/formatosPartida';

function parseHora(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map((x) => Number(x) || 0);
  return { h, m };
}

function toDate(v: ReservaQuadra['inicio'] | Timestamp | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof (v as { seconds?: number }).seconds === 'number') {
    return new Date((v as { seconds: number }).seconds * 1000);
  }
  return null;
}

export function intervalosSobrepoem(
  aIni: Date,
  aFim: Date,
  bIni: Date,
  bFim: Date
): boolean {
  return aIni < bFim && aFim > bIni;
}

export async function salvarAgendaClube(
  clubeId: string,
  agenda: AgendaClubeConfig
): Promise<void> {
  await updateDoc(doc(db, 'clubes', clubeId), {
    agenda: {
      ativo: agenda.ativo,
      abertura: agenda.abertura,
      fechamento: agenda.fechamento,
      duracaoSlotMin: agenda.duracaoSlotMin,
      diasSemana: agenda.diasSemana,
      mesesAntecipacao: agenda.mesesAntecipacao,
      antecipacaoDias: agenda.mesesAntecipacao * 30,
      horasExpiracaoPreReserva: agenda.horasExpiracaoPreReserva ?? 48,
    },
  });
}

export async function listarQuadrasClube(clubeId: string): Promise<QuadraClube[]> {
  const snap = await getDocs(collection(db, 'clubes', clubeId, 'quadras'));
  return snap.docs
    .map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        nome: String(raw.nome ?? 'Quadra'),
        esporte: (raw.esporte as EsporteId) ?? 'tenis',
        ativa: raw.ativa !== false,
        ordem: Number(raw.ordem ?? 0),
        abertura: raw.abertura ? String(raw.abertura) : undefined,
        fechamento: raw.fechamento ? String(raw.fechamento) : undefined,
        diasSemana: Array.isArray(raw.diasSemana)
          ? (raw.diasSemana as number[])
          : undefined,
        duracaoSlotMin:
          raw.duracaoSlotMin != null
            ? Number(raw.duracaoSlotMin)
            : undefined,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

export async function criarQuadraClube(input: {
  clubeId: string;
  nome: string;
  esporte: EsporteId;
  ordem?: number;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'clubes', input.clubeId, 'quadras'), {
    nome: input.nome.trim(),
    esporte: input.esporte,
    ativa: true,
    ordem: input.ordem ?? 0,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

/** `null` em abertura/fechamento/dias/duração = herdar padrão do clube (remove override). */
export type QuadraClubeUpdate = Partial<{
  nome: string;
  esporte: EsporteId;
  ativa: boolean;
  ordem: number;
  abertura: string | null;
  fechamento: string | null;
  diasSemana: number[] | null;
  duracaoSlotMin: number | null;
}>;

export async function atualizarQuadraClube(
  clubeId: string,
  quadraId: string,
  data: QuadraClubeUpdate
): Promise<void> {
  const payload: Record<string, unknown> = {};
  (Object.keys(data) as (keyof QuadraClubeUpdate)[]).forEach((key) => {
    const v = data[key];
    if (v === undefined) return;
    if (v === null) {
      payload[key] = deleteField();
      return;
    }
    payload[key] = v;
  });
  if (Object.keys(payload).length === 0) return;
  await updateDoc(doc(db, 'clubes', clubeId, 'quadras', quadraId), payload);
}

function mapReserva(d: { id: string; data: () => Record<string, unknown> }): ReservaQuadra {
  const raw = d.data();
  return {
    id: d.id,
    quadraId: String(raw.quadraId ?? ''),
    quadraNome: String(raw.quadraNome ?? ''),
    inicio: raw.inicio as ReservaQuadra['inicio'],
    fim: raw.fim as ReservaQuadra['fim'],
    tipo: (raw.tipo as ReservaTipo) ?? 'bloqueio_outro',
    status: (raw.status as ReservaStatus) ?? 'pendente',
    criadoPorUid: String(raw.criadoPorUid ?? ''),
    duracaoMin:
      raw.duracaoMin != null ? Number(raw.duracaoMin) : undefined,
    motivo: raw.motivo ? String(raw.motivo) : undefined,
    rankingId: raw.rankingId ? String(raw.rankingId) : undefined,
    rankingNome: raw.rankingNome ? String(raw.rankingNome) : undefined,
    desafioId: raw.desafioId ? String(raw.desafioId) : undefined,
    jogador1Uid: raw.jogador1Uid ? String(raw.jogador1Uid) : undefined,
    jogador2Uid: raw.jogador2Uid ? String(raw.jogador2Uid) : undefined,
    jogador1Nome: raw.jogador1Nome ? String(raw.jogador1Nome) : undefined,
    jogador2Nome: raw.jogador2Nome ? String(raw.jogador2Nome) : undefined,
    jogador1Foto: raw.jogador1Foto ? String(raw.jogador1Foto) : undefined,
    jogador2Foto: raw.jogador2Foto ? String(raw.jogador2Foto) : undefined,
    torneioId: raw.torneioId ? String(raw.torneioId) : undefined,
    expiraEm: raw.expiraEm as ReservaQuadra['expiraEm'],
    criadoEm: raw.criadoEm as { seconds: number } | undefined,
  };
}

/** Reservas ativas (pendente/confirmado) que cruzam o intervalo. */
export async function listarReservasAtivasNoPeriodo(
  clubeId: string,
  inicio: Date,
  fim: Date
): Promise<ReservaQuadra[]> {
  const snap = await getDocs(
    query(
      collection(db, 'clubes', clubeId, 'reservas'),
      where('inicio', '>=', Timestamp.fromDate(new Date(inicio.getTime() - 24 * 3600 * 1000))),
      where('inicio', '<=', Timestamp.fromDate(fim))
    )
  );
  return snap.docs
    .map((d) => mapReserva(d))
    .filter((r) => {
      if (r.status !== 'pendente' && r.status !== 'confirmado') return false;
      // Pré-reserva vencida não bloqueia (CF também expira; fallback no client)
      if (r.status === 'pendente' && r.expiraEm) {
        const exp = toDate(r.expiraEm);
        if (exp && exp.getTime() < Date.now()) return false;
      }
      return true;
    })
    .filter((r) => {
      const ri = toDate(r.inicio);
      const rf = toDate(r.fim);
      if (!ri || !rf) return false;
      return intervalosSobrepoem(inicio, fim, ri, rf);
    });
}

export async function listarReservasClubeDia(
  clubeId: string,
  dia: Date
): Promise<ReservaQuadra[]> {
  const start = new Date(dia);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dia);
  end.setHours(23, 59, 59, 999);
  return listarReservasClubePeriodo(clubeId, start, end);
}

/** Reservas com início no intervalo [inicioDia, fimDia] (inclusive). */
export async function listarReservasClubePeriodo(
  clubeId: string,
  inicioDia: Date,
  fimDia: Date
): Promise<ReservaQuadra[]> {
  const start = new Date(inicioDia);
  start.setHours(0, 0, 0, 0);
  const end = new Date(fimDia);
  end.setHours(23, 59, 59, 999);
  const snap = await getDocs(
    query(
      collection(db, 'clubes', clubeId, 'reservas'),
      where('inicio', '>=', Timestamp.fromDate(start)),
      where('inicio', '<=', Timestamp.fromDate(end))
    )
  );
  return snap.docs
    .map((d) => mapReserva(d))
    .sort((a, b) => {
      const ta = toDate(a.inicio)?.getTime() ?? 0;
      const tb = toDate(b.inicio)?.getTime() ?? 0;
      return ta - tb;
    });
}

export function gerarSlotsLivres(opts: {
  agenda: AgendaClubeConfig;
  quadras: QuadraClube[];
  reservas: ReservaQuadra[];
  dia: Date;
  agora?: Date;
  /** Se informado, só esta quadra */
  quadraId?: string;
}): SlotLivre[] {
  return montarGradeDia(opts)
    .filter((s): s is Extract<GradeSlot, { kind: 'livre' }> => s.kind === 'livre')
    .map((s) => ({
      inicio: s.inicio,
      fim: s.fim,
      quadraId: s.quadraId,
      quadraNome: s.quadraNome,
      duracaoMin: s.duracaoMin,
    }));
}

/**
 * Grade do dia por quadra: livres + ocupados (ranking / amistoso / torneio / aula).
 * Duração padrão: `quadra.duracaoSlotMin` ou `agenda.duracaoSlotMin`.
 * Reservas/bloqueios com duração custom usam o intervalo real (inicio–fim).
 */
export function montarGradeDia(opts: {
  agenda: AgendaClubeConfig;
  quadras: QuadraClube[];
  reservas: ReservaQuadra[];
  dia: Date;
  agora?: Date;
  quadraId?: string;
}): GradeSlot[] {
  const { agenda, reservas, dia } = opts;
  const agora = opts.agora ?? new Date();
  if (!agenda.ativo) return [];

  let ativas = opts.quadras.filter((q) => q.ativa);
  if (opts.quadraId) ativas = ativas.filter((q) => q.id === opts.quadraId);
  if (!ativas.length) return [];

  const ocupadas = reservas.filter(
    (r) => r.status === 'pendente' || r.status === 'confirmado'
  );

  const grade: GradeSlot[] = [];
  const reservasJaListadas = new Set<string>();

  for (const q of ativas) {
    const hor = horarioEfetivoQuadra(agenda, q);
    const dow = dia.getDay();
    if (!hor.diasSemana.includes(dow)) continue;

    const dur = hor.duracaoSlotMin;
    const { h: ah, m: am } = parseHora(hor.abertura);
    const { h: fh, m: fm } = parseHora(hor.fechamento);
    const dayStart = new Date(dia);
    dayStart.setHours(ah, am, 0, 0);
    const dayEnd = new Date(dia);
    dayEnd.setHours(fh, fm, 0, 0);

    let cursor = new Date(dayStart);
    while (cursor.getTime() + dur * 60_000 <= dayEnd.getTime()) {
      const fim = new Date(cursor.getTime() + dur * 60_000);
      if (fim <= agora) {
        cursor = fim;
        continue;
      }

      const hit = ocupadas.find((r) => {
        if (r.quadraId !== q.id) return false;
        const ri = toDate(r.inicio);
        const rf = toDate(r.fim);
        if (!ri || !rf) return false;
        return intervalosSobrepoem(cursor, fim, ri, rf);
      });

      if (hit) {
        const ri = toDate(hit.inicio);
        const rf = toDate(hit.fim);
        if (ri && rf && !reservasJaListadas.has(hit.id)) {
          reservasJaListadas.add(hit.id);
          grade.push({
            kind: 'ocupado',
            inicio: ri,
            fim: rf,
            quadraId: q.id,
            quadraNome: q.nome,
            reserva: hit,
          });
        }
        if (rf && rf > cursor) {
          cursor = rf;
        } else {
          cursor = fim;
        }
        continue;
      }

      grade.push({
        kind: 'livre',
        inicio: new Date(cursor),
        fim,
        quadraId: q.id,
        quadraNome: q.nome,
        duracaoMin: dur,
      });
      cursor = fim;
    }
  }

  return grade.sort((a, b) => {
    const t = a.inicio.getTime() - b.inicio.getTime();
    if (t !== 0) return t;
    return a.quadraNome.localeCompare(b.quadraNome);
  });
}

async function assertSemConflito(
  clubeId: string,
  quadraId: string,
  inicio: Date,
  fim: Date
): Promise<void> {
  const lista = await listarReservasAtivasNoPeriodo(clubeId, inicio, fim);
  const hit = lista.some((r) => {
    if (r.quadraId !== quadraId) return false;
    const ri = toDate(r.inicio);
    const rf = toDate(r.fim);
    if (!ri || !rf) return false;
    return intervalosSobrepoem(inicio, fim, ri, rf);
  });
  if (hit) throw new Error('Horário já reservado nesta quadra.');
}

export async function criarBloqueioDono(input: {
  clubeId: string;
  quadraId: string;
  quadraNome: string;
  inicio: Date;
  fim: Date;
  tipo: Exclude<ReservaTipo, 'ranking'>;
  criadoPorUid: string;
  motivo?: string;
  torneioId?: string;
  /** Duração deste jogo (min); se omitido, calcula de inicio/fim */
  duracaoMin?: number;
}): Promise<string> {
  await assertSemConflito(input.clubeId, input.quadraId, input.inicio, input.fim);
  const duracaoMin =
    input.duracaoMin ??
    Math.max(5, Math.round((input.fim.getTime() - input.inicio.getTime()) / 60_000));
  const ref = await addDoc(collection(db, 'clubes', input.clubeId, 'reservas'), {
    quadraId: input.quadraId,
    quadraNome: input.quadraNome,
    inicio: Timestamp.fromDate(input.inicio),
    fim: Timestamp.fromDate(input.fim),
    tipo: input.tipo,
    status: 'confirmado' as ReservaStatus,
    criadoPorUid: input.criadoPorUid,
    duracaoMin,
    motivo: input.motivo?.trim() || '',
    torneioId: input.torneioId ?? '',
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Bloqueia o mesmo intervalo em vários dias (1 doc por dia — a grade lista por `inicio`).
 * `diaInteiro` usa abertura/fechamento efetivos da quadra em cada dia.
 * Dias fora de `diasSemana` da quadra são pulados.
 */
export async function criarBloqueiosDonoRange(input: {
  clubeId: string;
  quadraId: string;
  quadraNome: string;
  agenda: AgendaClubeConfig;
  quadra: QuadraClube;
  /** YYYY-MM-DD do primeiro dia */
  diaInicioISO: string;
  /** Quantidade de dias a partir do início (inclusive), 1–14 */
  qtdDias: number;
  /** Se true, bloqueia abertura→fechamento; senão usa inicioHHmm + fimHHmm */
  diaInteiro: boolean;
  inicioHHmm?: string;
  fimHHmm?: string;
  tipo: Exclude<ReservaTipo, 'ranking'>;
  criadoPorUid: string;
  motivo?: string;
}): Promise<{ ids: string[]; pulados: number }> {
  const qtd = Math.max(1, Math.min(14, Math.round(input.qtdDias)));
  const hor = horarioEfetivoQuadra(input.agenda, input.quadra);
  const ids: string[] = [];
  let pulados = 0;

  for (let i = 0; i < qtd; i++) {
    const [y, m, d] = input.diaInicioISO.split('-').map(Number);
    const dia = new Date(y, (m || 1) - 1, (d || 1) + i, 12, 0, 0, 0);
    if (!hor.diasSemana.includes(dia.getDay())) {
      pulados += 1;
      continue;
    }

    let inicio: Date;
    let fim: Date;
    if (input.diaInteiro) {
      const { h: ah, m: am } = parseHora(hor.abertura);
      const { h: fh, m: fm } = parseHora(hor.fechamento);
      inicio = new Date(dia);
      inicio.setHours(ah, am, 0, 0);
      fim = new Date(dia);
      fim.setHours(fh, fm, 0, 0);
    } else {
      const iniHH = input.inicioHHmm ?? hor.abertura;
      const fimHH = input.fimHHmm ?? hor.fechamento;
      const { h: ih, m: im } = parseHora(iniHH);
      const { h: fh, m: fm } = parseHora(fimHH);
      inicio = new Date(dia);
      inicio.setHours(ih, im, 0, 0);
      fim = new Date(dia);
      fim.setHours(fh, fm, 0, 0);
      if (fim.getTime() <= inicio.getTime()) {
        throw new Error('Horário final deve ser depois do início.');
      }
    }

    const id = await criarBloqueioDono({
      clubeId: input.clubeId,
      quadraId: input.quadraId,
      quadraNome: input.quadraNome,
      inicio,
      fim,
      tipo: input.tipo,
      criadoPorUid: input.criadoPorUid,
      motivo: input.motivo,
    });
    ids.push(id);
  }

  if (!ids.length) {
    throw new Error(
      'Nenhum dia bloqueado — todos estavam fora dos dias de funcionamento da quadra.'
    );
  }
  return { ids, pulados };
}

export async function cancelarReserva(
  clubeId: string,
  reservaId: string
): Promise<void> {
  await updateDoc(doc(db, 'clubes', clubeId, 'reservas', reservaId), {
    status: 'cancelado' as ReservaStatus,
    atualizadoEm: serverTimestamp(),
  });
}

export async function atualizarStatusReservaPorDesafio(
  clubeId: string,
  reservaId: string,
  status: 'confirmado' | 'cancelado'
): Promise<void> {
  await updateDoc(doc(db, 'clubes', clubeId, 'reservas', reservaId), {
    status,
    atualizadoEm: serverTimestamp(),
  });
}

/** Já existe desafio/reserva entre o par neste ranking? */
export async function jaMarcouComAdversario(opts: {
  rankingId: string;
  uidA: string;
  uidB: string;
}): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'desafios'), where('rankingId', '==', opts.rankingId))
  );
  const bloqueantes = new Set(['pendente', 'aceito', 'finalizado']);
  return snap.docs.some((d) => {
    const raw = d.data();
    const st = String(raw.status ?? '');
    if (!bloqueantes.has(st)) return false;
    const a = String(raw.desafiante ?? '');
    const b = String(raw.desafiado ?? '');
    return (
      (a === opts.uidA && b === opts.uidB) || (a === opts.uidB && b === opts.uidA)
    );
  });
}

export async function criarReservaRanking(input: {
  clubeId: string;
  clubeNome: string;
  quadraId: string;
  quadraNome: string;
  inicio: Date;
  fim: Date;
  rankingId: string;
  rankingNome: string;
  esporte: EsporteId;
  formato?: FormatoPartidaId;
  desafiante: string;
  desafianteNome: string;
  desafianteFoto?: string;
  desafianteParceiroUid?: string;
  desafianteParceiroNome?: string;
  desafianteParceiroFoto?: string;
  desafiado: string;
  desafiadoNome: string;
  desafiadoFoto?: string;
  desafiadoParceiroUid?: string;
  desafiadoParceiroNome?: string;
  desafiadoParceiroFoto?: string;
}): Promise<{ reservaId: string; desafioId: string }> {
  if (await jaMarcouComAdversario({
    rankingId: input.rankingId,
    uidA: input.desafiante,
    uidB: input.desafiado,
  })) {
    throw new Error('Vocês já marcaram ou jogaram neste ranking.');
  }

  await assertSemConflito(input.clubeId, input.quadraId, input.inicio, input.fim);

  const agendaCfg = await carregarAgendaDoClube(input.clubeId);
  const horas = agendaCfg.horasExpiracaoPreReserva ?? 48;
  const expiraEm = new Date(Date.now() + horas * 3600 * 1000);

  const dataLabel = input.inicio.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const reservaRef = await addDoc(collection(db, 'clubes', input.clubeId, 'reservas'), {
    quadraId: input.quadraId,
    quadraNome: input.quadraNome,
    inicio: Timestamp.fromDate(input.inicio),
    fim: Timestamp.fromDate(input.fim),
    tipo: 'ranking' as ReservaTipo,
    status: 'pendente' as ReservaStatus,
    criadoPorUid: input.desafiante,
    duracaoMin: Math.max(
      15,
      Math.round((input.fim.getTime() - input.inicio.getTime()) / 60_000)
    ),
    rankingId: input.rankingId,
    rankingNome: input.rankingNome,
    jogador1Uid: input.desafiante,
    jogador2Uid: input.desafiado,
    jogador1Nome: input.desafianteNome,
    jogador2Nome: input.desafiadoNome,
    jogador1Foto: input.desafianteFoto ?? '',
    jogador2Foto: input.desafiadoFoto ?? '',
    expiraEm: Timestamp.fromDate(expiraEm),
    criadoEm: serverTimestamp(),
  });

  const desafioId = await criarDesafio({
    desafiante: input.desafiante,
    desafianteNome: input.desafianteNome,
    desafianteFoto: input.desafianteFoto,
    desafianteParceiroUid: input.desafianteParceiroUid,
    desafianteParceiroNome: input.desafianteParceiroNome,
    desafianteParceiroFoto: input.desafianteParceiroFoto,
    desafiado: input.desafiado,
    desafiadoNome: input.desafiadoNome,
    desafiadoFoto: input.desafiadoFoto,
    desafiadoParceiroUid: input.desafiadoParceiroUid,
    desafiadoParceiroNome: input.desafiadoParceiroNome,
    desafiadoParceiroFoto: input.desafiadoParceiroFoto,
    esporte: input.esporte,
    quadra: `${input.quadraNome} · ${dataLabel}`,
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    formato: input.formato,
    dataSugerida: dataLabel,
    rankingId: input.rankingId,
    rankingNome: input.rankingNome,
    reservaId: reservaRef.id,
    mensagem: `Reserva de quadra ${input.quadraNome}`,
  });

  await updateDoc(doc(db, 'clubes', input.clubeId, 'reservas', reservaRef.id), {
    desafioId,
  });

  return { reservaId: reservaRef.id, desafioId };
}

export async function carregarAgendaDoClube(
  clubeId: string
): Promise<AgendaClubeConfig> {
  const snap = await getDoc(doc(db, 'clubes', clubeId));
  if (!snap.exists()) return normalizarAgenda(null);
  return normalizarAgenda(snap.data().agenda as Partial<AgendaClubeConfig> | undefined);
}

export { toDate as reservaToDate, normalizarAgenda, horarioEfetivoQuadra };
