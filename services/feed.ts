import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  arrayRemove,
  arrayUnion,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

interface CriarPostInput {
  autorUid: string;
  autorNome: string;
  autorFoto?: string;
  texto: string;
  imagemUrl?: string;
  esporte?: EsporteId;
  clubeId?: string;
  tipo?: 'texto' | 'resultado' | 'convite' | 'foto';
  partidaId?: string;
}

export async function criarPost(input: CriarPostInput): Promise<string> {
  const texto = input.texto.trim();
  if (!texto && !input.imagemUrl) return '';
  const ref = await addDoc(collection(db, 'posts'), {
    autorUid: input.autorUid,
    autorNome: input.autorNome,
    autorFoto: input.autorFoto ?? '',
    texto,
    imagemUrl: input.imagemUrl ?? '',
    esporte: input.esporte ?? 'tenis',
    clubeId: input.clubeId ?? '',
    tipo: input.tipo ?? (input.imagemUrl ? 'foto' : 'texto'),
    partidaId: input.partidaId ?? '',
    curtidas: 0,
    curtidoPor: [],
    comentariosCount: 0,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
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

export async function getPost(postId: string) {
  const snap = await getDoc(doc(db, 'posts', postId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function comentarPost(input: {
  postId: string;
  autorUid: string;
  autorNome: string;
  autorFoto?: string;
  texto: string;
}): Promise<void> {
  const texto = input.texto.trim();
  if (!texto) return;

  await addDoc(collection(db, 'posts', input.postId, 'comentarios'), {
    autorUid: input.autorUid,
    autorNome: input.autorNome,
    autorFoto: input.autorFoto ?? '',
    texto,
    criadoEm: serverTimestamp(),
  });

  await updateDoc(doc(db, 'posts', input.postId), {
    comentariosCount: increment(1),
  });
}

export type ComentarioPost = {
  id: string;
  autorUid: string;
  autorNome: string;
  autorFoto?: string;
  texto: string;
  criadoEm?: { seconds: number };
};

export function ouvirComentarios(
  postId: string,
  onData: (lista: ComentarioPost[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'posts', postId, 'comentarios'),
    orderBy('criadoEm', 'asc')
  );
  return onSnapshot(q, (snap) => {
    onData(
      snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          autorUid: String(raw.autorUid ?? ''),
          autorNome: String(raw.autorNome ?? 'Jogador'),
          autorFoto: raw.autorFoto ? String(raw.autorFoto) : undefined,
          texto: String(raw.texto ?? ''),
          criadoEm: raw.criadoEm as { seconds: number } | undefined,
        };
      })
    );
  });
}
