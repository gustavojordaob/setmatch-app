import type { EsporteId } from '../constants/esportes';

/** Formato de confronto amistoso / desafio. */
export type FormatoPartidaId =
  | 'melhor_de_3'
  | 'melhor_de_3_stb'
  | 'melhor_de_5'
  | 'dois_sets'
  | 'pro_set'
  | 'so_tiebreak';

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
    label: 'Melhor de 3 + STB',
    short: 'Md3·STB',
    desc: '2 sets + super tiebreak até 10 no lugar do 3º.',
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
];

export function formatoPorId(id?: string | null): FormatoPartida {
  return FORMATOS_PARTIDA.find((f) => f.id === id) ?? FORMATOS_PARTIDA[0];
}

export function labelFormato(id?: string | null): string {
  return formatoPorId(id).label;
}
