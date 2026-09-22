import type { NivelAtividade } from '../types/usuario';

export interface NivelOption {
  id: NivelAtividade;
  label: string;
  desc: string;
}

export const NIVEIS: NivelOption[] = [
  { id: 'iniciante', label: 'Iniciante', desc: 'Começando agora ou jogo ocasionalmente' },
  { id: 'intermediario', label: 'Intermediário', desc: 'Jogo regularmente e conheço as regras' },
  { id: 'avancado', label: 'Avançado', desc: 'Competitivo, treino e jogo torneios' },
];
