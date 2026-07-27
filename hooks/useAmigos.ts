import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import { useAuth } from './useAuth';
import type { Amizade } from '../services/amigos';

function mapAmizade(d: { id: string; data: () => Record<string, unknown> }): Amizade {
  const raw = d.data();
  return {
    id: d.id,
    deUid: String(raw.deUid ?? ''),
    deNome: String(raw.deNome ?? ''),
    deFoto: raw.deFoto ? String(raw.deFoto) : undefined,
    paraUid: String(raw.paraUid ?? ''),
    paraNome: String(raw.paraNome ?? ''),
    paraFoto: raw.paraFoto ? String(raw.paraFoto) : undefined,
    status: (raw.status as Amizade['status']) ?? 'pendente',
    criadoEm: raw.criadoEm as { seconds: number } | undefined,
  };
}

export function useAmigos() {
  const { user } = useAuth();
  const [enviadas, setEnviadas] = useState<Amizade[]>([]);
  const [recebidas, setRecebidas] = useState<Amizade[]>([]);

  useEffect(() => {
    if (!user) {
      setEnviadas([]);
      setRecebidas([]);
      return;
    }
    const qA = query(collection(db, 'amizades'), where('deUid', '==', user.uid));
    const qB = query(collection(db, 'amizades'), where('paraUid', '==', user.uid));
    const unsubA = onSnapshot(qA, (snap) => setEnviadas(snap.docs.map(mapAmizade)));
    const unsubB = onSnapshot(qB, (snap) => setRecebidas(snap.docs.map(mapAmizade)));
    return () => {
      unsubA();
      unsubB();
    };
  }, [user]);

  const amigos = useMemo(() => {
    const aceitos = [...enviadas, ...recebidas].filter((a) => a.status === 'aceito');
    return aceitos.map((a) => {
      const souDe = a.deUid === user?.uid;
      return {
        amizadeId: a.id,
        uid: souDe ? a.paraUid : a.deUid,
        nome: souDe ? a.paraNome : a.deNome,
        fotoUrl: souDe ? a.paraFoto : a.deFoto,
      };
    });
  }, [enviadas, recebidas, user?.uid]);

  const pendentesRecebidas = useMemo(
    () => recebidas.filter((a) => a.status === 'pendente'),
    [recebidas]
  );

  const amigoUids = useMemo(() => new Set(amigos.map((a) => a.uid)), [amigos]);

  return { amigos, amigoUids, pendentesRecebidas, enviadas, recebidas };
}
