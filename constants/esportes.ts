import { Colors } from './colors';

export type EsporteId = 'tenis' | 'padel' | 'raquetinha' | 'beachtennis';

export interface Esporte {
  id: EsporteId;
  nome: string;
  emoji: string;
  cor: string;
}

export const ESPORTES: Esporte[] = [
  { id: 'tenis', nome: 'Tênis', emoji: '🎾', cor: Colors.secondary },
  { id: 'padel', nome: 'Padel', emoji: '🏸', cor: Colors.secondary },
  { id: 'raquetinha', nome: 'Raquetinha', emoji: '🏓', cor: Colors.secondary },
  { id: 'beachtennis', nome: 'Beachtênis', emoji: '🏖️', cor: Colors.secondary },
];
