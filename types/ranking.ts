import type { EsporteId } from '../constants/esportes';
import type { FormatoPartidaTorneioId } from '../constants/chaveamentosTorneio';
import {
  FORMATOS_PARTIDA_TORNEIO,
  type FormatoChavesId,
} from '../constants/chaveamentosTorneio';

export type SolicitacaoStatus = 'pendente' | 'aceito' | 'recusado';

/** Como o ranking organiza os jogos (ladder academia / grupos / todos x todos). */
export type ModeloRankingId = 'ladder' | 'grupos' | 'todos_contra_todos';

export const MODELOS_RANKING: {
  id: ModeloRankingId;
  label: string;
  desc: string;
}[] = [
  {
    id: 'ladder',
    label: 'Escada (acima/abaixo)',
    desc: 'Como academia: enfrenta quem está logo acima e abaixo na tabela.',
  },
  {
    id: 'grupos',
    label: 'Grupos',
    desc: 'Divide em grupos; confrontos preferencialmente dentro do grupo.',
  },
  {
    id: 'todos_contra_todos',
    label: 'Todos contra todos',
    desc: 'Qualquer membro pode marcar com qualquer outro (round robin livre).',
  },
];

export interface RankingRegrasJogo {
  /** Formatos alinhados ao torneio (2 sets + super TB, game 8, 2×6…). */
  formatoPartidaId: FormatoPartidaTorneioId;
  modelo: ModeloRankingId;
  jogosPorMes: number;
  enfrentaAcima: number;
  enfrentaAbaixo: number;
  ptsJogoCompleto: number;
  /** Pontos que TODO mundo ganha só por jogar (vencedor e perdedor). */
  ptsParticipacao: number;
  /** Se true, vencedor também recebe ptsParticipacao além do placar. */
  participacaoTambemVencedor: boolean;
  /** Config opcional quando modelo = grupos. */
  qtdGrupos?: number;
  jogadoresPorGrupo?: number;
  textoLivre?: string;
}

export const REGRAS_JOGO_PADRAO: RankingRegrasJogo = {
  formatoPartidaId: 'melhor_de_3_stb',
  modelo: 'ladder',
  jogosPorMes: 2,
  enfrentaAcima: 1,
  enfrentaAbaixo: 1,
  ptsJogoCompleto: 35,
  ptsParticipacao: 5,
  participacaoTambemVencedor: true,
  qtdGrupos: 4,
  jogadoresPorGrupo: 4,
  textoLivre: '',
};

export function labelFormatoRanking(id?: string | null): string {
  const f = FORMATOS_PARTIDA_TORNEIO.find((x) => x.id === id);
  return f?.label ?? id ?? 'Formato';
}

export function labelModeloRanking(id?: ModeloRankingId | null): string {
  return MODELOS_RANKING.find((m) => m.id === id)?.label ?? 'Escada';
}

/** Compat: docs antigos sem modelo / formato legado. */
export function normalizarRegrasJogo(
  raw?: Partial<RankingRegrasJogo> | null
): RankingRegrasJogo {
  return {
    ...REGRAS_JOGO_PADRAO,
    ...raw,
    formatoPartidaId: (raw?.formatoPartidaId ??
      REGRAS_JOGO_PADRAO.formatoPartidaId) as FormatoPartidaTorneioId,
    modelo: raw?.modelo ?? 'ladder',
    participacaoTambemVencedor: raw?.participacaoTambemVencedor ?? true,
  };
}

export interface Clube {
  id: string;
  nome: string;
  cidade: string;
  esporte: EsporteId;
  donoUid: string;
  donoNome: string;
  criadoEm?: { seconds: number };
}

/**
 * Nível/categoria dentro de um ranking (A/B/C, 1/2/3…).
 * `ordem` 0 = mais forte (topo). Maior ordem = categoria mais baixa.
 * `sobeQuantos` = top N deste nível sobem para o nível acima.
 * `caiQuantos` = bottom M deste nível caem para o nível abaixo.
 */
export interface RankingNivel {
  id: string;
  nome: string;
  ordem: number;
  sobeQuantos: number;
  caiQuantos: number;
}

export interface RankingNiveisConfig {
  ativo: boolean;
  /** Rodada automática no dia N do mês (1–28). */
  autoAtivo: boolean;
  autoDiaMes: number;
  niveis: RankingNivel[];
  /** YYYY-MM da última rodada (auto ou manual) — evita duplicar no mês. */
  ultimaMovimentacaoMes?: string;
}

export const NIVEIS_CONFIG_INATIVO: RankingNiveisConfig = {
  ativo: false,
  autoAtivo: true,
  autoDiaMes: 1,
  niveis: [],
};

/** Preset A / B / C com 3 sobem e 3 caem nas fronteiras. */
export function niveisPadraoABC(): RankingNivel[] {
  return [
    { id: 'a', nome: 'A', ordem: 0, sobeQuantos: 0, caiQuantos: 3 },
    { id: 'b', nome: 'B', ordem: 1, sobeQuantos: 3, caiQuantos: 3 },
    { id: 'c', nome: 'C', ordem: 2, sobeQuantos: 3, caiQuantos: 0 },
  ];
}

/** Preset numérico 1…N (1 = topo). */
export function niveisPadraoNumerico(qtd: number, sobe = 3, cai = 3): RankingNivel[] {
  const n = Math.max(2, Math.min(12, Math.floor(qtd) || 3));
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    nome: String(i + 1),
    ordem: i,
    sobeQuantos: i === 0 ? 0 : sobe,
    caiQuantos: i === n - 1 ? 0 : cai,
  }));
}

export function normalizarNiveisConfig(
  raw?: Partial<RankingNiveisConfig> | null
): RankingNiveisConfig {
  const niveis = Array.isArray(raw?.niveis)
    ? [...raw!.niveis]
        .map((x, i) => ({
          id: String(x.id || `n${i}`),
          nome: String(x.nome || `Nível ${i + 1}`).trim() || `Nível ${i + 1}`,
          ordem: Number.isFinite(Number(x.ordem)) ? Number(x.ordem) : i,
          sobeQuantos: Math.max(0, Math.floor(Number(x.sobeQuantos) || 0)),
          caiQuantos: Math.max(0, Math.floor(Number(x.caiQuantos) || 0)),
        }))
        .sort((a, b) => a.ordem - b.ordem)
    : [];
  const dia = Math.min(28, Math.max(1, Math.floor(Number(raw?.autoDiaMes) || 1)));
  return {
    ativo: Boolean(raw?.ativo) && niveis.length >= 2,
    autoAtivo: raw?.autoAtivo !== false,
    autoDiaMes: dia,
    niveis,
    ultimaMovimentacaoMes: raw?.ultimaMovimentacaoMes
      ? String(raw.ultimaMovimentacaoMes)
      : undefined,
  };
}

export function nivelMaisBaixo(niveis: RankingNivel[]): RankingNivel | null {
  if (!niveis.length) return null;
  return [...niveis].sort((a, b) => b.ordem - a.ordem)[0] ?? null;
}

export interface Ranking {
  id: string;
  nome: string;
  clubeId: string;
  clubeNome: string;
  /** Logo do clube (desnormalizado de `clubes.logoUrl`) */
  clubeLogoUrl?: string;
  cidade: string;
  esporte: EsporteId;
  donoUid: string;
  /** simples | dupla — default por esporte */
  composicao?: import('../constants/composicao').ComposicaoId;
  descricao?: string;
  membros: string[];
  totalMembros: number;
  regrasJogo?: RankingRegrasJogo;
  /** Categorias A/B/C ou 1/2/3… com sobe/desce. */
  niveis?: RankingNiveisConfig;
  pagamento?: {
    ativo: boolean;
    valor: number;
    ciclo: 'unico' | 'mensal';
    regras: string;
    exigeParaEntrar: boolean;
    permitePix: boolean;
    permiteCartao: boolean;
    descontoPixPercent?: number;
    descontoCartaoPercent?: number;
  };
  criadoEm?: { seconds: number };
}

export interface Classificacao {
  uid: string;
  nome: string;
  fotoUrl?: string;
  pts: number;
  vitorias: number;
  derrotas: number;
  /** Grupo opcional (modelo grupos). */
  grupo?: string;
  /** ID do nível/categoria (`RankingNivel.id`) quando niveis.ativo. */
  nivelId?: string;
  /**
   * Mês civil (YYYY-MM) do último jogo de ranking.
   * Sem jogo no mês atual → pts zerados na abertura da tabela.
   */
  ultimoJogoMes?: string;
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroAceito?: boolean;
  pagamentoOk?: boolean;
}

export interface Solicitacao {
  id: string;
  rankingId: string;
  rankingNome: string;
  clubeId: string;
  clubeNome: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
  donoUid: string;
  status: SolicitacaoStatus;
  criadoEm?: { seconds: number };
}

export type TipoPartida = 'ranking' | 'amistoso';

/** @deprecated use ModeloRankingId — espelho leve de chaveamento torneio */
export type RankingFormatoChavesHint = FormatoChavesId;
