import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

export type TipoModalidadeAula =
  | 'individual'
  | 'duo'
  | 'trio'
  | 'quarteto'
  | 'spozinho'
  | 'beach'
  | 'outro';

export const TIPOS_MODALIDADE_AULA: { id: TipoModalidadeAula; label: string }[] = [
  { id: 'individual', label: 'Individual' },
  { id: 'duo', label: 'Dupla / 2 pessoas' },
  { id: 'trio', label: 'Trio / 3 pessoas' },
  { id: 'quarteto', label: 'Quatro pessoas' },
  { id: 'spozinho', label: 'Spozinho' },
  { id: 'beach', label: 'Beach' },
  { id: 'outro', label: 'Outro' },
];

export type ModalidadeAula = {
  id: string;
  nome: string;
  tipo: TipoModalidadeAula;
  esporte: EsporteId;
  valorMensal: number;
  ativo: boolean;
  descricao?: string;
};

export async function listarModalidadesAula(clubeId: string): Promise<ModalidadeAula[]> {
  const snap = await getDocs(collection(db, 'clubes', clubeId, 'modalidadesAula'));
  const list = snap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      nome: String(raw.nome ?? ''),
      tipo: (raw.tipo as TipoModalidadeAula) ?? 'individual',
      esporte: (raw.esporte as EsporteId) ?? 'tenis',
      valorMensal: Number(raw.valorMensal ?? 0),
      ativo: Boolean(raw.ativo ?? true),
      descricao: raw.descricao ? String(raw.descricao) : undefined,
    };
  });
  return list.sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function criarModalidadeAula(
  clubeId: string,
  data: Omit<ModalidadeAula, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'clubes', clubeId, 'modalidadesAula'), {
    ...data,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function atualizarModalidadeAula(
  clubeId: string,
  id: string,
  patch: Partial<Omit<ModalidadeAula, 'id'>>
): Promise<void> {
  await updateDoc(doc(db, 'clubes', clubeId, 'modalidadesAula', id), {
    ...patch,
    atualizadoEm: serverTimestamp(),
  });
}

export async function excluirModalidadeAula(clubeId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'clubes', clubeId, 'modalidadesAula', id));
}

export function calcValorComDesconto(valorBase: number, descontoPercent: number): number {
  const d = Math.min(100, Math.max(0, descontoPercent));
  return Math.round(valorBase * (1 - d / 100) * 100) / 100;
}
