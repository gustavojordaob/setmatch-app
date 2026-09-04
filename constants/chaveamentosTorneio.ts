import type { EsporteId } from './esportes';
import { FORMATOS_PARTIDA, type FormatoPartidaId } from './formatosPartida';

export type FormatoChavesId =
  | 'simples'
  | 'round_robin'
  | 'espelho'
  | 'dupla_eliminatoria'
  | 'grupos_mata';

export type DefinicaoChaveId = 'manual' | 'sorteio';

export type EstruturaMataId = 64 | 32 | 16 | 8 | 4;

export interface FormatoChaves {
  id: FormatoChavesId;
  label: string;
  desc: string;
}

export const FORMATOS_CHAVES: FormatoChaves[] = [
  { id: 'simples', label: 'Simples', desc: 'Eliminação simples (mata-mata).' },
  { id: 'round_robin', label: 'Round Robin', desc: 'Todos contra todos.' },
  { id: 'espelho', label: 'Espelho', desc: 'Chave espelhada por ranking/seed.' },
  {
    id: 'dupla_eliminatoria',
    label: 'Dupla Eliminatória',
    desc: 'Perdedor vai para a chave de consolação.',
  },
  {
    id: 'grupos_mata',
    label: 'Grupos + Mata',
    desc: 'Fase de grupos e depois chave eliminatória.',
  },
];

export const DEFINICOES_CHAVE: { id: DefinicaoChaveId; label: string }[] = [
  { id: 'manual', label: 'Manual' },
  { id: 'sorteio', label: 'Sorteio' },
];

export const ESTRUTURAS_MATA: { id: EstruturaMataId; label: string }[] = [
  { id: 64, label: '64 avos' },
  { id: 32, label: '32 avos' },
  { id: 16, label: '16 avos' },
  { id: 8, label: 'Oitavas (8)' },
  { id: 4, label: 'Quartas (4)' },
];

/** Formatos Figma + extras por esporte. */
export type FormatoPartidaTorneioId =
  | FormatoPartidaId
  | 'tres_sets_de_3'
  | 'dois_sets_de_3'
  | 'um_set_de_6'
  | 'dois_sets_de_6'
  | 'game_8'
  | 'melhor_de_5_stb'
  | 'game_15';

export interface FormatoPartidaTorneio {
  id: FormatoPartidaTorneioId;
  label: string;
  esportes: EsporteId[] | 'todos';
}

export const FORMATOS_PARTIDA_TORNEIO: FormatoPartidaTorneio[] = [
  { id: 'tres_sets_de_3', label: '3 Sets de 3', esportes: 'todos' },
  { id: 'dois_sets_de_3', label: '2 Sets de 3', esportes: 'todos' },
  { id: 'um_set_de_6', label: '1 Set de 6', esportes: 'todos' },
  { id: 'dois_sets_de_6', label: '2 Sets de 6', esportes: 'todos' },
  { id: 'game_8', label: 'Game até 8', esportes: ['tenis', 'beachtennis', 'raquetinha'] },
  {
    id: 'game_11',
    label: 'Game até 11 (diferença 2)',
    esportes: ['pickleball'],
  },
  {
    id: 'melhor_de_3_games_11',
    label: 'Melhor de 3 · games até 11',
    esportes: ['pickleball'],
  },
  {
    id: 'game_15',
    label: 'Game até 15',
    esportes: ['pickleball'],
  },
  { id: 'melhor_de_3', label: 'Melhor de 3 sets', esportes: 'todos' },
  {
    id: 'melhor_de_3_stb',
    label: '2 sets; se empatar 1–1 → super TB até 10',
    esportes: 'todos',
  },
  { id: 'melhor_de_5', label: 'Melhor de 5 sets', esportes: ['tenis'] },
  { id: 'melhor_de_5_stb', label: 'Melhor de 5 + super tiebreak', esportes: ['tenis'] },
  { id: 'pro_set', label: 'Pro set', esportes: 'todos' },
  { id: 'so_tiebreak', label: 'Só TB até 10', esportes: 'todos' },
  { id: 'dois_sets', label: '2 sets fixos', esportes: 'todos' },
];

export function formatosPartidaPorEsporte(esporte: EsporteId): FormatoPartidaTorneio[] {
  return FORMATOS_PARTIDA_TORNEIO.filter(
    (f) => f.esportes === 'todos' || f.esportes.includes(esporte)
  );
}

/** Sugestão ao admin ao trocar o esporte no torneio/ranking. */
export function formatoPartidaPadraoPorEsporte(
  esporte: EsporteId
): FormatoPartidaTorneioId {
  if (esporte === 'pickleball') return 'melhor_de_3_games_11';
  if (esporte === 'tenis') return 'melhor_de_3_stb';
  if (esporte === 'padel' || esporte === 'beachtennis') return 'dois_sets_de_6';
  return 'tres_sets_de_3';
}

export interface GruposConfig {
  qtdGrupos: number;
  jogadoresPorGrupo: number;
  classificadosPorGrupo: number;
}

/** Preview textual da estrutura gerada. */
export function previewEstruturaTorneio(opts: {
  formatoChaves: FormatoChavesId;
  estruturaMata?: EstruturaMataId;
  grupos?: GruposConfig;
}): string {
  if (opts.formatoChaves === 'grupos_mata' && opts.grupos) {
    const g = opts.grupos;
    const classificados = g.qtdGrupos * g.classificadosPorGrupo;
    let fase = 'final';
    if (classificados >= 32) fase = '32 avos';
    else if (classificados >= 16) fase = 'oitavas / 16';
    else if (classificados >= 8) fase = 'quartas';
    else if (classificados >= 4) fase = 'semi';
    return `${g.qtdGrupos} grupos × ${g.jogadoresPorGrupo} → ${g.classificadosPorGrupo} classificados/grupo = ${classificados} na chave (${fase} → final)`;
  }
  if (opts.formatoChaves === 'round_robin') {
    return 'Round robin: todos jogam entre si; classificação por pontos.';
  }
  if (opts.formatoChaves === 'dupla_eliminatoria') {
    return `Dupla eliminação${opts.estruturaMata ? ` a partir de ${opts.estruturaMata}` : ''}.`;
  }
  if (opts.formatoChaves === 'espelho') {
    return `Chave espelhada${opts.estruturaMata ? ` (${opts.estruturaMata})` : ''} por seed.`;
  }
  return `Eliminação simples${opts.estruturaMata ? ` — chave de ${opts.estruturaMata}` : ''}.`;
}

export function labelFormatoPartidaTorneio(id?: string | null): string {
  const t = FORMATOS_PARTIDA_TORNEIO.find((f) => f.id === id);
  if (t) return t.label;
  const base = FORMATOS_PARTIDA.find((f) => f.id === id);
  return base?.label ?? 'Formato a definir';
}
