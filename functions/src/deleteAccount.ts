import { getAuth } from 'firebase-admin/auth';
import {
  getFirestore,
  type CollectionReference,
  type Firestore,
  type Query,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

async function deleteQueryInBatches(q: Query, batchSize = 200): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await q.limit(batchSize).get();
    if (snap.empty) return;
    const batch = getFirestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}

async function deleteCollection(ref: CollectionReference, batchSize = 200) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) return;
    const batch = getFirestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (snap.size < batchSize) return;
  }
}

async function deleteUserStorage(uid: string): Promise<void> {
  try {
    const bucket = getStorage().bucket();
    await bucket.deleteFiles({ prefix: `usuarios/${uid}/` });
  } catch {
    // Storage vazio não bloqueia.
  }
}

async function deleteClubesDoDono(db: Firestore, uid: string): Promise<void> {
  const clubes = await db.collection('clubes').where('donoUid', '==', uid).get();
  for (const clube of clubes.docs) {
    await deleteCollection(clube.ref.collection('modalidadesAula'));

    const rankings = await db.collection('rankings').where('clubeId', '==', clube.id).get();
    for (const r of rankings.docs) {
      await deleteCollection(r.ref.collection('classificacao'));
      await r.ref.delete();
    }

    const torneios = await db.collection('torneios').where('clubeId', '==', clube.id).get();
    for (const t of torneios.docs) {
      await deleteCollection(t.ref.collection('inscritos'));
      await deleteCollection(t.ref.collection('confrontos'));
      await t.ref.delete();
    }

    await clube.ref.delete();
  }
}

async function scrubClassificacaoEInscritos(db: Firestore, uid: string): Promise<void> {
  const rankings = await db.collection('rankings').get();
  for (const r of rankings.docs) {
    await r.ref.collection('classificacao').doc(uid).delete().catch(() => undefined);
  }
  const torneios = await db.collection('torneios').get();
  for (const t of torneios.docs) {
    await t.ref.collection('inscritos').doc(uid).delete().catch(() => undefined);
  }
}

async function deleteConversasDoUsuario(db: Firestore, uid: string): Promise<void> {
  const snap = await db.collection('conversas').where('participantes', 'array-contains', uid).get();
  for (const c of snap.docs) {
    await deleteCollection(c.ref.collection('mensagens'));
    await c.ref.delete();
  }
}

/**
 * Remove dados pessoais do Setmatch + Auth user.
 * Clubes do dono e conteúdo associado são apagados.
 */
export async function wipeSetmatchUser(uid: string): Promise<void> {
  const db = getFirestore();

  await deleteUserStorage(uid);
  await deleteClubesDoDono(db, uid);

  const byUid = [
    db.collection('pagamentos').where('uid', '==', uid),
    db.collection('matriculas').where('uid', '==', uid),
    db.collection('interessesAulas').where('uid', '==', uid),
    db.collection('aulasPublicadas').where('donoUid', '==', uid),
    db.collection('desafios').where('desafiante', '==', uid),
    db.collection('desafios').where('desafiado', '==', uid),
    db.collection('partidas').where('jogador1', '==', uid),
    db.collection('partidas').where('jogador2', '==', uid),
    db.collection('posts').where('autorUid', '==', uid),
    db.collection('amizades').where('deUid', '==', uid),
    db.collection('amizades').where('paraUid', '==', uid),
    db.collection('solicitacoes').where('uid', '==', uid),
    db.collection('solicitacoes').where('donoUid', '==', uid),
  ];

  for (const q of byUid) {
    try {
      await deleteQueryInBatches(q);
    } catch (e) {
      console.warn('wipe query skip', e);
    }
  }

  try {
    await scrubClassificacaoEInscritos(db, uid);
  } catch (e) {
    console.warn('scrub ranking/torneio', e);
  }

  try {
    await deleteConversasDoUsuario(db, uid);
  } catch (e) {
    console.warn('conversas', e);
  }

  await db.collection('usuarios').doc(uid).delete().catch(() => undefined);
  await getAuth().deleteUser(uid);
}
