import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
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
  uidB: string;
  nomeB: string;
}): Promise<string> {
  const participantes = [input.uidA, input.uidB].sort();
  const chave = participantes.join('_');
  const id = conversaDocId(chave);
  const ref = doc(db, 'conversas', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.id;
  } catch {
    // get em doc inexistente podia falhar com rules antigas — segue para criar
  }

  await setDoc(
    ref,
    {
      tipo: 'amigo' as ConversaTipo,
      chave,
      participantes,
      nomes: {
        [input.uidA]: input.nomeA,
        [input.uidB]: input.nomeB,
      },
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
  clubeId: string;
  clubeNome: string;
  donoUid: string;
}): Promise<string> {
  const chave = `clube_${input.clubeId}_${input.uid}`;
  const id = conversaDocId(chave);
  const ref = doc(db, 'conversas', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.id;
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
      nomes: {
        [input.uid]: input.nome,
        [input.donoUid]: input.clubeNome,
      },
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

  await addDoc(collection(db, 'conversas', input.conversaId, 'mensagens'), {
    deUid: input.deUid,
    deNome: input.deNome,
    texto,
    criadoEm: serverTimestamp(),
  });

  await updateDoc(doc(db, 'conversas', input.conversaId), {
    ultimoTexto: texto,
    atualizadoEm: serverTimestamp(),
  });
}

/** Lista conversas do usuário (query com array-contains — permitido pelas rules). */
export async function listarConversasDoUsuario(uid: string) {
  const snap = await getDocs(
    query(collection(db, 'conversas'), where('participantes', 'array-contains', uid))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
