import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

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
  pagamento?: {
    ativo: boolean;
    valor: number;
    regras: string;
    prazoPagamento?: string;
    permitePix: boolean;
    permiteCartao: boolean;
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
  pagamento?: {
    ativo: boolean;
    valor: number;
    regras: string;
    prazoPagamento?: string;
    permitePix: boolean;
    permiteCartao: boolean;
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
    status: 'aberto' as TorneioStatus,
    totalInscritos: 0,
    pagamento: input.pagamento ?? {
      ativo: false,
      valor: 0,
      regras: '',
      prazoPagamento: '',
      permitePix: true,
      permiteCartao: true,
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

export async function inscreverTorneio(input: {
  torneioId: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
  telefone?: string;
}): Promise<void> {
  const ref = doc(db, 'torneios', input.torneioId, 'inscritos', input.uid);
  await setDoc(ref, {
    uid: input.uid,
    nome: input.nome,
    fotoUrl: input.fotoUrl ?? '',
    telefone: input.telefone ?? '',
    criadoEm: serverTimestamp(),
  });
}

export async function jaInscrito(torneioId: string, uid: string): Promise<boolean> {
  const snap = await getDocs(
    query(collection(db, 'torneios', torneioId, 'inscritos'), where('uid', '==', uid))
  );
  return !snap.empty;
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
