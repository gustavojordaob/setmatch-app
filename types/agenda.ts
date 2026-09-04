import type { EsporteId } from '../constants/esportes';

/** Minutos — dono escolhe nas opções ou valor custom (15–480). */
export type DuracaoSlotMin = number;

/** Presets na UI do dono (pode ir além de 90). */
export const DURACOES_SLOT_OPCOES: number[] = [30, 45, 60, 90, 120, 150, 180, 240];

/** Presets de bloqueio — inclui slots curtos (15/30). */
export const DURACOES_BLOQUEIO_OPCOES: number[] = [
  15, 30, 45, 60, 90, 120, 150, 180, 240,
];

/** Quantos dias a partir do dia escolhido (inclusive). */
export const BLOQUEIO_DIAS_OPCOES = [1, 2, 3, 4, 5, 7] as const;

export type ReservaTipo =
  | 'ranking'
  | 'bloqueio_torneio'
  | 'bloqueio_aula'
  | 'bloqueio_amistoso'
  | 'bloqueio_outro';

export type ReservaStatus = 'pendente' | 'confirmado' | 'cancelado' | 'expirado';

/** Config de funcionamento no doc `clubes/{id}.agenda` — dono define. */
export interface AgendaClubeConfig {
  ativo: boolean;
  /** "07:00" */
  abertura: string;
  /** "22:00" */
  fechamento: string;
  /** Duração padrão dos slots/jogos (min) — dono define; pode ser > 90 */
  duracaoSlotMin: DuracaoSlotMin;
  /** 0=dom … 6=sáb */
  diasSemana: number[];
  /**
   * Quantos meses à frente o clube libera para agendar.
   * (1 = ~este mês à frente, 2 = dois meses, etc.)
   */
  mesesAntecipacao: number;
  /** @deprecated preferir mesesAntecipacao — mantido p/ docs antigos */
  antecipacaoDias?: number;
  /**
   * Horas até a pré-reserva de ranking expirar se o adversário não confirmar.
   * Padrão 48.
   */
  horasExpiracaoPreReserva: number;
}

export const MESES_ANTECIPACAO_OPCOES = [1, 2, 3, 4, 6] as const;

export const AGENDA_PADRAO: AgendaClubeConfig = {
  ativo: false,
  abertura: '07:00',
  fechamento: '22:00',
  duracaoSlotMin: 60,
  diasSemana: [1, 2, 3, 4, 5, 6],
  mesesAntecipacao: 1,
  antecipacaoDias: 30,
  horasExpiracaoPreReserva: 48,
};

/**
 * Quadra do clube. Horário/data são por quadra:
 * se abertura/fechamento/diasSemana/duracao omitidos, herda `clubes.agenda`.
 */
export interface QuadraClube {
  id: string;
  nome: string;
  esporte: EsporteId;
  ativa: boolean;
  ordem: number;
  abertura?: string;
  fechamento?: string;
  diasSemana?: number[];
  /** Override da duração padrão só nesta quadra */
  duracaoSlotMin?: number;
}

export interface ReservaQuadra {
  id: string;
  quadraId: string;
  quadraNome: string;
  inicio: { seconds: number } | Date;
  fim: { seconds: number } | Date;
  tipo: ReservaTipo;
  status: ReservaStatus;
  criadoPorUid: string;
  /** Duração efetiva deste jogo (min) — pode diferir do padrão do clube */
  duracaoMin?: number;
  motivo?: string;
  rankingId?: string;
  rankingNome?: string;
  desafioId?: string;
  jogador1Uid?: string;
  jogador2Uid?: string;
  jogador1Nome?: string;
  jogador2Nome?: string;
  jogador1Foto?: string;
  jogador2Foto?: string;
  torneioId?: string;
  /** Timestamp Firestore — pré-reserva ranking expira se não confirmar */
  expiraEm?: { seconds: number } | Date;
  desafioId?: string;
  criadoEm?: { seconds: number };
}

export interface SlotLivre {
  inicio: Date;
  fim: Date;
  quadraId: string;
  quadraNome: string;
  duracaoMin: number;
}

/** Célula da grade do dia (livre ou ocupada) — por quadra. */
export type GradeSlot =
  | {
      kind: 'livre';
      inicio: Date;
      fim: Date;
      quadraId: string;
      quadraNome: string;
      duracaoMin: number;
    }
  | {
      kind: 'ocupado';
      inicio: Date;
      fim: Date;
      quadraId: string;
      quadraNome: string;
      reserva: ReservaQuadra;
    };

export const TIPOS_BLOQUEIO: {
  id: Exclude<ReservaTipo, 'ranking'>;
  label: string;
}[] = [
  { id: 'bloqueio_torneio', label: 'Torneio' },
  { id: 'bloqueio_aula', label: 'Aula' },
  { id: 'bloqueio_amistoso', label: 'Amistoso' },
  { id: 'bloqueio_outro', label: 'Outro' },
];

export function labelTipoReserva(tipo: ReservaTipo): string {
  if (tipo === 'ranking') return 'Ranking';
  return TIPOS_BLOQUEIO.find((t) => t.id === tipo)?.label ?? tipo;
}

export function labelDuracaoMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (m === 0) return h === 1 ? '1 hora' : `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

/** Cor de badge por tipo (usa tokens do app). */
export function categoriaTipoReserva(
  tipo: ReservaTipo
): 'ranking' | 'torneio' | 'amistoso' | 'aula' | 'outro' {
  if (tipo === 'ranking') return 'ranking';
  if (tipo === 'bloqueio_torneio') return 'torneio';
  if (tipo === 'bloqueio_amistoso') return 'amistoso';
  if (tipo === 'bloqueio_aula') return 'aula';
  return 'outro';
}

/** Clamp duração válida (15 min – 8 h). */
export function normalizarDuracaoMin(raw: unknown, fallback = 60): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 15) return fallback;
  return Math.min(480, Math.round(n));
}

export function normalizarAgenda(
  raw?: Partial<AgendaClubeConfig> | null
): AgendaClubeConfig {
  let meses = AGENDA_PADRAO.mesesAntecipacao;
  if (typeof raw?.mesesAntecipacao === 'number' && raw.mesesAntecipacao > 0) {
    meses = Math.min(12, Math.round(raw.mesesAntecipacao));
  } else if (typeof raw?.antecipacaoDias === 'number' && raw.antecipacaoDias > 0) {
    meses = Math.min(12, Math.max(1, Math.ceil(raw.antecipacaoDias / 30)));
  }
  return {
    ativo: Boolean(raw?.ativo),
    abertura: raw?.abertura || AGENDA_PADRAO.abertura,
    fechamento: raw?.fechamento || AGENDA_PADRAO.fechamento,
    duracaoSlotMin: normalizarDuracaoMin(
      raw?.duracaoSlotMin,
      AGENDA_PADRAO.duracaoSlotMin
    ),
    diasSemana:
      Array.isArray(raw?.diasSemana) && raw!.diasSemana!.length
        ? raw!.diasSemana!
        : AGENDA_PADRAO.diasSemana,
    mesesAntecipacao: meses,
    antecipacaoDias: meses * 30,
    horasExpiracaoPreReserva: (() => {
      const h = Number(raw?.horasExpiracaoPreReserva);
      if (Number.isFinite(h) && h >= 1) return Math.min(168, Math.round(h));
      return AGENDA_PADRAO.horasExpiracaoPreReserva;
    })(),
  };
}

/** Horário + duração efetiva da quadra (override ou agenda do clube). */
export function horarioEfetivoQuadra(
  agenda: AgendaClubeConfig,
  quadra: QuadraClube
): {
  abertura: string;
  fechamento: string;
  diasSemana: number[];
  duracaoSlotMin: number;
} {
  return {
    abertura: quadra.abertura || agenda.abertura,
    fechamento: quadra.fechamento || agenda.fechamento,
    diasSemana:
      Array.isArray(quadra.diasSemana) && quadra.diasSemana.length
        ? quadra.diasSemana
        : agenda.diasSemana,
    duracaoSlotMin: normalizarDuracaoMin(
      quadra.duracaoSlotMin,
      agenda.duracaoSlotMin
    ),
  };
}
