import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import type { ComposicaoId } from '../constants/composicao';
import { composicaoPadraoPorEsporte } from '../constants/composicao';
import type {
  DefinicaoChaveId,
  EstruturaMataId,
  FormatoChavesId,
  FormatoPartidaTorneioId,
  GruposConfig,
} from '../constants/chaveamentosTorneio';
import { criarConviteDupla } from './duplas';
import { criarRegistroPagamento } from './pagamentos';
import { criarNotificacao } from './notificacoes';

export type TorneioStatus = 'aberto' | 'em_andamento' | 'finalizado';
export type InscricaoStatus =
  | 'aguardando_parceiro'
  | 'aguardando_pagamento'
  | 'confirmado';

export interface CategoriaTorneio {
  id: string;
  nome: string;
  /** Por categoria: permite misturar simples e dupla no mesmo torneio. */
  composicao?: ComposicaoId;
}

export interface CampeaoCategoria {
  uid: string;
  nome: string;
  categoriaId?: string | null;
  categoriaNome?: string | null;
}

export interface Torneio {
  id: string;
  clubeId: string;
  clubeNome: string;
  cidade: string;
  nome: string;
  esporte: EsporteId;
  composicao: ComposicaoId;
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
  local?: string;
  donoUid: string;
  status: TorneioStatus;
  totalInscritos: number;
  /** Categorias definidas pelo dono do clube (ex.: A, B, Feminino). */
  categorias?: CategoriaTorneio[];
  formatoChaves?: FormatoChavesId;
  definicaoChave?: DefinicaoChaveId;
  estruturaMata?: EstruturaMataId;
  gruposConfig?: GruposConfig;
  formatoPartidaId?: FormatoPartidaTorneioId;
  /** Logo do clube (desnormalizado) */
  clubeLogoUrl?: string;
  /** Logo próprio do torneio (patrocínio etc.) */
  logoUrl?: string;
  /** Banner de divulgação (arte larga) */
  bannerUrl?: string;
  estruturaPreview?: string;
  campeaoUid?: string;
  campeaoNome?: string;
  /** Campeões por categoria (chave = categoriaId ou "geral"). */
  campeoesPorCategoria?: Record<string, CampeaoCategoria>;
  /** true quando o admin sorteou/liberou a chave para todos verem */
  chaveLiberada?: boolean;
  /** true = não aceita novas inscrições (mesmo se status ainda aberto). */
  inscricoesEncerradas?: boolean;
  /** Horário padrão / referência (organizador). Jogador não reserva. */
  horarioPadrao?: string;
  /** Quadra opcional do evento (organizador). */
  quadraNome?: string;
  /** Se true, só o organizador registra placar. */
  resultadoSoOrganizador?: boolean;
  pagamento?: {
    ativo: boolean;
    valor: number;
    regras: string;
    prazoPagamento?: string;
    permitePix: boolean;
    permiteCartao: boolean;
    descontoPixPercent?: number;
    descontoCartaoPercent?: number;
    /** R$ abatidos a partir da 2ª categoria do mesmo jogador. */
    descontoMultiCategoriaValor?: number;
  };
}

export interface InscricaoTorneio {
  id: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
  telefone?: string;
  categoriaId?: string;
  categoriaNome?: string;
  status?: InscricaoStatus;
  pago?: boolean;
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroAceito?: boolean;
  parceiroPago?: boolean;
  criadoEm?: { seconds: number };
}

/** Id do doc em inscritos: legado = uid; multi-categoria = uid__categoriaId */
export function inscricaoTorneioDocId(uid: string, categoriaId?: string): string {
  if (!categoriaId) return uid;
  return `${uid}__${categoriaId}`;
}

export function novaCategoriaId(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function mapCategorias(raw: unknown): CategoriaTorneio[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as { id?: unknown; nome?: unknown; composicao?: unknown };
      const id = String(o.id ?? '').trim();
      const nome = String(o.nome ?? '').trim();
      if (!id || !nome) return null;
      const comp = o.composicao === 'dupla' || o.composicao === 'simples'
        ? (o.composicao as ComposicaoId)
        : undefined;
      return { id, nome, ...(comp ? { composicao: comp } : {}) };
    })
    .filter((x): x is CategoriaTorneio => x != null);
}

function mapCampeoesPorCategoria(raw: unknown): Record<string, CampeaoCategoria> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, CampeaoCategoria> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const o = v as Record<string, unknown>;
    const uid = String(o.uid ?? '').trim();
    const nome = String(o.nome ?? '').trim();
    if (!uid && !nome) continue;
    out[k] = {
      uid,
      nome,
      categoriaId: o.categoriaId != null ? String(o.categoriaId) : null,
      categoriaNome: o.categoriaNome != null ? String(o.categoriaNome) : null,
    };
  }
  return out;
}

function mapTorneio(id: string, raw: Record<string, unknown>): Torneio {
  return {
    id,
    clubeId: String(raw.clubeId ?? ''),
    clubeNome: String(raw.clubeNome ?? ''),
    cidade: String(raw.cidade ?? ''),
    nome: String(raw.nome ?? ''),
    esporte: (raw.esporte as EsporteId) ?? 'tenis',
    composicao:
      (raw.composicao as ComposicaoId) ??
      composicaoPadraoPorEsporte((raw.esporte as EsporteId) ?? 'tenis'),
    dataInicio: raw.dataInicio ? String(raw.dataInicio) : undefined,
    dataFim: raw.dataFim ? String(raw.dataFim) : undefined,
    descricao: raw.descricao ? String(raw.descricao) : undefined,
    local: raw.local ? String(raw.local) : undefined,
    donoUid: String(raw.donoUid ?? ''),
    status: (raw.status as TorneioStatus) ?? 'aberto',
    totalInscritos: Number(raw.totalInscritos ?? 0),
    categorias: mapCategorias(raw.categorias),
    formatoChaves: raw.formatoChaves as FormatoChavesId | undefined,
    definicaoChave: raw.definicaoChave as DefinicaoChaveId | undefined,
    estruturaMata: raw.estruturaMata != null ? (Number(raw.estruturaMata) as EstruturaMataId) : undefined,
    formatoPartidaId: raw.formatoPartidaId as FormatoPartidaTorneioId | undefined,
    clubeLogoUrl: raw.clubeLogoUrl ? String(raw.clubeLogoUrl) : undefined,
    logoUrl: raw.logoUrl ? String(raw.logoUrl) : undefined,
    bannerUrl: raw.bannerUrl ? String(raw.bannerUrl) : undefined,
    estruturaPreview: raw.estruturaPreview ? String(raw.estruturaPreview) : undefined,
    campeaoUid: raw.campeaoUid ? String(raw.campeaoUid) : undefined,
    campeaoNome: raw.campeaoNome ? String(raw.campeaoNome) : undefined,
    campeoesPorCategoria: mapCampeoesPorCategoria(raw.campeoesPorCategoria),
    chaveLiberada: Boolean(raw.chaveLiberada),
    inscricoesEncerradas: Boolean(raw.inscricoesEncerradas),
    horarioPadrao: raw.horarioPadrao ? String(raw.horarioPadrao) : undefined,
    quadraNome: raw.quadraNome ? String(raw.quadraNome) : undefined,
    resultadoSoOrganizador: Boolean(raw.resultadoSoOrganizador),
    pagamento: raw.pagamento
      ? {
          ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
          valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
          regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
          prazoPagamento: (raw.pagamento as { prazoPagamento?: string }).prazoPagamento
            ? String((raw.pagamento as { prazoPagamento?: string }).prazoPagamento)
            : undefined,
          permitePix: Boolean((raw.pagamento as { permitePix?: boolean }).permitePix ?? true),
          permiteCartao: Boolean((raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true),
          descontoPixPercent: Number(
            (raw.pagamento as { descontoPixPercent?: number }).descontoPixPercent ?? 0
          ),
          descontoCartaoPercent: Number(
            (raw.pagamento as { descontoCartaoPercent?: number }).descontoCartaoPercent ?? 0
          ),
          descontoMultiCategoriaValor: Number(
            (raw.pagamento as { descontoMultiCategoriaValor?: number })
              .descontoMultiCategoriaValor ?? 0
          ),
        }
      : undefined,
  };
}

export async function criarTorneioCompleto(input: {
  clubeId: string;
  clubeNome: string;
  cidade: string;
  donoUid: string;
  nome: string;
  esporte: EsporteId;
  composicao?: ComposicaoId;
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
  local?: string;
  formatoChaves?: FormatoChavesId;
  definicaoChave?: DefinicaoChaveId;
  estruturaMata?: EstruturaMataId;
  gruposConfig?: GruposConfig;
  formatoPartidaId?: FormatoPartidaTorneioId;
  clubeLogoUrl?: string;
  logoUrl?: string;
  bannerUrl?: string;
  estruturaPreview?: string;
  horarioPadrao?: string;
  quadraNome?: string;
  categorias?: CategoriaTorneio[];
  resultadoSoOrganizador?: boolean;
  pagamento?: {
    ativo: boolean;
    valor: number;
    regras: string;
    prazoPagamento?: string;
    permitePix: boolean;
    permiteCartao: boolean;
    descontoPixPercent?: number;
    descontoCartaoPercent?: number;
    descontoMultiCategoriaValor?: number;
  };
}): Promise<string> {
  const categorias =
    input.categorias && input.categorias.length > 0
      ? input.categorias.map((c) => ({
          id: c.id || novaCategoriaId(),
          nome: c.nome.trim(),
          ...(c.composicao === 'dupla' || c.composicao === 'simples'
            ? { composicao: c.composicao }
            : {}),
        }))
      : [{ id: novaCategoriaId(), nome: 'Geral' }];

  const pagIn = input.pagamento;
  const pagamento = {
    ativo: Boolean(pagIn?.ativo),
    valor: Number(pagIn?.valor ?? 0),
    regras: String(pagIn?.regras ?? ''),
    prazoPagamento: String(pagIn?.prazoPagamento ?? ''),
    permitePix: pagIn?.permitePix !== false,
    permiteCartao: pagIn?.permiteCartao !== false,
    descontoPixPercent: Number(pagIn?.descontoPixPercent ?? 0),
    descontoCartaoPercent: Number(pagIn?.descontoCartaoPercent ?? 0),
    descontoMultiCategoriaValor: Number(pagIn?.descontoMultiCategoriaValor ?? 0),
  };

  const ref = await addDoc(collection(db, 'torneios'), {
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    cidade: input.cidade,
    donoUid: input.donoUid,
    nome: input.nome.trim(),
    esporte: input.esporte,
    composicao: input.composicao ?? composicaoPadraoPorEsporte(input.esporte),
    dataInicio: input.dataInicio ?? '',
    dataFim: input.dataFim ?? '',
    descricao: input.descricao?.trim() ?? '',
    local: input.local?.trim() ?? '',
    horarioPadrao: input.horarioPadrao?.trim() ?? '',
    quadraNome: input.quadraNome?.trim() ?? '',
    formatoChaves: input.formatoChaves ?? 'simples',
    definicaoChave: input.definicaoChave ?? 'sorteio',
    estruturaMata: input.estruturaMata ?? 16,
    gruposConfig: input.gruposConfig ?? null,
    formatoPartidaId: input.formatoPartidaId ?? 'melhor_de_3_stb',
    clubeLogoUrl: input.clubeLogoUrl ?? '',
    logoUrl: input.logoUrl ?? '',
    bannerUrl: input.bannerUrl ?? '',
    estruturaPreview: input.estruturaPreview ?? '',
    categorias,
    resultadoSoOrganizador: Boolean(input.resultadoSoOrganizador),
    status: 'aberto' as TorneioStatus,
    totalInscritos: 0,
    inscricoesEncerradas: false,
    pagamento,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarCategoriasTorneio(
  torneioId: string,
  categorias: CategoriaTorneio[]
): Promise<void> {
  const tSnap = await getDoc(doc(db, 'torneios', torneioId));
  if (!tSnap.exists()) throw new Error('Torneio não encontrado.');
  const t = tSnap.data();
  if (
    t.status !== 'aberto' ||
    t.chaveLiberada ||
    t.inscricoesEncerradas
  ) {
    throw new Error(
      'Não é possível alterar categorias depois que o torneio começou ou as inscrições foram encerradas.'
    );
  }
  const limpas = categorias
    .map((c) => ({
      id: (c.id || novaCategoriaId()).trim(),
      nome: c.nome.trim(),
      ...(c.composicao === 'dupla' || c.composicao === 'simples'
        ? { composicao: c.composicao }
        : {}),
    }))
    .filter((c) => c.nome.length > 0);
  if (limpas.length === 0) {
    throw new Error('Informe ao menos uma categoria.');
  }
  await updateDoc(doc(db, 'torneios', torneioId), { categorias: limpas });
}

/** Organizador encerra novas inscrições (chave ainda pode ser gerada depois). */
export async function encerrarInscricoesTorneio(torneioId: string): Promise<void> {
  await updateDoc(doc(db, 'torneios', torneioId), {
    inscricoesEncerradas: true,
    inscricoesEncerradasEm: serverTimestamp(),
  });

  try {
    const tSnap = await getDoc(doc(db, 'torneios', torneioId));
    const nome = String(tSnap.data()?.nome ?? 'Torneio');
    const insc = await getDocs(collection(db, 'torneios', torneioId, 'inscritos'));
    const uids = new Set<string>();
    insc.docs.forEach((d) => {
      const uid = String(d.data()?.uid ?? '');
      if (uid) uids.add(uid);
    });
    for (const uid of uids) {
      void criarNotificacao({
        paraUid: uid,
        tipo: 'sistema',
        titulo: 'Inscrições encerradas',
        corpo: `As inscrições de ${nome} foram encerradas.`,
        rota: `/torneio/${torneioId}`,
        refId: torneioId,
      }).catch((e) => console.warn('[torneio] notif inscricoes', e));
    }
  } catch (e) {
    console.warn('[torneio] encerrar inscricoes notif', e);
  }
}

/** Dono exclui o torneio e subcoleções (inscritos + confrontos). */
export async function excluirTorneio(
  torneioId: string,
  donoUid: string
): Promise<void> {
  if (!torneioId || !donoUid) throw new Error('Dados inválidos.');
  const tRef = doc(db, 'torneios', torneioId);
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) throw new Error('Torneio não encontrado.');
  if (String(tSnap.data()?.donoUid ?? '') !== donoUid) {
    throw new Error('Só o organizador pode excluir o torneio.');
  }

  async function apagarColecao(sub: string) {
    const snap = await getDocs(collection(db, 'torneios', torneioId, sub));
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await apagarColecao('confrontos');
  await apagarColecao('inscritos');
  await deleteDoc(tRef);
}

export async function atualizarAgendaTorneio(
  torneioId: string,
  data: { horarioPadrao?: string; quadraNome?: string; local?: string }
): Promise<void> {
  await updateDoc(doc(db, 'torneios', torneioId), {
    horarioPadrao: data.horarioPadrao?.trim() ?? '',
    quadraNome: data.quadraNome?.trim() ?? '',
    ...(data.local != null ? { local: data.local.trim() } : {}),
  });
}

/** Dono edita dados gerais do torneio (nome, datas, local, pagamento, chaves…). */
export async function atualizarDadosTorneio(
  torneioId: string,
  patch: {
    nome?: string;
    dataInicio?: string;
    dataFim?: string;
    descricao?: string;
    local?: string;
    horarioPadrao?: string;
    quadraNome?: string;
    resultadoSoOrganizador?: boolean;
    pagamento?: Torneio['pagamento'];
    composicao?: ComposicaoId;
    formatoPartidaId?: FormatoPartidaTorneioId;
    estruturaMata?: EstruturaMataId;
    definicaoChave?: DefinicaoChaveId;
    categorias?: CategoriaTorneio[];
  }
): Promise<void> {
  const tSnap = await getDoc(doc(db, 'torneios', torneioId));
  if (!tSnap.exists()) throw new Error('Torneio não encontrado.');

  const data: Record<string, unknown> = {};
  if (patch.nome != null) {
    const n = patch.nome.trim();
    if (!n) throw new Error('Informe o nome do torneio.');
    data.nome = n;
  }
  if (patch.dataInicio != null) data.dataInicio = patch.dataInicio.trim();
  if (patch.dataFim != null) data.dataFim = patch.dataFim.trim();
  if (patch.descricao != null) data.descricao = patch.descricao.trim();
  if (patch.local != null) data.local = patch.local.trim();
  if (patch.horarioPadrao != null) data.horarioPadrao = patch.horarioPadrao.trim();
  if (patch.quadraNome != null) data.quadraNome = patch.quadraNome.trim();
  if (patch.resultadoSoOrganizador != null) {
    data.resultadoSoOrganizador = Boolean(patch.resultadoSoOrganizador);
  }
  if (patch.pagamento != null) {
    const p = patch.pagamento;
    data.pagamento = {
      ativo: Boolean(p.ativo),
      valor: Number(p.valor ?? 0),
      regras: String(p.regras ?? ''),
      prazoPagamento: String(p.prazoPagamento ?? ''),
      permitePix: p.permitePix !== false,
      permiteCartao: p.permiteCartao !== false,
      descontoPixPercent: Number(p.descontoPixPercent ?? 0),
      descontoCartaoPercent: Number(p.descontoCartaoPercent ?? 0),
      descontoMultiCategoriaValor: Number(p.descontoMultiCategoriaValor ?? 0),
    };
  }
  if (patch.composicao != null) data.composicao = patch.composicao;
  if (patch.formatoPartidaId != null) data.formatoPartidaId = patch.formatoPartidaId;
  if (patch.estruturaMata != null) data.estruturaMata = patch.estruturaMata;
  if (patch.definicaoChave != null) data.definicaoChave = patch.definicaoChave;
  if (patch.categorias != null) {
    const cats = patch.categorias
      .map((c) => ({
        id: String(c.id ?? '').trim(),
        nome: String(c.nome ?? '').trim(),
        ...(c.composicao === 'dupla' || c.composicao === 'simples'
          ? { composicao: c.composicao }
          : {}),
      }))
      .filter((c) => c.id && c.nome);
    if (cats.length === 0) throw new Error('Informe ao menos uma categoria.');
    data.categorias = cats;
  }

  if (Object.keys(data).length === 0) return;
  await updateDoc(doc(db, 'torneios', torneioId), data);
}

export async function atualizarMidiaTorneio(
  torneioId: string,
  data: { logoUrl?: string; bannerUrl?: string; clubeLogoUrl?: string }
): Promise<void> {
  const patch: Record<string, string> = {};
  if (data.logoUrl != null) patch.logoUrl = data.logoUrl;
  if (data.bannerUrl != null) patch.bannerUrl = data.bannerUrl;
  if (data.clubeLogoUrl != null) patch.clubeLogoUrl = data.clubeLogoUrl;
  if (!Object.keys(patch).length) return;
  await updateDoc(doc(db, 'torneios', torneioId), patch);
}

export async function listarTorneiosPorEsporte(esporte: EsporteId): Promise<Torneio[]> {
  const snap = await getDocs(
    query(collection(db, 'torneios'), where('esporte', '==', esporte))
  );
  return snap.docs
    .map((d) => mapTorneio(d.id, d.data()))
    .sort((a, b) => (a.dataInicio ?? '').localeCompare(b.dataInicio ?? ''));
}

export async function listarTorneiosDoClube(clubeId: string): Promise<Torneio[]> {
  const snap = await getDocs(
    query(collection(db, 'torneios'), where('clubeId', '==', clubeId))
  );
  return snap.docs.map((d) => mapTorneio(d.id, d.data()));
}

/** Torneios criados pelo admin/professor (todos os clubes). */
export async function listarTorneiosDoDono(donoUid: string): Promise<Torneio[]> {
  const snap = await getDocs(
    query(collection(db, 'torneios'), where('donoUid', '==', donoUid))
  );
  return snap.docs
    .map((d) => mapTorneio(d.id, d.data()))
    .sort((a, b) => (b.dataInicio ?? '').localeCompare(a.dataInicio ?? ''));
}

export async function valorInscricaoComDescontoMultiCategoria(input: {
  torneioId: string;
  uid: string;
  valorBase: number;
  descontoMultiCategoriaValor?: number;
}): Promise<{ valor: number; descontoAplicado: number; jaTemOutraCategoria: boolean }> {
  const descontoCfg = Math.max(0, Number(input.descontoMultiCategoriaValor ?? 0));
  const snap = await getDocs(collection(db, 'torneios', input.torneioId, 'inscritos'));
  const outras = snap.docs.filter((d) => {
    const raw = d.data();
    const u = String(raw.uid ?? d.id.split('__')[0]);
    return u === input.uid;
  });
  const jaTemOutraCategoria = outras.length > 0;
  if (!jaTemOutraCategoria || descontoCfg <= 0) {
    return { valor: input.valorBase, descontoAplicado: 0, jaTemOutraCategoria };
  }
  const descontoAplicado = Math.min(descontoCfg, input.valorBase);
  return {
    valor: Math.max(0, input.valorBase - descontoAplicado),
    descontoAplicado,
    jaTemOutraCategoria: true,
  };
}

export async function inscreverTorneio(input: {
  torneioId: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
  telefone?: string;
  setmatchId?: string;
  categoriaId?: string;
  /** Obrigatório se torneio for em duplas */
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroBusca?: string;
}): Promise<{
  status: InscricaoStatus;
  pagamentoId?: string;
  conviteId?: string;
  categoriaId?: string;
  categoriaNome?: string;
  valorCobrando?: number;
  descontoMultiCategoriaAplicado?: number;
}> {
  const tRef = doc(db, 'torneios', input.torneioId);
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) throw new Error('Torneio não encontrado.');
  const tData = tSnap.data();
  if (tData.inscricoesEncerradas) {
    throw new Error('Inscrições encerradas pelo organizador.');
  }
  const statusAtual = String(tData.status ?? 'aberto');
  if (statusAtual === 'finalizado') {
    throw new Error('Torneio encerrado — inscrições fechadas.');
  }
  if (statusAtual !== 'aberto' && statusAtual !== 'em_andamento') {
    throw new Error('Inscrições fechadas.');
  }

  const categorias = mapCategorias(tData.categorias);
  let categoriaId = input.categoriaId?.trim() || '';
  let categoriaNome = '';
  let catSel: CategoriaTorneio | undefined;
  if (categorias.length > 0) {
    if (!categoriaId) {
      throw new Error('Escolha a categoria para se inscrever.');
    }
    catSel = categorias.find((c) => c.id === categoriaId);
    if (!catSel) throw new Error('Categoria inválida.');
    categoriaNome = catSel.nome;
  } else if (categoriaId) {
    categoriaNome = categoriaId;
  }

  // Chave já liberada nesta categoria → não aceita mais inscritos nela
  const confrontosSnap = await getDocs(
    collection(db, 'torneios', input.torneioId, 'confrontos')
  );
  const catJaTemChave = confrontosSnap.docs.some((d) => {
    const cid = String(d.data()?.categoriaId ?? '');
    if (categoriaId) return cid === categoriaId;
    return !cid;
  });
  if (catJaTemChave) {
    throw new Error(
      'Inscrições desta categoria estão fechadas — a chave já foi liberada.'
    );
  }

  const composicao =
    catSel?.composicao ??
    (tData.composicao as ComposicaoId) ??
    composicaoPadraoPorEsporte((tData.esporte as EsporteId) ?? 'tenis');
  const pag = tData.pagamento as
    | {
        ativo?: boolean;
        valor?: number;
        ciclo?: string;
        descontoMultiCategoriaValor?: number;
      }
    | undefined;
  const precisaPagar = Boolean(pag?.ativo && (pag.valor ?? 0) > 0);
  const valorBase = Number(pag?.valor ?? 0);

  const docId = inscricaoTorneioDocId(input.uid, categoriaId || undefined);
  const ref = doc(db, 'torneios', input.torneioId, 'inscritos', docId);
  const ja = await getDoc(ref);
  if (ja.exists()) throw new Error('Você já está inscrito nesta categoria.');

  // Legado: doc id = uid sem categoria
  if (categoriaId) {
    const legado = await getDoc(doc(db, 'torneios', input.torneioId, 'inscritos', input.uid));
    if (legado.exists() && !legado.data()?.categoriaId) {
      throw new Error('Você já está inscrito neste torneio.');
    }
  }

  const cobranca = precisaPagar
    ? await valorInscricaoComDescontoMultiCategoria({
        torneioId: input.torneioId,
        uid: input.uid,
        valorBase,
        descontoMultiCategoriaValor: pag?.descontoMultiCategoriaValor,
      })
    : { valor: 0, descontoAplicado: 0, jaTemOutraCategoria: false };

  const baseInsc = {
    uid: input.uid,
    nome: input.nome,
    fotoUrl: input.fotoUrl ?? '',
    telefone: input.telefone ?? '',
    categoriaId: categoriaId || '',
    categoriaNome: categoriaNome || '',
  };

  if (composicao === 'dupla') {
    if (!input.parceiroUid || !input.parceiroNome) {
      throw new Error('Informe a dupla (e-mail ou ID Rally Up).');
    }
    const conviteId = await criarConviteDupla({
      contexto: 'torneio',
      refId: input.torneioId,
      refNome: String(tData.nome ?? 'Torneio'),
      clubeId: String(tData.clubeId ?? ''),
      clubeNome: String(tData.clubeNome ?? ''),
      donoUid: String(tData.donoUid ?? ''),
      deUid: input.uid,
      deNome: input.nome,
      paraUid: input.parceiroUid,
      paraNome: input.parceiroNome,
      busca: input.parceiroBusca ?? '',
      categoriaId: categoriaId || undefined,
      inscricaoId: docId,
    });

    await setDoc(ref, {
      ...baseInsc,
      status: 'aguardando_parceiro' as InscricaoStatus,
      pago: false,
      parceiroUid: input.parceiroUid,
      parceiroNome: input.parceiroNome,
      parceiroAceito: false,
      parceiroPago: false,
      conviteId,
      criadoEm: serverTimestamp(),
    });
    return {
      status: 'aguardando_parceiro',
      conviteId,
      categoriaId: categoriaId || undefined,
      categoriaNome: categoriaNome || undefined,
    };
  }

  // Simples
  if (precisaPagar) {
    const valorFinal = cobranca.valor;
    const gratisPorDesconto = valorFinal <= 0;
    if (gratisPorDesconto) {
      await setDoc(ref, {
        ...baseInsc,
        status: 'confirmado' as InscricaoStatus,
        pago: true,
        contabilizado: true,
        valorPago: 0,
        descontoMultiCategoria: cobranca.descontoAplicado,
        criadoEm: serverTimestamp(),
      });
      await updateDoc(tRef, { totalInscritos: increment(1) });
      return {
        status: 'confirmado',
        categoriaId: categoriaId || undefined,
        categoriaNome: categoriaNome || undefined,
        valorCobrando: 0,
        descontoMultiCategoriaAplicado: cobranca.descontoAplicado,
      };
    }

    await setDoc(ref, {
      ...baseInsc,
      status: 'aguardando_pagamento' as InscricaoStatus,
      pago: false,
      valorCobrado: valorFinal,
      descontoMultiCategoria: cobranca.descontoAplicado,
      criadoEm: serverTimestamp(),
    });
    const pagamentoId = await criarRegistroPagamento({
      uid: input.uid,
      setmatchId: input.setmatchId || '',
      nome: input.nome,
      telefone: input.telefone,
      tipo: 'torneio',
      clubeId: String(tData.clubeId ?? ''),
      clubeNome: String(tData.clubeNome ?? ''),
      donoUid: String(tData.donoUid ?? ''),
      torneioId: input.torneioId,
      torneioNome: String(tData.nome ?? ''),
      valor: valorFinal,
      ciclo: 'unico',
      status: 'aguardando_pagamento',
    });
    void criarNotificacao({
      paraUid: input.uid,
      tipo: 'pagamento',
      titulo: 'Pagamento da inscrição',
      corpo: `Pague R$ ${valorFinal.toFixed(2)} para confirmar sua vaga em ${String(
        tData.nome ?? 'torneio'
      )}${categoriaNome ? ` (${categoriaNome})` : ''}${
        cobranca.descontoAplicado > 0
          ? ` — desconto 2ª categoria −R$ ${cobranca.descontoAplicado.toFixed(2)}`
          : ''
      }.`,
      rota: '/pagamentos',
      refId: pagamentoId,
    }).catch(() => undefined);
    return {
      status: 'aguardando_pagamento',
      pagamentoId,
      categoriaId: categoriaId || undefined,
      categoriaNome: categoriaNome || undefined,
      valorCobrando: valorFinal,
      descontoMultiCategoriaAplicado: cobranca.descontoAplicado,
    };
  }

  await setDoc(ref, {
    ...baseInsc,
    status: 'confirmado' as InscricaoStatus,
    pago: true,
    contabilizado: true,
    criadoEm: serverTimestamp(),
  });
  await updateDoc(tRef, { totalInscritos: increment(1) });
  return {
    status: 'confirmado',
    categoriaId: categoriaId || undefined,
    categoriaNome: categoriaNome || undefined,
  };
}

/**
 * Organizador cadastra jogador (e parceiro, se dupla) já confirmado.
 * Dispara notificação in-app + push no celular do inscrito.
 */
export async function inscreverTorneioPorOrganizador(input: {
  torneioId: string;
  organizadorUid: string;
  buscaJogador: string;
  categoriaId?: string;
  /** Obrigatório se a categoria/torneio for em duplas */
  buscaParceiro?: string;
}): Promise<{
  uid: string;
  nome: string;
  parceiroUid?: string;
  parceiroNome?: string;
  categoriaNome?: string;
}> {
  if (!input.torneioId || !input.organizadorUid) {
    throw new Error('Dados inválidos.');
  }

  const tRef = doc(db, 'torneios', input.torneioId);
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) throw new Error('Torneio não encontrado.');
  const tData = tSnap.data();
  if (String(tData.donoUid ?? '') !== input.organizadorUid) {
    throw new Error('Só o organizador pode cadastrar inscritos.');
  }
  if (String(tData.status ?? '') === 'finalizado') {
    throw new Error('Torneio encerrado — não dá para cadastrar.');
  }

  const categorias = mapCategorias(tData.categorias);
  let categoriaId = input.categoriaId?.trim() || '';
  let categoriaNome = '';
  let catSel: CategoriaTorneio | undefined;
  if (categorias.length > 0) {
    if (!categoriaId) throw new Error('Escolha a categoria.');
    catSel = categorias.find((c) => c.id === categoriaId);
    if (!catSel) throw new Error('Categoria inválida.');
    categoriaNome = catSel.nome;
  }

  const confrontosSnap = await getDocs(
    collection(db, 'torneios', input.torneioId, 'confrontos')
  );
  const catJaTemChave = confrontosSnap.docs.some((d) => {
    const cid = String(d.data()?.categoriaId ?? '');
    if (categoriaId) return cid === categoriaId;
    return !cid;
  });
  if (catJaTemChave) {
    throw new Error(
      'Não dá para cadastrar — a chave desta categoria já foi liberada.'
    );
  }

  const { buscarUsuarioPorEmailOuId } = await import('./duplas');
  const jogador = await buscarUsuarioPorEmailOuId(input.buscaJogador);
  if (!jogador) {
    throw new Error('Jogador não encontrado. Use e-mail ou ID (SM-…).');
  }

  const composicao =
    catSel?.composicao ??
    (tData.composicao as ComposicaoId) ??
    composicaoPadraoPorEsporte((tData.esporte as EsporteId) ?? 'tenis');

  let parceiroUid: string | undefined;
  let parceiroNome: string | undefined;
  let parceiroFoto: string | undefined;
  if (composicao === 'dupla') {
    if (!input.buscaParceiro?.trim()) {
      throw new Error('Informe o parceiro da dupla (e-mail ou ID).');
    }
    const parceiro = await buscarUsuarioPorEmailOuId(input.buscaParceiro);
    if (!parceiro) {
      throw new Error('Parceiro não encontrado. Use e-mail ou ID (SM-…).');
    }
    if (parceiro.uid === jogador.uid) {
      throw new Error('Jogador e parceiro precisam ser pessoas diferentes.');
    }
    parceiroUid = parceiro.uid;
    parceiroNome = parceiro.nome;
    parceiroFoto = parceiro.fotoUrl;
  }

  const docId = inscricaoTorneioDocId(jogador.uid, categoriaId || undefined);
  const ref = doc(db, 'torneios', input.torneioId, 'inscritos', docId);
  if ((await getDoc(ref)).exists()) {
    throw new Error('Este jogador já está inscrito nesta categoria.');
  }
  if (categoriaId) {
    const legado = await getDoc(
      doc(db, 'torneios', input.torneioId, 'inscritos', jogador.uid)
    );
    if (legado.exists() && !legado.data()?.categoriaId) {
      throw new Error('Este jogador já está inscrito neste torneio.');
    }
  }

  const torneioNome = String(tData.nome ?? 'Torneio');
  const baseInsc: Record<string, unknown> = {
    uid: jogador.uid,
    nome: jogador.nome,
    fotoUrl: jogador.fotoUrl ?? '',
    telefone: jogador.telefone ?? '',
    categoriaId: categoriaId || '',
    categoriaNome: categoriaNome || '',
    status: 'confirmado' as InscricaoStatus,
    pago: true,
    contabilizado: true,
    inscritoPorOrganizador: true,
    inscritoPorUid: input.organizadorUid,
    criadoEm: serverTimestamp(),
    confirmadoEm: serverTimestamp(),
  };

  if (composicao === 'dupla' && parceiroUid && parceiroNome) {
    baseInsc.parceiroUid = parceiroUid;
    baseInsc.parceiroNome = parceiroNome;
    baseInsc.parceiroFoto = parceiroFoto ?? '';
    baseInsc.parceiroAceito = true;
    baseInsc.parceiroPago = true;
  }

  await setDoc(ref, baseInsc);
  await updateDoc(tRef, { totalInscritos: increment(1) });

  const catTxt = categoriaNome ? ` · ${categoriaNome}` : '';
  const duplaTxt =
    parceiroNome ? ` em dupla com ${parceiroNome}` : '';
  const corpo = `O organizador te inscreveu em ${torneioNome}${catTxt}${duplaTxt}.`;

  void criarNotificacao({
    paraUid: jogador.uid,
    tipo: 'chave_torneio',
    titulo: 'Inscrição no torneio',
    corpo,
    rota: `/torneio/${input.torneioId}`,
    refId: input.torneioId,
  }).catch((e) => console.warn('[torneio] notif insc org', e));

  if (parceiroUid) {
    void criarNotificacao({
      paraUid: parceiroUid,
      tipo: 'chave_torneio',
      titulo: 'Inscrição no torneio',
      corpo: `O organizador te inscreveu em ${torneioNome}${catTxt} em dupla com ${jogador.nome}.`,
      rota: `/torneio/${input.torneioId}`,
      refId: input.torneioId,
    }).catch((e) => console.warn('[torneio] notif insc org parceiro', e));
  }

  return {
    uid: jogador.uid,
    nome: jogador.nome,
    parceiroUid,
    parceiroNome,
    categoriaNome: categoriaNome || undefined,
  };
}

export async function jaInscrito(torneioId: string, uid: string): Promise<boolean> {
  const ids = await idsInscricoesDoUsuario(torneioId, uid);
  return ids.length > 0;
}

export async function jaInscritoNaCategoria(
  torneioId: string,
  uid: string,
  categoriaId: string
): Promise<boolean> {
  const snap = await getDoc(
    doc(db, 'torneios', torneioId, 'inscritos', inscricaoTorneioDocId(uid, categoriaId))
  );
  if (snap.exists()) return true;
  // legado sem categoria
  const legado = await getDoc(doc(db, 'torneios', torneioId, 'inscritos', uid));
  if (!legado.exists()) return false;
  const cat = String(legado.data()?.categoriaId ?? '');
  return !cat || cat === categoriaId;
}

export async function idsInscricoesDoUsuario(
  torneioId: string,
  uid: string
): Promise<string[]> {
  const snap = await getDocs(collection(db, 'torneios', torneioId, 'inscritos'));
  return snap.docs
    .filter((d) => String(d.data().uid ?? d.id) === uid || d.id === uid || d.id.startsWith(`${uid}__`))
    .map((d) => d.id);
}

export function ouvirInscritosTorneio(
  torneioId: string,
  onData: (lista: InscricaoTorneio[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'torneios', torneioId, 'inscritos'), (snap) => {
    const list = snap.docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        uid: String(raw.uid ?? d.id.split('__')[0]),
        nome: String(raw.nome ?? 'Jogador'),
        fotoUrl: raw.fotoUrl ? String(raw.fotoUrl) : undefined,
        telefone: raw.telefone ? String(raw.telefone) : undefined,
        categoriaId: raw.categoriaId ? String(raw.categoriaId) : undefined,
        categoriaNome: raw.categoriaNome ? String(raw.categoriaNome) : undefined,
        status: (raw.status as InscricaoStatus) || 'confirmado',
        pago: Boolean(raw.pago),
        parceiroUid: raw.parceiroUid ? String(raw.parceiroUid) : undefined,
        parceiroNome: raw.parceiroNome ? String(raw.parceiroNome) : undefined,
        parceiroAceito: Boolean(raw.parceiroAceito),
        parceiroPago: Boolean(raw.parceiroPago),
      };
    });
    list.sort((a, b) => {
      const ca = (a.categoriaNome || '').localeCompare(b.categoriaNome || '', 'pt-BR');
      if (ca !== 0) return ca;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
    onData(list);
  });
}

/** Interesse em aulas no clube — admin recebe e explica pagamento fora do app. */
export async function registrarInteresseAulas(input: {
  uid: string;
  nome: string;
  telefone?: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  esporte: EsporteId;
  mensagem?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'interessesAulas'), {
    ...input,
    telefone: input.telefone ?? '',
    mensagem: input.mensagem ?? 'Tenho interesse em começar aulas neste clube.',
    status: 'pendente',
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}
