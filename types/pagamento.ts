export type TipoPagamento = 'aula' | 'aula_online' | 'ranking' | 'torneio';
export type CicloPagamento = 'unico' | 'mensal';
export type StatusPagamento =
  | 'pendente'
  | 'aguardando_pagamento'
  | 'aprovado'
  | 'recusado'
  | 'cancelado'
  | 'atrasado'
  | 'liberado_admin';

export interface RegrasPagamentoBase {
  ativo: boolean;
  valor: number;
  regras: string;
  permitePix: boolean;
  permiteCartao: boolean;
  /** Desconto % ao pagar com PIX (0–100). */
  descontoPixPercent?: number;
  /** Desconto % ao pagar com cartão (0–100). */
  descontoCartaoPercent?: number;
}

export interface RegrasAulas extends RegrasPagamentoBase {
  ciclo: 'mensal';
}

export interface RegrasRankingPagamento extends RegrasPagamentoBase {
  ciclo: CicloPagamento;
  exigeParaEntrar: boolean;
}

export interface RegrasTorneioPagamento extends RegrasPagamentoBase {
  ciclo: 'unico';
  prazoPagamento?: string;
  cartaoMaxParcelas: 1;
}

export interface PagamentoDoc {
  id: string;
  uid: string;
  setmatchId: string;
  nome: string;
  telefone?: string;
  tipo: TipoPagamento;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  rankingId?: string;
  rankingNome?: string;
  torneioId?: string;
  torneioNome?: string;
  /** Aula online publicada (`aulasPublicadas/{id}`) */
  aulaPublicadaId?: string;
  aulaTitulo?: string;
  valor: number;
  ciclo: CicloPagamento;
  status: StatusPagamento;
  /** Meio escolhido no checkout (para auditoria / promo). */
  meioPagamento?: 'pix' | 'cartao';
  descontoPercent?: number;
  valorBase?: number;
  preferenceId?: string;
  paymentId?: string;
  initPoint?: string;
  sandboxInitPoint?: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  vigenteAte?: { seconds: number };
  liberadoPeloAdmin?: boolean;
  criadoEm?: { seconds: number };
  atualizadoEm?: { seconds: number };
}

export interface MatriculaAula {
  id: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  uid: string;
  setmatchId: string;
  nome: string;
  telefone?: string;
  status: 'pendente' | 'ativo' | 'inativo' | 'atrasado';
  modalidadeId?: string;
  modalidadeNome?: string;
  valorBase?: number;
  descontoPercent?: number;
  valorFinal?: number;
  pagamentoId?: string;
  criadoEm?: { seconds: number };
}
