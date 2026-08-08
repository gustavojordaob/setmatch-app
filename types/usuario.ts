import type { EsporteId } from '../constants/esportes';

export type NivelAtividade = 'iniciante' | 'intermediario' | 'avancado';

export type Genero = 'masculino' | 'feminino' | 'outro' | 'prefiro_nao_dizer';

/** jogador = app comum · admin_clube = dono de academia · professor = instrutor */
export type UserRole = 'jogador' | 'admin_clube' | 'professor';

export type TipoAdmin = 'clube' | 'professor';

export interface EnderecoUsuario {
  cep?: string;
  cidade: string;
  bairro?: string;
  estado?: string;
  rua?: string;
}

export interface UsuarioFirestore {
  nome: string;
  fotoUrl: string;
  email: string;
  role: UserRole;
  tipoAdmin?: TipoAdmin;
  /** ID amigável SM-XXXXXX — admin adiciona aluno / ranking */
  setmatchId: string;
  esportes: EsporteId[];
  idade: number;
  genero: string;
  peso: number;
  altura: number;
  nivel: NivelAtividade;
  cidade: string;
  bairro: string;
  estado: string;
  cep: string;
  rua: string;
  /** Celular com DDD — WhatsApp / contato direto */
  telefone: string;
  /** Geolocalização opcional — “perto de mim” */
  lat?: number;
  lng?: number;
  localizacaoAtualizadaEm?: unknown;
  vitorias: number;
  derrotas: number;
  onboardingOk: boolean;
}
