import type { EsporteId } from '../constants/esportes';

export type SolicitacaoStatus = 'pendente' | 'aceito' | 'recusado';

export interface Clube {
  id: string;
  nome: string;
  cidade: string;
  esporte: EsporteId;
  donoUid: string;
  donoNome: string;
  criadoEm?: { seconds: number };
}

export interface Ranking {
  id: string;
  nome: string;
  clubeId: string;
  clubeNome: string;
  cidade: string;
  esporte: EsporteId;
  donoUid: string;
  descricao?: string;
  /** uids dos membros aceitos — usado para array-contains e "estou dentro?" */
  membros: string[];
  totalMembros: number;
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

/** Documento em rankings/{rankingId}/classificacao/{uid} */
export interface Classificacao {
  uid: string;
  nome: string;
  fotoUrl?: string;
  pts: number;
  vitorias: number;
  derrotas: number;
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
