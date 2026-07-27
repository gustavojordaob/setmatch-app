import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

export interface ClubeCompleto {
  id: string;
  nome: string;
  cidade: string;
  bairro?: string;
  estado?: string;
  cep?: string;
  endereco?: string;
  telefone?: string;
  descricao?: string;
  esportes: EsporteId[];
  donoUid: string;
  donoNome: string;
  regrasGerais?: string;
  aulas?: {
    ativo: boolean;
    valorMensal: number;
    regras: string;
    permitePix: boolean;
    permiteCartao: boolean;
  };
  criadoEm?: { seconds: number };
}

export interface Torneio {
  id: string;
  clubeId: string;
  nome: string;
  esporte: EsporteId;
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
  status: 'aberto' | 'em_andamento' | 'finalizado';
}

interface CriarClubeInput {
  nome: string;
  cidade: string;
  bairro?: string;
  estado?: string;
  cep?: string;
  endereco?: string;
  telefone?: string;
  descricao?: string;
  esportes: EsporteId[];
  donoUid: string;
  donoNome: string;
}

export async function criarClube(input: CriarClubeInput): Promise<string> {
  const ref = await addDoc(collection(db, 'clubes'), {
    nome: input.nome.trim(),
    cidade: input.cidade.trim(),
    bairro: input.bairro?.trim() ?? '',
    estado: input.estado?.trim().toUpperCase() ?? '',
    cep: input.cep?.trim() ?? '',
    endereco: input.endereco?.trim() ?? '',
    telefone: input.telefone?.trim() ?? '',
    descricao: input.descricao?.trim() ?? '',
    esportes: input.esportes,
    esporte: input.esportes[0] ?? 'tenis',
    donoUid: input.donoUid,
    donoNome: input.donoNome,
    criadoEm: serverTimestamp(),
  });

  await updateDoc(doc(db, 'usuarios', input.donoUid), {
    clubeId: ref.id,
    role: 'admin_clube',
  });

  return ref.id;
}

export async function atualizarClube(
  clubeId: string,
  data: Partial<Omit<ClubeCompleto, 'id' | 'donoUid' | 'donoNome' | 'criadoEm'>>
): Promise<void> {
  await updateDoc(doc(db, 'clubes', clubeId), data);
}

export async function criarRankingNoClube(input: {
  clubeId: string;
  clubeNome: string;
  cidade: string;
  esporte: EsporteId;
  nome: string;
  donoUid: string;
  donoNome: string;
  donoFotoUrl?: string;
  pagamento?: {
    ativo: boolean;
    valor: number;
    ciclo: 'unico' | 'mensal';
    regras: string;
    exigeParaEntrar: boolean;
    permitePix: boolean;
    permiteCartao: boolean;
  };
}): Promise<string> {
  const rankingRef = await addDoc(collection(db, 'rankings'), {
    nome: input.nome.trim(),
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    cidade: input.cidade,
    esporte: input.esporte,
    donoUid: input.donoUid,
    membros: [input.donoUid],
    totalMembros: 1,
    pagamento: input.pagamento ?? {
      ativo: false,
      valor: 0,
      ciclo: 'mensal',
      regras: '',
      exigeParaEntrar: false,
      permitePix: true,
      permiteCartao: true,
    },
    criadoEm: serverTimestamp(),
  });

  await setDoc(doc(db, 'rankings', rankingRef.id, 'classificacao', input.donoUid), {
    uid: input.donoUid,
    nome: input.donoNome,
    fotoUrl: input.donoFotoUrl ?? '',
    pts: 0,
    vitorias: 0,
    derrotas: 0,
    pagamentoOk: true,
  });

  return rankingRef.id;
}

export async function criarTorneio(input: {
  clubeId: string;
  nome: string;
  esporte: EsporteId;
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'torneios'), {
    clubeId: input.clubeId,
    nome: input.nome.trim(),
    esporte: input.esporte,
    dataInicio: input.dataInicio ?? '',
    dataFim: input.dataFim ?? '',
    descricao: input.descricao?.trim() ?? '',
    status: 'aberto',
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function listarClubesDoDono(donoUid: string): Promise<ClubeCompleto[]> {
  const snap = await getDocs(query(collection(db, 'clubes'), where('donoUid', '==', donoUid)));
  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      nome: String(raw.nome ?? ''),
      cidade: String(raw.cidade ?? ''),
      bairro: String(raw.bairro ?? ''),
      estado: String(raw.estado ?? ''),
      cep: String(raw.cep ?? ''),
      endereco: String(raw.endereco ?? ''),
      telefone: String(raw.telefone ?? ''),
      descricao: String(raw.descricao ?? ''),
      esportes: (raw.esportes as EsporteId[]) ?? [raw.esporte as EsporteId].filter(Boolean),
      donoUid: String(raw.donoUid ?? ''),
      donoNome: String(raw.donoNome ?? ''),
      regrasGerais: raw.regrasGerais ? String(raw.regrasGerais) : '',
      aulas: raw.aulas
        ? {
            ativo: Boolean((raw.aulas as { ativo?: boolean }).ativo),
            valorMensal: Number((raw.aulas as { valorMensal?: number }).valorMensal ?? 0),
            regras: String((raw.aulas as { regras?: string }).regras ?? ''),
            permitePix: Boolean((raw.aulas as { permitePix?: boolean }).permitePix ?? true),
            permiteCartao: Boolean((raw.aulas as { permiteCartao?: boolean }).permiteCartao ?? true),
          }
        : undefined,
    };
  });
}
