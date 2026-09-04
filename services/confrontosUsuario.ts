import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { ConfrontoStatus } from './chaveamentoTorneio';

export type ProximoJogoOrigem = 'desafio' | 'torneio';

/** Confronto de torneio relevante para o usuário (próximos jogos). */
export type ConfrontoTorneioUsuario = {
  id: string;
  torneioId: string;
  torneioNome: string;
  origem: 'torneio';
  status: ConfrontoStatus;
  labelRodada: string;
  j1Uid: string;
  j1Nome: string;
  j1Foto?: string;
  j2Uid: string;
  j2Nome: string;
  j2Foto?: string;
  dataHoraInicio?: string;
  quadraNome?: string;
  sets: { j1: number; j2: number }[];
  vencedorUid?: string;
  rota: string;
};

export type InscricaoTorneioUsuario = {
  torneioId: string;
  torneioNome: string;
  clubeNome?: string;
  esporte?: string;
  statusInscricao: string;
  statusTorneio: string;
  dataInicio?: string;
  rota: string;
};

function mapConfrontoDoc(
  d: { id: string; ref: { path: string }; data: () => Record<string, unknown> },
  torneioNome: string
): ConfrontoTorneioUsuario {
  const raw = d.data();
  const parts = d.ref.path.split('/');
  // torneios/{id}/confrontos/{cid}
  const torneioId = parts[1] ?? '';
  return {
    id: d.id,
    torneioId,
    torneioNome,
    origem: 'torneio',
    status: (raw.status as ConfrontoStatus) || 'aguardando',
    labelRodada: String(raw.labelRodada ?? ''),
    j1Uid: String(raw.j1Uid ?? ''),
    j1Nome: String(raw.j1Nome ?? 'Jogador'),
    j1Foto: raw.j1Foto ? String(raw.j1Foto) : undefined,
    j2Uid: String(raw.j2Uid ?? ''),
    j2Nome: String(raw.j2Nome ?? 'Jogador'),
    j2Foto: raw.j2Foto ? String(raw.j2Foto) : undefined,
    dataHoraInicio: raw.dataHoraInicio ? String(raw.dataHoraInicio) : undefined,
    quadraNome: raw.quadraNome ? String(raw.quadraNome) : undefined,
    sets: (raw.sets as { j1: number; j2: number }[]) ?? [],
    vencedorUid: raw.vencedorUid ? String(raw.vencedorUid) : undefined,
    rota: `/torneio/${torneioId}`,
  };
}

async function enriquecerTorneioNome(
  docs: { id: string; ref: { path: string }; data: () => Record<string, unknown> }[]
): Promise<ConfrontoTorneioUsuario[]> {
  const nomes = new Map<string, string>();
  const out: ConfrontoTorneioUsuario[] = [];
  for (const d of docs) {
    const torneioId = d.ref.path.split('/')[1] ?? '';
    if (!nomes.has(torneioId)) {
      try {
        const t = await getDoc(doc(db, 'torneios', torneioId));
        nomes.set(torneioId, String(t.data()?.nome ?? 'Torneio'));
      } catch {
        nomes.set(torneioId, 'Torneio');
      }
    }
    out.push(mapConfrontoDoc(d, nomes.get(torneioId)!));
  }
  return out;
}

function envolveUid(raw: Record<string, unknown>, uid: string): boolean {
  return (
    String(raw.j1Uid ?? '') === uid ||
    String(raw.j2Uid ?? '') === uid ||
    String(raw.j1ParceiroUid ?? '') === uid ||
    String(raw.j2ParceiroUid ?? '') === uid
  );
}

/**
 * Próximos confrontos de torneio do jogador (chave pronta ou aguardando adversário).
 * Usa collectionGroup em j1Uid / j2Uid (indexes já existem).
 */
export async function listarProximosConfrontosTorneio(
  uid: string
): Promise<ConfrontoTorneioUsuario[]> {
  if (!uid) return [];
  const col = collectionGroup(db, 'confrontos');
  const [a, b] = await Promise.all([
    getDocs(query(col, where('j1Uid', '==', uid))),
    getDocs(query(col, where('j2Uid', '==', uid))),
  ]);

  const map = new Map<string, (typeof a.docs)[0]>();
  [...a.docs, ...b.docs].forEach((d) => {
    if (!envolveUid(d.data(), uid)) return;
    const st = String(d.data().status ?? '');
    if (st !== 'pronto' && st !== 'aguardando') return;
    if (!d.data().j1Uid || !d.data().j2Uid) {
      // bye / slot vazio — só mostra se pronto com adversário
      if (st !== 'pronto') return;
    }
    map.set(d.ref.path, d);
  });

  const lista = await enriquecerTorneioNome([...map.values()]);
  return lista.sort((x, y) => {
    const dx = x.dataHoraInicio || '';
    const dy = y.dataHoraInicio || '';
    if (dx && dy) return dx.localeCompare(dy);
    if (dx) return -1;
    if (dy) return 1;
    return (x.labelRodada || '').localeCompare(y.labelRodada || '');
  });
}

/** Torneios em que o jogador está inscrito (capitão ou doc com uid). */
export async function listarTorneiosDoJogador(
  uid: string
): Promise<InscricaoTorneioUsuario[]> {
  if (!uid) return [];
  const snap = await getDocs(
    query(collectionGroup(db, 'inscritos'), where('uid', '==', uid))
  );

  const out: InscricaoTorneioUsuario[] = [];
  for (const d of snap.docs) {
    const raw = d.data();
    const torneioId = d.ref.path.split('/')[1] ?? '';
    if (!torneioId) continue;
    let torneioNome = 'Torneio';
    let clubeNome = '';
    let esporte = '';
    let statusTorneio = 'aberto';
    let dataInicio = '';
    try {
      const t = await getDoc(doc(db, 'torneios', torneioId));
      if (t.exists()) {
        const td = t.data();
        torneioNome = String(td.nome ?? 'Torneio');
        clubeNome = String(td.clubeNome ?? '');
        esporte = String(td.esporte ?? '');
        statusTorneio = String(td.status ?? 'aberto');
        dataInicio = td.dataInicio ? String(td.dataInicio) : '';
      }
    } catch {
      /* ignore */
    }
    out.push({
      torneioId,
      torneioNome,
      clubeNome: clubeNome || undefined,
      esporte: esporte || undefined,
      statusInscricao: String(raw.status ?? 'confirmado'),
      statusTorneio,
      dataInicio: dataInicio || undefined,
      rota: `/torneio/${torneioId}`,
    });
  }

  // Também inscritos como parceiro (doc do capitão)
  const comoParceiro = await getDocs(
    query(collectionGroup(db, 'inscritos'), where('parceiroUid', '==', uid))
  );
  for (const d of comoParceiro.docs) {
    const torneioId = d.ref.path.split('/')[1] ?? '';
    if (!torneioId || out.some((x) => x.torneioId === torneioId)) continue;
    const raw = d.data();
    let torneioNome = 'Torneio';
    let clubeNome = '';
    let esporte = '';
    let statusTorneio = 'aberto';
    let dataInicio = '';
    try {
      const t = await getDoc(doc(db, 'torneios', torneioId));
      if (t.exists()) {
        const td = t.data();
        torneioNome = String(td.nome ?? 'Torneio');
        clubeNome = String(td.clubeNome ?? '');
        esporte = String(td.esporte ?? '');
        statusTorneio = String(td.status ?? 'aberto');
        dataInicio = td.dataInicio ? String(td.dataInicio) : '';
      }
    } catch {
      /* ignore */
    }
    out.push({
      torneioId,
      torneioNome,
      clubeNome: clubeNome || undefined,
      esporte: esporte || undefined,
      statusInscricao: String(raw.status ?? 'confirmado'),
      statusTorneio,
      dataInicio: dataInicio || undefined,
      rota: `/torneio/${torneioId}`,
    });
  }

  return out.sort((a, b) =>
    (b.dataInicio || '').localeCompare(a.dataInicio || '')
  );
}
