import { Colors } from './colors';

export type EsporteId =
  | 'tenis'
  | 'padel'
  | 'raquetinha'
  | 'beachtennis'
  | 'pickleball';

export interface Esporte {
  id: EsporteId;
  nome: string;
  /** Fallback textual — preferir <EsporteIcon /> na UI */
  emoji: string;
  cor: string;
}

/** Ordem alinhada ao Figma da Home (+ Beach no final). */
export const ESPORTES: Esporte[] = [
  { id: 'tenis', nome: 'Tênis', emoji: '🎾', cor: Colors.accent },
  { id: 'raquetinha', nome: 'Raquetinha', emoji: '🏸', cor: Colors.accent },
  { id: 'padel', nome: 'Padel', emoji: '🏓', cor: Colors.accent },
  { id: 'pickleball', nome: 'Pickleball', emoji: '🟡', cor: Colors.accent },
  { id: 'beachtennis', nome: 'Beach tênis', emoji: '🏖️', cor: Colors.accent },
];

/** Ordem no cadastro (wizard) — inclui Pickleball. */
export const ESPORTES_ORDEM: EsporteId[] = [
  'tenis',
  'raquetinha',
  'padel',
  'pickleball',
  'beachtennis',
];
