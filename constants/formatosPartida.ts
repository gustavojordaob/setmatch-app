import type { EsporteId } from './esportes';

/** Formato de confronto amistoso / desafio. */
export type FormatoPartidaId =
  | 'melhor_de_3'
  | 'melhor_de_3_stb'
  | 'melhor_de_5'
  | 'dois_sets'
  | 'pro_set'
  | 'so_tiebreak'
  | 'game_11'
  | 'melhor_de_3_games_11';

export interface FormatoPartida {
  id: FormatoPartidaId;
  label: string;
  short: string;
  desc: string;
  setsParaVencer: number;
  temSuperTiebreak: boolean;
  tiebreakAte: number;
}

export const FORMATOS_PARTIDA: FormatoPartida[] = [
  {
    id: 'melhor_de_3',
    label: 'Melhor de 3',
    short: 'Md3',
    desc: 'Quem vencer 2 sets. Tiebreak clássico no set.',
    setsParaVencer: 2,
    temSuperTiebreak: false,
    tiebreakAte: 7,
  },
  {
    id: 'melhor_de_3_stb',
    label: '2 sets; se empatar 1–1 → super TB até 10',
    short: '2 sets + STB',
    desc: 'Quem ganhar 2 sets leva. Se ficar 1 a 1, o desempate NÃO é um 3º set completo: é um super tiebreak (corrida até 10 pontos). Quem chegar a 10 fecha a partida.',
    setsParaVencer: 2,
    temSuperTiebreak: true,
    tiebreakAte: 10,
  },
  {
    id: 'melhor_de_5',
    label: 'Melhor de 5',
    short: 'Md5',
    desc: 'Quem vencer 3 sets. Formato clássico longo.',
    setsParaVencer: 3,
    temSuperTiebreak: false,
    tiebreakAte: 7,
  },
  {
    id: 'dois_sets',
    label: '2 sets fixos',
    short: '2 sets',
    desc: 'Sempre joga 2 sets — placar agregado conta.',
    setsParaVencer: 2,
    temSuperTiebreak: false,
    tiebreakAte: 7,
  },
  {
    id: 'pro_set',
    label: 'Pro set',
    short: 'Pro',
    desc: 'Um set longo (até 8 ou 10 games).',
    setsParaVencer: 1,
    temSuperTiebreak: false,
    tiebreakAte: 7,
  },
  {
    id: 'so_tiebreak',
    label: 'Só tiebreak até 10',
    short: 'TB10',
    desc: 'Partida rápida: um super tiebreak até 10.',
    setsParaVencer: 1,
    temSuperTiebreak: true,
    tiebreakAte: 10,
  },
  {
    id: 'game_11',
    label: 'Game até 11 (diferença 2)',
    short: 'G11',
    desc: 'Padrão pickleball: um game até 11 pontos, vence com diferença de 2.',
    setsParaVencer: 1,
    temSuperTiebreak: false,
    tiebreakAte: 11,
  },
  {
    id: 'melhor_de_3_games_11',
    label: 'Melhor de 3 · games até 11',
    short: 'Md3·11',
    desc: 'Pickleball clássico: melhor de 3 games, cada um até 11 (diferença 2).',
    setsParaVencer: 2,
    temSuperTiebreak: false,
    tiebreakAte: 11,
  },
];

export function formatoPorId(id?: string | null): FormatoPartida {
  return FORMATOS_PARTIDA.find((f) => f.id === id) ?? FORMATOS_PARTIDA[0];
}

export function labelFormato(id?: string | null): string {
  return formatoPorId(id).label;
}

/** Formatos sugeridos no desafio amistoso por esporte. */
export function formatosDesafioPorEsporte(esporte: EsporteId): FormatoPartida[] {
  if (esporte === 'pickleball') {
    return FORMATOS_PARTIDA.filter((f) =>
      ['game_11', 'melhor_de_3_games_11', 'melhor_de_3', 'so_tiebreak'].includes(f.id)
    );
  }
  return FORMATOS_PARTIDA.filter(
    (f) => f.id !== 'game_11' && f.id !== 'melhor_de_3_games_11'
  );
}
