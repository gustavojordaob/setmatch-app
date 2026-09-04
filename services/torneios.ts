import {
  addDoc,
  collection,
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
  /** true quando o admin sorteou/liberou a chave para todos verem */
  chaveLiberada?: boolean;
  /** Horário padrão / referência (organizador). Jogador não reserva. */
  horarioPadrao?: string;
  /** Quadra opcional do evento (organizador). */
  quadraNome?: string;
  pagamento?: {
    ativo: boolean;
    valor: number;
    regras: string;
    prazoPagamento?: string;
    permitePix: boolean;
    permiteCartao: boolean;
    descontoPixPercent?: number;
    descontoCartaoPercent?: number;
  };
}

export interface InscricaoTorneio {
  uid: string;
  nome: string;
  fotoUrl?: string;
  telefone?: string;
  status?: InscricaoStatus;
  pago?: boolean;
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroAceito?: boolean;
  parceiroPago?: boolean;
  criadoEm?: { seconds: number };
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
    chaveLiberada: Boolean(raw.chaveLiberada),
    horarioPadrao: raw.horarioPadrao ? String(raw.horarioPadrao) : undefined,
    quadraNome: raw.quadraNome ? String(raw.quadraNome) : undefined,
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
  pagamento?: {
    ativo: boolean;
    valor: number;
    regras: string;
    prazoPagamento?: string;
    permitePix: boolean;
    permiteCartao: boolean;
    descontoPixPercent?: number;
    descontoCartaoPercent?: number;
  };
}): Promise<string> {
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
    status: 'aberto' as TorneioStatus,
    totalInscritos: 0,
    pagamento: input.pagamento ?? {
      ativo: false,
      valor: 0,
      regras: '',
      prazoPagamento: '',
      permitePix: true,
      permiteCartao: true,
      descontoPixPercent: 0,
      descontoCartaoPercent: 0,
    },
    criadoEm: serverTimestamp(),
  });
  return ref.id;
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

export async function inscreverTorneio(input: {
  torneioId: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
  telefone?: string;
  setmatchId?: string;
  /** Obrigatório se torneio for em duplas */
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroBusca?: string;
}): Promise<{
  status: InscricaoStatus;
  pagamentoId?: string;
  conviteId?: string;
}> {
  const tRef = doc(db, 'torneios', input.torneioId);
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) throw new Error('Torneio não encontrado.');
  const tData = tSnap.data();
  if (String(tData.status ?? 'aberto') !== 'aberto') {
    throw new Error('Inscrições fechadas.');
  }

  const composicao =
    (tData.composicao as ComposicaoId) ??
    composicaoPadraoPorEsporte((tData.esporte as EsporteId) ?? 'tenis');
  const pag = tData.pagamento as
    | { ativo?: boolean; valor?: number; ciclo?: string }
    | undefined;
  const precisaPagar = Boolean(pag?.ativo && (pag.valor ?? 0) > 0);

  const ref = doc(db, 'torneios', input.torneioId, 'inscritos', input.uid);
  const ja = await getDoc(ref);
  if (ja.exists()) throw new Error('Você já está inscrito neste torneio.');

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
    });

    await setDoc(ref, {
      uid: input.uid,
      nome: input.nome,
      fotoUrl: input.fotoUrl ?? '',
      telefone: input.telefone ?? '',
      status: 'aguardando_parceiro' as InscricaoStatus,
      pago: false,
      parceiroUid: input.parceiroUid,
      parceiroNome: input.parceiroNome,
      parceiroAceito: false,
      parceiroPago: false,
      conviteId,
      criadoEm: serverTimestamp(),
    });
    return { status: 'aguardando_parceiro', conviteId };
  }

  // Simples
  if (precisaPagar) {
    await setDoc(ref, {
      uid: input.uid,
      nome: input.nome,
      fotoUrl: input.fotoUrl ?? '',
      telefone: input.telefone ?? '',
      status: 'aguardando_pagamento' as InscricaoStatus,
      pago: false,
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
      valor: Number(pag!.valor),
      ciclo: 'unico',
      status: 'aguardando_pagamento',
    });
    void criarNotificacao({
      paraUid: input.uid,
      tipo: 'pagamento',
      titulo: 'Pagamento da inscrição',
      corpo: `Pague para confirmar sua vaga em ${String(tData.nome ?? 'torneio')}.`,
      rota: '/pagamentos',
      refId: pagamentoId,
    }).catch(() => undefined);
    return { status: 'aguardando_pagamento', pagamentoId };
  }

  await setDoc(ref, {
    uid: input.uid,
    nome: input.nome,
    fotoUrl: input.fotoUrl ?? '',
    telefone: input.telefone ?? '',
    status: 'confirmado' as InscricaoStatus,
    pago: true,
    contabilizado: true,
    criadoEm: serverTimestamp(),
  });
  await updateDoc(tRef, { totalInscritos: increment(1) });
  return { status: 'confirmado' };
}

export async function jaInscrito(torneioId: string, uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'torneios', torneioId, 'inscritos', uid));
  return snap.exists();
}

export function ouvirInscritosTorneio(
  torneioId: string,
  onData: (lista: InscricaoTorneio[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'torneios', torneioId, 'inscritos'), (snap) => {
    const list = snap.docs.map((d) => {
      const raw = d.data();
      return {
        uid: String(raw.uid ?? d.id),
        nome: String(raw.nome ?? 'Jogador'),
        fotoUrl: raw.fotoUrl ? String(raw.fotoUrl) : undefined,
        telefone: raw.telefone ? String(raw.telefone) : undefined,
        status: (raw.status as InscricaoStatus) || 'confirmado',
        pago: Boolean(raw.pago),
        parceiroUid: raw.parceiroUid ? String(raw.parceiroUid) : undefined,
        parceiroNome: raw.parceiroNome ? String(raw.parceiroNome) : undefined,
        parceiroAceito: Boolean(raw.parceiroAceito),
        parceiroPago: Boolean(raw.parceiroPago),
      };
    });
    list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
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
