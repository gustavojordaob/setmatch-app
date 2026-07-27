import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

import type { EsporteId } from '../constants/esportes';

interface CriarPostInput {
  autorUid: string;
  autorNome: string;
  autorFoto?: string;
  texto: string;
  esporte?: EsporteId;
  clubeId?: string;
  tipo?: 'texto' | 'resultado' | 'convite';
  partidaId?: string;
}

export async function criarPost(input: CriarPostInput): Promise<void> {
  const texto = input.texto.trim();
  if (!texto) return;
  await addDoc(collection(db, 'posts'), {
    autorUid: input.autorUid,
    autorNome: input.autorNome,
    autorFoto: input.autorFoto ?? '',
    texto,
    esporte: input.esporte ?? 'tenis',
    clubeId: input.clubeId ?? '',
    tipo: input.tipo ?? 'texto',
    partidaId: input.partidaId ?? '',
    curtidas: 0,
    curtidoPor: [],
    criadoEm: serverTimestamp(),
  });
}

/** Alterna curtida do usuário no post. */
export async function alternarCurtida(
  postId: string,
  uid: string,
  curtidoAgora: boolean
): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    curtidas: increment(curtidoAgora ? 1 : -1),
    curtidoPor: curtidoAgora ? arrayUnion(uid) : arrayRemove(uid),
  });
}
