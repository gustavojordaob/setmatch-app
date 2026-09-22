import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

export type AmizadeStatus = 'pendente' | 'aceito' | 'recusado';

export interface Amizade {
  id: string;
  deUid: string;
  deNome: string;
  deFoto?: string;
  paraUid: string;
  paraNome: string;
  paraFoto?: string;
  status: AmizadeStatus;
  criadoEm?: { seconds: number };
}

export async function solicitarAmizade(input: {
  deUid: string;
  deNome: string;
  deFoto?: string;
  paraUid: string;
  paraNome: string;
  paraFoto?: string;
}): Promise<void> {
  if (input.deUid === input.paraUid) return;

  const existentes = await getDocs(
    query(collection(db, 'amizades'), where('deUid', '==', input.deUid), where('paraUid', '==', input.paraUid))
  );
  const invertidos = await getDocs(
    query(collection(db, 'amizades'), where('deUid', '==', input.paraUid), where('paraUid', '==', input.deUid))
  );
  const jaExiste = [...existentes.docs, ...invertidos.docs].some((d) => {
    const s = d.data().status;
    return s === 'pendente' || s === 'aceito';
  });
  if (jaExiste) return;

  await addDoc(collection(db, 'amizades'), {
    ...input,
    deFoto: input.deFoto ?? '',
    paraFoto: input.paraFoto ?? '',
    status: 'pendente',
    criadoEm: serverTimestamp(),
  });
}

export async function aceitarAmizade(id: string): Promise<void> {
  await updateDoc(doc(db, 'amizades', id), { status: 'aceito' });
}

export async function recusarAmizade(id: string): Promise<void> {
  await updateDoc(doc(db, 'amizades', id), { status: 'recusado' });
}
