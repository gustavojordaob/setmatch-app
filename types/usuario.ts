import type { EsporteId } from '../constants/esportes';

export type NivelAtividade = 'iniciante' | 'intermediario' | 'avancado';

export type Genero = 'masculino' | 'feminino' | 'outro' | 'prefiro_nao_dizer';

export interface UsuarioFirestore {
  nome: string;
  fotoUrl: string;
  email: string;
  esportes: EsporteId[];
  idade: number;
  genero: string;
  peso: number;
  altura: number;
  nivel: NivelAtividade;
  vitorias: number;
  derrotas: number;
  onboardingOk: boolean;
}
