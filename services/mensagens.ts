import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

export type ConversaTipo = 'amigo' | 'clube';

/** ID estável — evita query por `chave` (Firestore nega list sem filtro em participantes). */
function conversaDocId(chave: string): string {
  return chave.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 700);
}

export async function abrirOuCriarConversaAmigo(input: {
  uidA: string;
  nomeA: string;
  fotoA?: string;
  uidB: string;
  nomeB: string;
  fotoB?: string;
}): Promise<string> {
  const participantes = [input.uidA, input.uidB].sort();
  const chave = participantes.join('_');
  const id = conversaDocId(chave);
  const ref = doc(db, 'conversas', id);

  const nomes = {
    [input.uidA]: input.nomeA,
    [input.uidB]: input.nomeB,
  };
  const fotos: Record<string, string> = {};
  if (input.fotoA) fotos[input.uidA] = input.fotoA;
  if (input.fotoB) fotos[input.uidB] = input.fotoB;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const patch: Record<string, unknown> = {
        [`nomes.${input.uidA}`]: input.nomeA,
        [`nomes.${input.uidB}`]: input.nomeB,
      };
      if (input.fotoA) patch[`fotos.${input.uidA}`] = input.fotoA;
      if (input.fotoB) patch[`fotos.${input.uidB}`] = input.fotoB;
      await updateDoc(ref, patch);
      return snap.id;
    }
  } catch {
    // get em doc inexistente podia falhar com rules antigas — segue para criar
  }

  await setDoc(
    ref,
    {
      tipo: 'amigo' as ConversaTipo,
      chave,
      participantes,
      nomes,
      fotos,
      ultimoTexto: '',
      atualizadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
    },
    { merge: true }
  );
  return id;
}

export async function abrirOuCriarConversaClube(input: {
  uid: string;
  nome: string;
  fotoUrl?: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  donoFoto?: string;
}): Promise<string> {
  const chave = `clube_${input.clubeId}_${input.uid}`;
  const id = conversaDocId(chave);
  const ref = doc(db, 'conversas', id);

  const nomes = {
    [input.uid]: input.nome,
    [input.donoUid]: input.clubeNome,
  };
  const fotos: Record<string, string> = {};
  if (input.fotoUrl) fotos[input.uid] = input.fotoUrl;
  if (input.donoFoto) fotos[input.donoUid] = input.donoFoto;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const patch: Record<string, unknown> = {
        [`nomes.${input.uid}`]: input.nome,
        [`nomes.${input.donoUid}`]: input.clubeNome,
      };
      if (input.fotoUrl) patch[`fotos.${input.uid}`] = input.fotoUrl;
      if (input.donoFoto) patch[`fotos.${input.donoUid}`] = input.donoFoto;
      await updateDoc(ref, patch);
      return snap.id;
    }
  } catch {
    // idem amigo — cria se get falhar
  }

  await setDoc(
    ref,
    {
      tipo: 'clube' as ConversaTipo,
      chave,
      participantes: [input.uid, input.donoUid],
      clubeId: input.clubeId,
      clubeNome: input.clubeNome,
      nomes,
      fotos,
      ultimoTexto: '',
      atualizadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
    },
    { merge: true }
  );
  return id;
}

export async function enviarMensagem(input: {
  conversaId: string;
  deUid: string;
  deNome: string;
  texto: string;
}): Promise<void> {
  const texto = input.texto.trim();
  if (!texto) return;

  const conversaRef = doc(db, 'conversas', input.conversaId);
  const snap = await getDoc(conversaRef);
  const participantes = (snap.data()?.participantes as string[] | undefined) ?? [];

  await addDoc(collection(db, 'conversas', input.conversaId, 'mensagens'), {
    deUid: input.deUid,
    deNome: input.deNome,
    texto,
    criadoEm: serverTimestamp(),
  });

  const patch: Record<string, unknown> = {
    ultimoTexto: texto,
    ultimoDeUid: input.deUid,
    atualizadoEm: serverTimestamp(),
  };
  for (const uid of participantes) {
    if (uid !== input.deUid) {
      patch[`naoLidas.${uid}`] = increment(1);
    }
  }
  await updateDoc(conversaRef, patch);
}

/** Zera contador de não lidas do usuário ao abrir o chat. */
export async function marcarConversaComoLida(
  conversaId: string,
  uid: string
): Promise<void> {
  if (!conversaId || !uid) return;
  await updateDoc(doc(db, 'conversas', conversaId), {
    [`naoLidas.${uid}`]: 0,
  });
}

/** Lista conversas do usuário (query com array-contains — permitido pelas rules). */
export async function listarConversasDoUsuario(uid: string) {
  const snap = await getDocs(
    query(collection(db, 'conversas'), where('participantes', 'array-contains', uid))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
