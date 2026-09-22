import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

const BATCH_MAX = 400;

type UpdateOp = {
  ref: DocumentReference;
  data: Record<string, unknown>;
  /** set+merge evita falha se o doc de classificação ainda não existir */
  merge?: boolean;
};

async function commitUpdates(updates: UpdateOp[]): Promise<void> {
  for (let i = 0; i < updates.length; i += BATCH_MAX) {
    const chunk = updates.slice(i, i + BATCH_MAX);
    const batch = writeBatch(db);
    for (const u of chunk) {
      if (u.merge) batch.set(u.ref, u.data, { merge: true });
      else batch.update(u.ref, u.data);
    }
    await batch.commit();
  }
}

/**
 * Espalha foto/nome nos docs denormalizados (desafios, amizades, posts,
 * conversas, classificação, inscritos, confrontos, solicitações, comentários).
 */
export async function propagarPerfilPublico(input: {
  uid: string;
  fotoUrl: string;
  nome?: string;
}): Promise<void> {
  const { uid, fotoUrl } = input;
  const nome = input.nome?.trim();
  const updates: UpdateOp[] = [];

  const push = (
    ref: DocumentReference,
    data: Record<string, unknown>,
    merge?: boolean
  ) => {
    updates.push({ ref, data, merge });
  };

  // —— Desafios ——
  const [dDesafiante, dDesafiado] = await Promise.all([
    getDocs(query(collection(db, 'desafios'), where('desafiante', '==', uid))),
    getDocs(query(collection(db, 'desafios'), where('desafiado', '==', uid))),
  ]);
  for (const d of dDesafiante.docs) {
    const data: Record<string, unknown> = { desafianteFoto: fotoUrl };
    if (nome) data.desafianteNome = nome;
    push(d.ref, data);
  }
  for (const d of dDesafiado.docs) {
    const data: Record<string, unknown> = { desafiadoFoto: fotoUrl };
    if (nome) data.desafiadoNome = nome;
    push(d.ref, data);
  }

  // —— Amizades ——
  const [aDe, aPara] = await Promise.all([
    getDocs(query(collection(db, 'amizades'), where('deUid', '==', uid))),
    getDocs(query(collection(db, 'amizades'), where('paraUid', '==', uid))),
  ]);
  for (const d of aDe.docs) {
    const data: Record<string, unknown> = { deFoto: fotoUrl };
    if (nome) data.deNome = nome;
    push(d.ref, data);
  }
  for (const d of aPara.docs) {
    const data: Record<string, unknown> = { paraFoto: fotoUrl };
    if (nome) data.paraNome = nome;
    push(d.ref, data);
  }

  // —— Posts ——
  const posts = await getDocs(query(collection(db, 'posts'), where('autorUid', '==', uid)));
  for (const d of posts.docs) {
    const data: Record<string, unknown> = { autorFoto: fotoUrl };
    if (nome) data.autorNome = nome;
    push(d.ref, data);
  }

  // —— Comentários do feed ——
  try {
    const comentarios = await getDocs(
      query(collectionGroup(db, 'comentarios'), where('autorUid', '==', uid))
    );
    for (const d of comentarios.docs) {
      const data: Record<string, unknown> = { autorFoto: fotoUrl };
      if (nome) data.autorNome = nome;
      push(d.ref, data);
    }
  } catch (e) {
    console.warn('propagar comentarios', e);
  }

  // —— Conversas (mapa fotos + nomes) ——
  const conversas = await getDocs(
    query(collection(db, 'conversas'), where('participantes', 'array-contains', uid))
  );
  for (const d of conversas.docs) {
    const data: Record<string, unknown> = {
      [`fotos.${uid}`]: fotoUrl,
    };
    if (nome) data[`nomes.${uid}`] = nome;
    push(d.ref, data);
  }

  // —— Solicitações de ranking ——
  try {
    const sols = await getDocs(query(collection(db, 'solicitacoes'), where('uid', '==', uid)));
    for (const d of sols.docs) {
      const data: Record<string, unknown> = { fotoUrl };
      if (nome) data.nome = nome;
      push(d.ref, data);
    }
  } catch (e) {
    console.warn('propagar solicitacoes', e);
  }

  // —— Rankings: classificação do jogador ——
  const rankings = await getDocs(
    query(collection(db, 'rankings'), where('membros', 'array-contains', uid))
  );
  for (const r of rankings.docs) {
    const classRef = doc(db, 'rankings', r.id, 'classificacao', uid);
    const data: Record<string, unknown> = { fotoUrl, uid };
    if (nome) data.nome = nome;
    push(classRef, data, true);
  }

  // —— Torneios: inscritos (campo uid) ——
  try {
    const inscritos = await getDocs(
      query(collectionGroup(db, 'inscritos'), where('uid', '==', uid))
    );
    for (const d of inscritos.docs) {
      const data: Record<string, unknown> = { fotoUrl };
      if (nome) data.nome = nome;
      push(d.ref, data);
    }
  } catch (e) {
    console.warn('propagar inscritos', e);
  }

  // —— Confrontos da chave ——
  try {
    const [c1, c2] = await Promise.all([
      getDocs(query(collectionGroup(db, 'confrontos'), where('j1Uid', '==', uid))),
      getDocs(query(collectionGroup(db, 'confrontos'), where('j2Uid', '==', uid))),
    ]);
    for (const d of c1.docs) {
      const data: Record<string, unknown> = { j1Foto: fotoUrl };
      if (nome) data.j1Nome = nome;
      push(d.ref, data);
    }
    for (const d of c2.docs) {
      const data: Record<string, unknown> = { j2Foto: fotoUrl };
      if (nome) data.j2Nome = nome;
      push(d.ref, data);
    }
  } catch (e) {
    console.warn('propagar confrontos', e);
  }

  await commitUpdates(updates);
}
