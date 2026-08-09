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
import type {
  DefinicaoChaveId,
  EstruturaMataId,
  FormatoChavesId,
  FormatoPartidaTorneioId,
  GruposConfig,
} from '../constants/chaveamentosTorneio';

export type TorneioStatus = 'aberto' | 'em_andamento' | 'finalizado';

export interface Torneio {
  id: string;
  clubeId: string;
  clubeNome: string;
  cidade: string;
  nome: string;
  esporte: EsporteId;
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
  bannerUrl?: string;
  estruturaPreview?: string;
  campeaoUid?: string;
  campeaoNome?: string;
  /** true quando o admin sorteou/liberou a chave para todos verem */
  chaveLiberada?: boolean;
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
    estruturaPreview: raw.estruturaPreview ? String(raw.estruturaPreview) : undefined,
    campeaoUid: raw.campeaoUid ? String(raw.campeaoUid) : undefined,
    campeaoNome: raw.campeaoNome ? String(raw.campeaoNome) : undefined,
    chaveLiberada: Boolean(raw.chaveLiberada),
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
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
  local?: string;
  formatoChaves?: FormatoChavesId;
  definicaoChave?: DefinicaoChaveId;
  estruturaMata?: EstruturaMataId;
  gruposConfig?: GruposConfig;
  formatoPartidaId?: FormatoPartidaTorneioId;
  bannerUrl?: string;
  estruturaPreview?: string;
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
    dataInicio: input.dataInicio ?? '',
    dataFim: input.dataFim ?? '',
    descricao: input.descricao?.trim() ?? '',
    local: input.local?.trim() ?? '',
    formatoChaves: input.formatoChaves ?? 'simples',
    definicaoChave: input.definicaoChave ?? 'sorteio',
    estruturaMata: input.estruturaMata ?? 16,
    gruposConfig: input.gruposConfig ?? null,
    formatoPartidaId: input.formatoPartidaId ?? 'melhor_de_3_stb',
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
}): Promise<void> {
  const tRef = doc(db, 'torneios', input.torneioId);
  const tSnap = await getDoc(tRef);
  if (!tSnap.exists()) throw new Error('Torneio não encontrado.');
  if (String(tSnap.data().status ?? 'aberto') !== 'aberto') {
    throw new Error('Inscrições fechadas.');
  }

  const ref = doc(db, 'torneios', input.torneioId, 'inscritos', input.uid);
  const ja = await getDoc(ref);
  if (ja.exists()) throw new Error('Você já está inscrito neste torneio.');

  await setDoc(ref, {
    uid: input.uid,
    nome: input.nome,
    fotoUrl: input.fotoUrl ?? '',
    telefone: input.telefone ?? '',
    criadoEm: serverTimestamp(),
  });
  await updateDoc(tRef, {
    totalInscritos: increment(1),
  });
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
