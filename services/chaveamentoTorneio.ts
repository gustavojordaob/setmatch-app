import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  updateDoc,
  increment,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import {
  montarSlotsComByes,
  nomeRodada,
  proximaPotenciaDe2,
} from '../utils/chaveamento';
import type { EsporteId } from '../constants/esportes';
import { criarNotificacao } from './notificacoes';

export type ConfrontoStatus = 'aguardando' | 'bye' | 'pronto' | 'finalizado';

export interface InscritoSlot {
  uid: string;
  nome: string;
  fotoUrl?: string;
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroFoto?: string;
}

export interface ConfrontoTorneio {
  id: string;
  torneioId: string;
  categoriaId?: string;
  categoriaNome?: string;
  round: number;
  pos: number;
  labelRodada: string;
  j1Uid: string;
  j1Nome: string;
  j1Foto: string;
  j1ParceiroUid?: string;
  j1ParceiroNome?: string;
  j1ParceiroFoto?: string;
  j2Uid: string;
  j2Nome: string;
  j2Foto: string;
  j2ParceiroUid?: string;
  j2ParceiroNome?: string;
  j2ParceiroFoto?: string;
  status: ConfrontoStatus;
  sets: { j1: number; j2: number }[];
  vencedorUid: string;
  nextConfrontoId: string;
  nextSlot: 'j1' | 'j2' | '';
  /** Organizador define — jogador não reserva */
  dataHoraInicio?: string;
  quadraNome?: string;
}

function mapConfronto(id: string, raw: Record<string, unknown>): ConfrontoTorneio {
  return {
    id,
    torneioId: String(raw.torneioId ?? ''),
    categoriaId: raw.categoriaId ? String(raw.categoriaId) : undefined,
    categoriaNome: raw.categoriaNome ? String(raw.categoriaNome) : undefined,
    round: Number(raw.round ?? 1),
    pos: Number(raw.pos ?? 0),
    labelRodada: String(raw.labelRodada ?? ''),
    j1Uid: String(raw.j1Uid ?? ''),
    j1Nome: String(raw.j1Nome ?? ''),
    j1Foto: String(raw.j1Foto ?? ''),
    j1ParceiroUid: raw.j1ParceiroUid ? String(raw.j1ParceiroUid) : undefined,
    j1ParceiroNome: raw.j1ParceiroNome ? String(raw.j1ParceiroNome) : undefined,
    j1ParceiroFoto: raw.j1ParceiroFoto ? String(raw.j1ParceiroFoto) : undefined,
    j2Uid: String(raw.j2Uid ?? ''),
    j2Nome: String(raw.j2Nome ?? ''),
    j2Foto: String(raw.j2Foto ?? ''),
    j2ParceiroUid: raw.j2ParceiroUid ? String(raw.j2ParceiroUid) : undefined,
    j2ParceiroNome: raw.j2ParceiroNome ? String(raw.j2ParceiroNome) : undefined,
    j2ParceiroFoto: raw.j2ParceiroFoto ? String(raw.j2ParceiroFoto) : undefined,
    status: (raw.status as ConfrontoStatus) ?? 'aguardando',
    sets: (raw.sets as { j1: number; j2: number }[]) ?? [],
    vencedorUid: String(raw.vencedorUid ?? ''),
    nextConfrontoId: String(raw.nextConfrontoId ?? ''),
    nextSlot: (raw.nextSlot as 'j1' | 'j2' | '') ?? '',
    dataHoraInicio: raw.dataHoraInicio ? String(raw.dataHoraInicio) : undefined,
    quadraNome: raw.quadraNome ? String(raw.quadraNome) : undefined,
  };
}

export async function listarInscritosTorneio(
  torneioId: string,
  categoriaId?: string
): Promise<InscritoSlot[]> {
  const snap = await getDocs(collection(db, 'torneios', torneioId, 'inscritos'));
  return snap.docs
    .map((d) => {
      const raw = d.data();
      const status = String(raw.status ?? 'confirmado');
      // Legacy sem status = confirmado; só entram slots confirmados na chave
      if (status !== 'confirmado' && raw.status != null) return null;
      const cat = String(raw.categoriaId ?? '');
      if (categoriaId) {
        // Legado sem categoria entra só se for a primeira geração sem filtro estrito:
        // com categoriaId explícito, exige match (legado vazio não entra em cat nova)
        if (cat && cat !== categoriaId) return null;
        if (!cat && categoriaId) return null;
      }
      const parceiroNome = raw.parceiroNome ? String(raw.parceiroNome) : '';
      const nomeBase = String(raw.nome ?? 'Jogador');
      return {
        uid: String(raw.uid ?? d.id.split('__')[0]),
        nome: parceiroNome ? `${nomeBase} / ${parceiroNome}` : nomeBase,
        fotoUrl: raw.fotoUrl ? String(raw.fotoUrl) : undefined,
        parceiroUid: raw.parceiroUid ? String(raw.parceiroUid) : undefined,
        parceiroNome: parceiroNome || undefined,
        parceiroFoto: raw.parceiroFoto ? String(raw.parceiroFoto) : undefined,
      } as InscritoSlot;
    })
    .filter((x): x is InscritoSlot => x != null);
}

export function ouvirConfrontos(
  torneioId: string,
  onData: (lista: ConfrontoTorneio[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'torneios', torneioId, 'confrontos'), (snap) => {
    const list = snap.docs.map((d) => mapConfronto(d.id, d.data()));
    list.sort((a, b) => a.round - b.round || a.pos - b.pos);
    onData(list);
  });
}

/**
 * Gera chave single-elim (sorteio ou ordem de inscrição).
 * Com categorias: gera só a chave da categoria informada (ids prefixados).
 */
/** Remove confrontos de uma categoria (ou legado sem cat) para refazer a chave. */
export async function apagarChaveamentoCategoria(
  torneioId: string,
  categoriaId?: string
): Promise<number> {
  const catId = categoriaId?.trim() || '';
  const snap = await getDocs(collection(db, 'torneios', torneioId, 'confrontos'));
  const batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    const c = String(d.data().categoriaId ?? '');
    const match = catId
      ? c === catId || d.id.startsWith(`${catId}-`)
      : !c;
    if (!match) continue;
    batch.delete(d.ref);
    n += 1;
  }
  if (n > 0) await batch.commit();
  return n;
}

export async function gerarChaveamento(input: {
  torneioId: string;
  donoUid: string;
  estruturaMata?: number;
  sortear?: boolean;
  categoriaId?: string;
  categoriaNome?: string;
  /** Uids dos cabeças de chave (ordem = seed 1, 2, …). */
  cabecasUids?: string[];
  /** Se true, apaga chave existente da categoria e gera de novo. */
  forcar?: boolean;
}): Promise<number> {
  const existentes = await getDocs(
    collection(db, 'torneios', input.torneioId, 'confrontos')
  );
  const catId = input.categoriaId?.trim() || '';
  const jaTemCat = existentes.docs.some((d) => {
    const c = String(d.data().categoriaId ?? '');
    if (catId) return c === catId || d.id.startsWith(`${catId}-`);
    return !c; // legado sem categoria
  });
  if (jaTemCat) {
    if (input.forcar) {
      await apagarChaveamentoCategoria(input.torneioId, catId || undefined);
    } else {
      throw new Error(
        catId
          ? 'Chaveamento desta categoria já foi gerado.'
          : 'Chaveamento já gerado. Apague os confrontos no Console para refazer.'
      );
    }
  }

  const inscritos = await listarInscritosTorneio(
    input.torneioId,
    catId || undefined
  );
  if (inscritos.length < 2) {
    throw new Error(
      catId
        ? 'Precisa de pelo menos 2 inscritos confirmados nesta categoria.'
        : 'Precisa de pelo menos 2 inscritos para gerar a chave.'
    );
  }

  const tamanho = proximaPotenciaDe2(
    Math.max(inscritos.length, input.estruturaMata ?? 2)
  );
  const slots = montarSlotsComByes(
    inscritos,
    tamanho,
    input.sortear !== false,
    input.cabecasUids
  );
  const totalRounds = Math.log2(slots.length);
  const batch = writeBatch(db);
  const col = collection(db, 'torneios', input.torneioId, 'confrontos');

  // IDs estáveis por rodada/pos (+ categoria)
  const idOf = (round: number, pos: number) =>
    catId ? `${catId}-r${round}-p${pos}` : `r${round}-p${pos}`;

  // Pré-cria confrontos de todas as rodadas
  for (let round = 1; round <= totalRounds; round++) {
    const matchesInRound = slots.length / Math.pow(2, round);
    for (let pos = 0; pos < matchesInRound; pos++) {
      const id = idOf(round, pos);
      const nextRound = round + 1;
      const nextPos = Math.floor(pos / 2);
      const nextId = nextRound <= totalRounds ? idOf(nextRound, nextPos) : '';
      const nextSlot: 'j1' | 'j2' | '' =
        nextId ? (pos % 2 === 0 ? 'j1' : 'j2') : '';

      let j1Uid = '';
      let j1Nome = '';
      let j1Foto = '';
      let j1ParceiroUid = '';
      let j1ParceiroNome = '';
      let j1ParceiroFoto = '';
      let j2Uid = '';
      let j2Nome = '';
      let j2Foto = '';
      let j2ParceiroUid = '';
      let j2ParceiroNome = '';
      let j2ParceiroFoto = '';
      let status: ConfrontoStatus = 'aguardando';
      let vencedorUid = '';

      if (round === 1) {
        const a = slots[pos * 2];
        const b = slots[pos * 2 + 1];
        if (a) {
          j1Uid = a.uid;
          j1Nome = a.nome;
          j1Foto = a.fotoUrl ?? '';
          j1ParceiroUid = a.parceiroUid ?? '';
          j1ParceiroNome = a.parceiroNome ?? '';
          j1ParceiroFoto = a.parceiroFoto ?? '';
        }
        if (b) {
          j2Uid = b.uid;
          j2Nome = b.nome;
          j2Foto = b.fotoUrl ?? '';
          j2ParceiroUid = b.parceiroUid ?? '';
          j2ParceiroNome = b.parceiroNome ?? '';
          j2ParceiroFoto = b.parceiroFoto ?? '';
        }
        if (a && !b) {
          status = 'bye';
          vencedorUid = a.uid;
        } else if (!a && b) {
          status = 'bye';
          vencedorUid = b.uid;
          j1Uid = b.uid;
          j1Nome = b.nome;
          j1Foto = b.fotoUrl ?? '';
          j1ParceiroUid = b.parceiroUid ?? '';
          j1ParceiroNome = b.parceiroNome ?? '';
          j1ParceiroFoto = b.parceiroFoto ?? '';
          j2Uid = '';
          j2Nome = '';
          j2Foto = '';
          j2ParceiroUid = '';
          j2ParceiroNome = '';
          j2ParceiroFoto = '';
        } else if (a && b) {
          status = 'pronto';
        }
      }

      batch.set(doc(col, id), {
        torneioId: input.torneioId,
        categoriaId: catId,
        categoriaNome: input.categoriaNome ?? '',
        round,
        pos,
        labelRodada: nomeRodada(round, totalRounds),
        j1Uid,
        j1Nome,
        j1Foto,
        j1ParceiroUid,
        j1ParceiroNome,
        j1ParceiroFoto,
        j2Uid,
        j2Nome,
        j2Foto,
        j2ParceiroUid,
        j2ParceiroNome,
        j2ParceiroFoto,
        status,
        sets: [],
        vencedorUid,
        nextConfrontoId: nextId,
        nextSlot,
        criadoEm: serverTimestamp(),
      });
    }
  }

  batch.update(doc(db, 'torneios', input.torneioId), {
    status: 'em_andamento',
    chaveLiberada: true,
    chaveGeradaEm: serverTimestamp(),
  });

  await batch.commit();

  // Avança byes da rodada 1 desta categoria
  const r1 = await getDocs(collection(db, 'torneios', input.torneioId, 'confrontos'));
  for (const d of r1.docs) {
    const c = mapConfronto(d.id, d.data());
    if (catId && c.categoriaId && c.categoriaId !== catId) continue;
    if (c.round === 1 && c.status === 'bye' && c.vencedorUid && c.nextConfrontoId) {
      await avancarVencedor(c);
    }
  }

  const tDoc = await getDoc(doc(db, 'torneios', input.torneioId));
  const torneioNome = String(tDoc.data()?.nome ?? 'Torneio');
  const catLabel = input.categoriaNome ? ` (${input.categoriaNome})` : '';

  const uidsNotificados = new Set<string>();
  for (const slot of inscritos) {
    for (const u of [slot.uid, slot.parceiroUid].filter(Boolean) as string[]) {
      if (uidsNotificados.has(u)) continue;
      uidsNotificados.add(u);
      void criarNotificacao({
        paraUid: u,
        tipo: 'chave_torneio',
        titulo: 'Chaveamento liberado',
        corpo: `O chaveamento de ${torneioNome}${catLabel} já está disponível.`,
        rota: `/torneio/${input.torneioId}`,
        refId: input.torneioId,
      }).catch((e) => console.warn('[chave] notif', e));
    }
  }

  return inscritos.length;
}

async function avancarVencedor(c: ConfrontoTorneio): Promise<void> {
  if (!c.nextConfrontoId || !c.vencedorUid) return;
  const isJ1 = c.vencedorUid === c.j1Uid;
  const nome = isJ1 ? c.j1Nome : c.j2Nome || c.j1Nome;
  const foto = isJ1 ? c.j1Foto : c.j2Foto || c.j1Foto;
  const parceiroUid = isJ1 ? c.j1ParceiroUid : c.j2ParceiroUid;
  const parceiroNome = isJ1 ? c.j1ParceiroNome : c.j2ParceiroNome;
  const parceiroFoto = isJ1 ? c.j1ParceiroFoto : c.j2ParceiroFoto;
  const nextRef = doc(db, 'torneios', c.torneioId, 'confrontos', c.nextConfrontoId);
  const patch =
    c.nextSlot === 'j2'
      ? {
          j2Uid: c.vencedorUid,
          j2Nome: nome,
          j2Foto: foto,
          j2ParceiroUid: parceiroUid ?? '',
          j2ParceiroNome: parceiroNome ?? '',
          j2ParceiroFoto: parceiroFoto ?? '',
        }
      : {
          j1Uid: c.vencedorUid,
          j1Nome: nome,
          j1Foto: foto,
          j1ParceiroUid: parceiroUid ?? '',
          j1ParceiroNome: parceiroNome ?? '',
          j1ParceiroFoto: parceiroFoto ?? '',
        };
  await updateDoc(nextRef, patch);

  // Se ambos slots preenchidos → pronto
  const snap = await getDocs(collection(db, 'torneios', c.torneioId, 'confrontos'));
  const next = snap.docs
    .map((d) => mapConfronto(d.id, d.data()))
    .find((x) => x.id === c.nextConfrontoId);
  if (next && next.j1Uid && next.j2Uid && next.status === 'aguardando') {
    await updateDoc(nextRef, { status: 'pronto' });
    const tSnap = await getDoc(doc(db, 'torneios', c.torneioId));
    const torneioNome = String(tSnap.data()?.nome ?? 'Torneio');
    const cat = next.categoriaNome ? ` · ${next.categoriaNome}` : '';
    for (const u of [
      next.j1Uid,
      next.j2Uid,
      next.j1ParceiroUid,
      next.j2ParceiroUid,
    ].filter(Boolean) as string[]) {
      void getDoc(doc(db, 'usuarios', u))
        .then((uSnap) => {
          if (!uSnap.exists()) return;
          return criarNotificacao({
            paraUid: u,
            tipo: 'sistema',
            titulo: 'Seu próximo jogo está pronto',
            corpo: `${next.j1Nome} vs ${next.j2Nome}${cat} · ${torneioNome}`,
            rota: `/torneio/${c.torneioId}`,
            refId: next.id,
          });
        })
        .catch((e) => console.warn('[torneio] notif pronto', e));
    }
  }
}

async function bumpUsuarioStats(
  uid: string,
  fields: Record<string, ReturnType<typeof increment>>
): Promise<void> {
  if (!uid) return;
  try {
    const ref = doc(db, 'usuarios', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, fields);
  } catch (e) {
    console.warn('[torneio] bump stats', uid, e);
  }
}

export async function registrarResultadoConfronto(input: {
  torneioId: string;
  confrontoId: string;
  sets: { j1: number; j2: number }[];
  vencedorUid: string;
  esporte: EsporteId;
  registradoPor: string;
}): Promise<void> {
  const snap = await getDocs(collection(db, 'torneios', input.torneioId, 'confrontos'));
  const c = snap.docs
    .map((d) => mapConfronto(d.id, d.data()))
    .find((x) => x.id === input.confrontoId);
  if (!c) throw new Error('Confronto não encontrado');
  if (c.status === 'finalizado') throw new Error('Confronto já finalizado');
  if (c.status === 'bye') throw new Error('Bye automático — sem placar');
  if (!c.j1Uid || !c.j2Uid) throw new Error('Aguardando adversário');
  if (input.vencedorUid !== c.j1Uid && input.vencedorUid !== c.j2Uid) {
    throw new Error('Vencedor inválido');
  }

  await updateDoc(doc(db, 'torneios', input.torneioId, 'confrontos', input.confrontoId), {
    sets: input.sets,
    vencedorUid: input.vencedorUid,
    status: 'finalizado',
    registradoPor: input.registradoPor,
    finalizadoEm: serverTimestamp(),
  });

  const atualizado = { ...c, vencedorUid: input.vencedorUid, status: 'finalizado' as const };

  if (atualizado.nextConfrontoId) {
    await avancarVencedor(atualizado);
  } else {
    // Último jogo desta chave (final da categoria ou do torneio)
    const campeaoNome =
      input.vencedorUid === c.j1Uid ? c.j1Nome : c.j2Nome;
    const catId = c.categoriaId ?? '';
    const tSnapFim = await getDoc(doc(db, 'torneios', input.torneioId));
    const tRaw = tSnapFim.data() ?? {};
    const todosApos = (
      await getDocs(collection(db, 'torneios', input.torneioId, 'confrontos'))
    ).docs.map((d) => mapConfronto(d.id, d.data()));

    const catsCfg = Array.isArray(tRaw.categorias)
      ? (tRaw.categorias as { id?: string }[])
          .map((x) => String(x.id ?? '').trim())
          .filter(Boolean)
      : [];
    const catsAlvo =
      catsCfg.length > 0
        ? catsCfg
        : Array.from(
            new Set(todosApos.map((x) => x.categoriaId ?? '').filter((x) => x !== undefined))
          );

    const categoriaEstaFinalizada = (cid: string) => {
      const finais = todosApos.filter(
        (x) => (x.categoriaId ?? '') === cid && !x.nextConfrontoId
      );
      if (finais.length === 0) return false;
      return finais.every(
        (f) =>
          f.id === c.id ||
          f.status === 'finalizado' ||
          f.status === 'bye'
      );
    };

    const torneioAcabou =
      catsAlvo.length === 0
        ? true
        : catsAlvo.every((cid) =>
            cid === catId ? true : categoriaEstaFinalizada(cid)
          ) && categoriaEstaFinalizada(catId);

    const patchTorneio: Record<string, unknown> = {
      [`campeoesPorCategoria.${catId || 'geral'}`]: {
        uid: input.vencedorUid,
        nome: campeaoNome,
        categoriaId: catId || null,
        categoriaNome: c.categoriaNome ?? null,
        finalizadoEm: serverTimestamp(),
      },
    };
    if (torneioAcabou) {
      patchTorneio.status = 'finalizado';
      patchTorneio.campeaoUid = input.vencedorUid;
      patchTorneio.campeaoNome = campeaoNome;
      patchTorneio.finalizadoEm = serverTimestamp();
    }
    await updateDoc(doc(db, 'torneios', input.torneioId), patchTorneio);
    await bumpUsuarioStats(input.vencedorUid, { torneiosVencidos: increment(1) });

    try {
      const torneioNome = String(tRaw.nome ?? 'Torneio');
      const catLabel = c.categoriaNome ? ` (${c.categoriaNome})` : '';
      let corpoFim = torneioAcabou
        ? `${torneioNome} terminou. Campeão: ${campeaoNome}.`
        : `${torneioNome}${catLabel} terminou. Campeão: ${campeaoNome}.`;
      if (torneioAcabou) {
        const tAfter = await getDoc(doc(db, 'torneios', input.torneioId));
        const champs = (tAfter.data()?.campeoesPorCategoria ?? {}) as Record<
          string,
          { nome?: string; categoriaNome?: string | null }
        >;
        const linhas = Object.values(champs)
          .map((ch) => {
            const nome = String(ch.nome ?? '').trim();
            if (!nome) return '';
            const cn = ch.categoriaNome ? String(ch.categoriaNome) : '';
            return cn ? `${cn}: ${nome}` : nome;
          })
          .filter(Boolean);
        if (linhas.length > 1) {
          corpoFim = `${torneioNome} terminou.\nCampeões:\n${linhas.join('\n')}`;
        }
      }
      const inscSnap = await getDocs(
        collection(db, 'torneios', input.torneioId, 'inscritos')
      );
      const uids = new Set<string>();
      inscSnap.docs.forEach((d) => {
        const raw = d.data();
        const uid = String(raw.uid ?? '');
        const iCat = String(raw.categoriaId ?? '');
        if (!uid) return;
        if (torneioAcabou || !catId || iCat === catId || !iCat) uids.add(uid);
        const p = String(raw.parceiroUid ?? '');
        if (p && (torneioAcabou || !catId || iCat === catId || !iCat)) uids.add(p);
      });
      for (const uid of uids) {
        void criarNotificacao({
          paraUid: uid,
          tipo: 'sistema',
          titulo: torneioAcabou ? 'Torneio encerrado' : 'Categoria encerrada',
          corpo: corpoFim,
          rota: `/torneio/${input.torneioId}`,
          refId: input.torneioId,
        }).catch((e) => console.warn('[torneio] notif fim', e));
      }
    } catch (e) {
      console.warn('[torneio] fim categoria notif', e);
    }
  }

  // Espelha em partidas (histórico / H2H)
  const partidaRef = await addDoc(collection(db, 'partidas'), {
    torneioId: input.torneioId,
    confrontoId: input.confrontoId,
    jogador1: c.j1Uid,
    jogador1Nome: c.j1Nome,
    jogador1Foto: c.j1Foto,
    jogador1ParceiroUid: c.j1ParceiroUid ?? '',
    jogador1ParceiroNome: c.j1ParceiroNome ?? '',
    jogador1ParceiroFoto: c.j1ParceiroFoto ?? '',
    jogador2: c.j2Uid,
    jogador2Nome: c.j2Nome,
    jogador2Foto: c.j2Foto,
    jogador2ParceiroUid: c.j2ParceiroUid ?? '',
    jogador2ParceiroNome: c.j2ParceiroNome ?? '',
    jogador2ParceiroFoto: c.j2ParceiroFoto ?? '',
    composicao: c.j1ParceiroUid || c.j2ParceiroUid ? 'dupla' : 'simples',
    sets: input.sets,
    vencedor: input.vencedorUid,
    esporte: input.esporte,
    quadra: 'Torneio',
    tipo: 'torneio',
    dataPartida: serverTimestamp(),
  });

  const perdedor = input.vencedorUid === c.j1Uid ? c.j2Uid : c.j1Uid;
  await bumpUsuarioStats(input.vencedorUid, { vitorias: increment(1) });
  await bumpUsuarioStats(perdedor, { derrotas: increment(1) });

  const placar = input.sets.map((s) => `${s.j1}-${s.j2}`).join(', ');
  const vencedorNome =
    input.vencedorUid === c.j1Uid ? c.j1Nome : c.j2Nome;
  let torneioNome = 'Torneio';
  let clubeId = '';
  let registradorNome = 'Organizador';
  try {
    const tSnap = await getDoc(doc(db, 'torneios', input.torneioId));
    if (tSnap.exists()) {
      torneioNome = String(tSnap.data()?.nome ?? 'Torneio');
      clubeId = String(tSnap.data()?.clubeId ?? '');
    }
    const uSnap = await getDoc(doc(db, 'usuarios', input.registradoPor));
    if (uSnap.exists()) {
      registradorNome = String(uSnap.data()?.nome ?? 'Organizador');
    }
  } catch {
    /* ignore */
  }

  const { criarPost } = await import('./feed');
  const { criarNotificacao } = await import('./notificacoes');
  // autor = quem registrou (rules exigem auth.uid == autorUid)
  void criarPost({
    autorUid: input.registradoPor,
    autorNome: registradorNome,
    texto: `🏆 Torneio ${torneioNome}: ${c.j1Nome} vs ${c.j2Nome}\nPlacar: ${placar}\nVencedor: ${vencedorNome}`,
    esporte: input.esporte,
    clubeId: clubeId || undefined,
    tipo: 'resultado',
    partidaId: partidaRef.id,
  }).catch((e) => console.warn('[torneio] feed', e));

  for (const u of [c.j1Uid, c.j2Uid, c.j1ParceiroUid, c.j2ParceiroUid].filter(
    Boolean
  ) as string[]) {
    if (u === input.registradoPor) continue;
    // Só notifica uids reais (docs de usuário); seeds não têm notificações
    void getDoc(doc(db, 'usuarios', u))
      .then((uSnap) => {
        if (!uSnap.exists()) return;
        return criarNotificacao({
          paraUid: u,
          tipo: 'sistema',
          titulo: 'Resultado do torneio',
          corpo: `${c.j1Nome} vs ${c.j2Nome}: ${placar} · ${torneioNome}`,
          rota: `/torneio/${input.torneioId}`,
          refId: input.confrontoId,
        });
      })
      .catch((e) => console.warn('[torneio] notif resultado', e));
  }
}

/** Organizador define horário/quadra do confronto — jogador só visualiza. */
export async function atualizarAgendaConfronto(
  torneioId: string,
  confrontoId: string,
  data: { dataHoraInicio?: string; quadraNome?: string }
): Promise<void> {
  const hora = data.dataHoraInicio?.trim() ?? '';
  const quadra = data.quadraNome?.trim() ?? '';
  await updateDoc(doc(db, 'torneios', torneioId, 'confrontos', confrontoId), {
    dataHoraInicio: hora,
    quadraNome: quadra,
  });

  if (!hora && !quadra) return;

  try {
    const [cSnap, tSnap] = await Promise.all([
      getDoc(doc(db, 'torneios', torneioId, 'confrontos', confrontoId)),
      getDoc(doc(db, 'torneios', torneioId)),
    ]);
    if (!cSnap.exists()) return;
    const c = mapConfronto(cSnap.id, cSnap.data());
    const torneioNome = String(tSnap.data()?.nome ?? 'Torneio');
    const detalhe = [hora, quadra].filter(Boolean).join(' · ');
    for (const u of [
      c.j1Uid,
      c.j2Uid,
      c.j1ParceiroUid,
      c.j2ParceiroUid,
    ].filter(Boolean) as string[]) {
      void getDoc(doc(db, 'usuarios', u))
        .then((uSnap) => {
          if (!uSnap.exists()) return;
          return criarNotificacao({
            paraUid: u,
            tipo: 'sistema',
            titulo: 'Jogo agendado',
            corpo: `${c.j1Nome} vs ${c.j2Nome}: ${detalhe} · ${torneioNome}`,
            rota: `/torneio/${torneioId}`,
            refId: confrontoId,
          });
        })
        .catch((e) => console.warn('[torneio] notif agenda', e));
    }
  } catch (e) {
    console.warn('[torneio] agenda notif', e);
  }
}
