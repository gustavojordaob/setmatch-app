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
  montarSlotsManuais,
  nomeRodada,
  proximaPotenciaDe2,
} from '../utils/chaveamento';
import type { EsporteId } from '../constants/esportes';
import { criarNotificacao } from './notificacoes';

export type ConfrontoStatus = 'aguardando' | 'bye' | 'pronto' | 'finalizado';

export type ConfrontoFase = 'grupo' | 'mata';
export type ResultadoTipo = 'placar' | 'wo' | 'bye';

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
  /** grupo = fase de grupos; mata = eliminatória (padrão legado) */
  fase?: ConfrontoFase;
  grupoId?: string;
  grupoNome?: string;
  resultadoTipo?: ResultadoTipo;
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
    fase: (raw.fase as ConfrontoFase) || 'mata',
    grupoId: raw.grupoId ? String(raw.grupoId) : undefined,
    grupoNome: raw.grupoNome ? String(raw.grupoNome) : undefined,
    resultadoTipo: raw.resultadoTipo
      ? (raw.resultadoTipo as ResultadoTipo)
      : undefined,
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
  /** Quem o admin quer com bye na 1ª rodada (até o nº necessário). */
  byeUids?: string[];
  /**
   * Montagem manual completa: uids por posição da chave (null = bye).
   * Quando informado, ignora sorteio/cabeças/byeUids.
   */
  slotsManuais?: (string | null)[];
  /** Se true, apaga chave existente da categoria e gera de novo. */
  forcar?: boolean;
  /** Fase gravada nos docs (padrão mata). */
  fase?: ConfrontoFase;
  /**
   * Ao promover de grupos → mata: não falha se já existirem confrontos de grupo.
   * Só bloqueia se já houver confrontos de mata da categoria.
   */
  pularCheckExistenteGrupos?: boolean;
}): Promise<number> {
  const existentes = await getDocs(
    collection(db, 'torneios', input.torneioId, 'confrontos')
  );
  const catId = input.categoriaId?.trim() || '';
  const faseAlvo: ConfrontoFase = input.fase ?? 'mata';
  const jaTemCat = existentes.docs.some((d) => {
    const raw = d.data();
    const c = String(raw.categoriaId ?? '');
    const matchCat = catId
      ? c === catId || d.id.startsWith(`${catId}-`)
      : !c;
    if (!matchCat) return false;
    if (input.pularCheckExistenteGrupos) {
      const f = (raw.fase as string) || 'mata';
      return f === 'mata';
    }
    return true;
  });
  if (jaTemCat) {
    if (input.forcar) {
      if (input.pularCheckExistenteGrupos) {
        const batch = writeBatch(db);
        let n = 0;
        for (const d of existentes.docs) {
          const raw = d.data();
          const c = String(raw.categoriaId ?? '');
          const matchCat = catId
            ? c === catId || d.id.startsWith(`${catId}-`)
            : !c;
          if (!matchCat) continue;
          if (((raw.fase as string) || 'mata') !== 'mata') continue;
          batch.delete(d.ref);
          n += 1;
        }
        if (n > 0) await batch.commit();
      } else {
        await apagarChaveamentoCategoria(input.torneioId, catId || undefined);
      }
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
  const slots =
    input.slotsManuais && input.slotsManuais.length > 0
      ? montarSlotsManuais(inscritos, input.slotsManuais)
      : montarSlotsComByes(
          inscritos,
          tamanho,
          input.sortear !== false,
          input.cabecasUids,
          input.byeUids
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
        fase: faseAlvo,
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

  // Agenda automática a partir de dataInicio + horarioPadrao (organizador pode mudar depois)
  try {
    const tDocAgenda = await getDoc(doc(db, 'torneios', input.torneioId));
    const td = tDocAgenda.data() || {};
    const {
      calcularAgendaChaveamento,
      offsetCategoriaAgendaMin,
      parseListaQuadras,
    } = await import('../utils/agendaTorneio');
    const intervalo = Math.max(15, Number(td.intervaloJogosMin) || 60);
    const catsAgendadas = new Set<string>();
    for (const d of existentes.docs) {
      const c = String(d.data()?.categoriaId ?? '');
      if (c && c !== catId) catsAgendadas.add(c);
    }
    const slotsPlanejados: {
      id: string;
      round: number;
      pos: number;
      status: string;
    }[] = [];
    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = slots.length / Math.pow(2, round);
      for (let pos = 0; pos < matchesInRound; pos++) {
        const id = idOf(round, pos);
        let status: string = 'aguardando';
        if (round === 1) {
          const a = slots[pos * 2];
          const b = slots[pos * 2 + 1];
          if ((a && !b) || (!a && b)) status = 'bye';
          else if (a && b) status = 'pronto';
        }
        slotsPlanejados.push({ id, round, pos, status });
      }
    }
    const atribuir = Boolean(td.atribuirQuadrasAoSortear);
    const agenda = calcularAgendaChaveamento({
      dataInicio: td.dataInicio ? String(td.dataInicio) : undefined,
      horarioPadrao: td.horarioPadrao ? String(td.horarioPadrao) : undefined,
      slots: slotsPlanejados,
      intervaloJogoMin: intervalo,
      offsetCategoriaMin: offsetCategoriaAgendaMin(catsAgendadas.size, intervalo),
      atribuirQuadras: atribuir,
      quadras: parseListaQuadras(td.quadrasDisponiveis as string[] | undefined),
      quadraUnica: td.quadraNome ? String(td.quadraNome) : undefined,
    });
    if (agenda.size > 0) {
      const batchAgenda = writeBatch(db);
      agenda.forEach((slot, cid) => {
        batchAgenda.update(doc(col, cid), {
          dataHoraInicio: slot.hora,
          quadraNome: slot.quadra ?? '',
        });
      });
      await batchAgenda.commit();
    }
  } catch (e) {
    console.warn('[chave] agenda automatica', e);
  }

  // Avança byes da rodada 1 desta categoria (só mata-mata)
  const r1 = await getDocs(collection(db, 'torneios', input.torneioId, 'confrontos'));
  for (const d of r1.docs) {
    const c = mapConfronto(d.id, d.data());
    if (catId && c.categoriaId && c.categoriaId !== catId) continue;
    if ((c.fase ?? 'mata') !== 'mata') continue;
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

  // Ao liberar chave → inicia ranking do mês nos rankings do mesmo clube
  try {
    const clubeId = String(tDoc.data()?.clubeId ?? '');
    const donoUid = String(tDoc.data()?.donoUid ?? '');
    if (clubeId) {
      const { iniciarEtapaMensalRankingsDoClube } = await import('./rankings');
      void iniciarEtapaMensalRankingsDoClube({
        clubeId,
        porUid: donoUid,
      }).catch((e) => console.warn('[chave] ranking mes', e));
    }
  } catch (e) {
    console.warn('[chave] ranking mes', e);
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
            titulo: 'Jogo lançado no torneio',
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
    resultadoTipo: 'placar',
    registradoPor: input.registradoPor,
    finalizadoEm: serverTimestamp(),
  });

  const atualizado = {
    ...c,
    vencedorUid: input.vencedorUid,
    status: 'finalizado' as const,
    resultadoTipo: 'placar' as const,
  };

  if ((c.fase ?? 'mata') === 'grupo') {
    await aposResultadoGrupo(atualizado);
  } else if (atualizado.nextConfrontoId) {
    await avancarVencedor(atualizado);
  } else {
    await finalizarCategoriaSeUltimoJogo(atualizado, input.vencedorUid);
  }

  await espelharPartidaEFeed({
    torneioId: input.torneioId,
    confrontoId: input.confrontoId,
    c,
    sets: input.sets,
    vencedorUid: input.vencedorUid,
    esporte: input.esporte,
    registradoPor: input.registradoPor,
  });
}

/** W.O. — organizador avança o jogador sem placar (pronto, aguardando ou bye). */
export async function registrarWO(input: {
  torneioId: string;
  confrontoId: string;
  vencedorUid: string;
  registradoPor: string;
  esporte?: EsporteId;
}): Promise<void> {
  const snap = await getDocs(collection(db, 'torneios', input.torneioId, 'confrontos'));
  const c = snap.docs
    .map((d) => mapConfronto(d.id, d.data()))
    .find((x) => x.id === input.confrontoId);
  if (!c) throw new Error('Confronto não encontrado');
  if (c.status === 'finalizado') throw new Error('Confronto já finalizado');
  // bye / pronto / aguardando: todos aceitos para W.O.

  const candidatos = [c.j1Uid, c.j2Uid].filter(Boolean);
  if (candidatos.length === 0) throw new Error('Sem jogador para receber o W.O.');
  if (!candidatos.includes(input.vencedorUid)) {
    throw new Error('Vencedor do W.O. precisa estar no confronto');
  }

  await updateDoc(doc(db, 'torneios', input.torneioId, 'confrontos', input.confrontoId), {
    sets: [],
    vencedorUid: input.vencedorUid,
    status: 'finalizado',
    resultadoTipo: 'wo',
    registradoPor: input.registradoPor,
    finalizadoEm: serverTimestamp(),
  });

  const atualizado = {
    ...c,
    vencedorUid: input.vencedorUid,
    status: 'finalizado' as const,
    resultadoTipo: 'wo' as const,
  };

  if ((c.fase ?? 'mata') === 'grupo') {
    await aposResultadoGrupo(atualizado);
  } else if (atualizado.nextConfrontoId) {
    await avancarVencedor(atualizado);
  } else {
    await finalizarCategoriaSeUltimoJogo(atualizado, input.vencedorUid);
  }

  let esporte = input.esporte;
  if (!esporte) {
    const tSnap = await getDoc(doc(db, 'torneios', input.torneioId));
    esporte = (tSnap.data()?.esporte as EsporteId) ?? 'tenis';
  }
  await espelharPartidaEFeed({
    torneioId: input.torneioId,
    confrontoId: input.confrontoId,
    c,
    sets: [],
    vencedorUid: input.vencedorUid,
    esporte,
    registradoPor: input.registradoPor,
    isWO: true,
  });
}

type SlotKey = 'j1' | 'j2';

function lerSlot(c: ConfrontoTorneio, slot: SlotKey) {
  if (slot === 'j1') {
    return {
      uid: c.j1Uid,
      nome: c.j1Nome,
      foto: c.j1Foto,
      parceiroUid: c.j1ParceiroUid ?? '',
      parceiroNome: c.j1ParceiroNome ?? '',
      parceiroFoto: c.j1ParceiroFoto ?? '',
    };
  }
  return {
    uid: c.j2Uid,
    nome: c.j2Nome,
    foto: c.j2Foto,
    parceiroUid: c.j2ParceiroUid ?? '',
    parceiroNome: c.j2ParceiroNome ?? '',
    parceiroFoto: c.j2ParceiroFoto ?? '',
  };
}

function patchSlot(slot: SlotKey, data: ReturnType<typeof lerSlot>) {
  if (slot === 'j1') {
    return {
      j1Uid: data.uid,
      j1Nome: data.nome,
      j1Foto: data.foto,
      j1ParceiroUid: data.parceiroUid,
      j1ParceiroNome: data.parceiroNome,
      j1ParceiroFoto: data.parceiroFoto,
    };
  }
  return {
    j2Uid: data.uid,
    j2Nome: data.nome,
    j2Foto: data.foto,
    j2ParceiroUid: data.parceiroUid,
    j2ParceiroNome: data.parceiroNome,
    j2ParceiroFoto: data.parceiroFoto,
  };
}

function statusAposSlots(j1Uid: string, j2Uid: string): {
  status: ConfrontoStatus;
  vencedorUid: string;
  resultadoTipo?: ResultadoTipo;
} {
  if (j1Uid && j2Uid) return { status: 'pronto', vencedorUid: '' };
  if (j1Uid && !j2Uid) {
    return { status: 'bye', vencedorUid: j1Uid, resultadoTipo: 'bye' };
  }
  if (!j1Uid && j2Uid) {
    return { status: 'bye', vencedorUid: j2Uid, resultadoTipo: 'bye' };
  }
  return { status: 'aguardando', vencedorUid: '' };
}

/** Troca dois slots na chave (organizador). Só se confrontos não finalizados. */
export async function trocarSlotsChave(input: {
  torneioId: string;
  a: { confrontoId: string; slot: SlotKey };
  b: { confrontoId: string; slot: SlotKey };
}): Promise<void> {
  const refA = doc(db, 'torneios', input.torneioId, 'confrontos', input.a.confrontoId);
  const refB = doc(db, 'torneios', input.torneioId, 'confrontos', input.b.confrontoId);
  const [snapA, snapB] = await Promise.all([getDoc(refA), getDoc(refB)]);
  if (!snapA.exists() || !snapB.exists()) throw new Error('Confronto não encontrado');
  const ca = mapConfronto(snapA.id, snapA.data());
  const cb = mapConfronto(snapB.id, snapB.data());
  if (ca.status === 'finalizado' || cb.status === 'finalizado') {
    throw new Error('Não dá para mover jogador de jogo já finalizado.');
  }

  const slotA = lerSlot(ca, input.a.slot);
  const slotB = lerSlot(cb, input.b.slot);

  // Mesmo confronto: só troca j1↔j2
  if (ca.id === cb.id) {
    const s1 = lerSlot(ca, 'j1');
    const s2 = lerSlot(ca, 'j2');
    const stSame = statusAposSlots(s2.uid, s1.uid);
    await updateDoc(refA, {
      ...patchSlot('j1', s2),
      ...patchSlot('j2', s1),
      status: stSame.status,
      vencedorUid: stSame.vencedorUid,
      resultadoTipo: stSame.resultadoTipo ?? '',
      sets: [],
    });
    if (stSame.status === 'bye' && stSame.vencedorUid && ca.nextConfrontoId) {
      await avancarVencedor({
        ...ca,
        j1Uid: s2.uid,
        j2Uid: s1.uid,
        status: 'bye',
        vencedorUid: stSame.vencedorUid,
      });
    }
    return;
  }

  const stA = statusAposSlots(
    input.a.slot === 'j1' ? slotB.uid : ca.j1Uid,
    input.a.slot === 'j2' ? slotB.uid : ca.j2Uid
  );
  const stB = statusAposSlots(
    input.b.slot === 'j1' ? slotA.uid : cb.j1Uid,
    input.b.slot === 'j2' ? slotA.uid : cb.j2Uid
  );

  await updateDoc(refA, {
    ...patchSlot(input.a.slot, slotB),
    status: stA.status,
    vencedorUid: stA.vencedorUid,
    resultadoTipo: stA.resultadoTipo ?? '',
    sets: [],
  });
  await updateDoc(refB, {
    ...patchSlot(input.b.slot, slotA),
    status: stB.status,
    vencedorUid: stB.vencedorUid,
    resultadoTipo: stB.resultadoTipo ?? '',
    sets: [],
  });
}

/** Define (ou limpa) um slot da chave — organizador move quem quiser. */
export async function definirSlotChave(input: {
  torneioId: string;
  confrontoId: string;
  slot: SlotKey;
  jogador: InscritoSlot | null;
}): Promise<void> {
  const ref = doc(db, 'torneios', input.torneioId, 'confrontos', input.confrontoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Confronto não encontrado');
  const c = mapConfronto(snap.id, snap.data());
  if (c.status === 'finalizado') {
    throw new Error('Jogo já finalizado — use W.O. ou refaça a chave.');
  }

  const data = input.jogador
    ? {
        uid: input.jogador.uid,
        nome: input.jogador.nome,
        foto: input.jogador.fotoUrl ?? '',
        parceiroUid: input.jogador.parceiroUid ?? '',
        parceiroNome: input.jogador.parceiroNome ?? '',
        parceiroFoto: input.jogador.parceiroFoto ?? '',
      }
    : {
        uid: '',
        nome: '',
        foto: '',
        parceiroUid: '',
        parceiroNome: '',
        parceiroFoto: '',
      };

  const j1 = input.slot === 'j1' ? data.uid : c.j1Uid;
  const j2 = input.slot === 'j2' ? data.uid : c.j2Uid;
  // Normaliza bye: jogador único sempre em j1
  let patch: Record<string, unknown> = { ...patchSlot(input.slot, data) };
  let st = statusAposSlots(j1, j2);
  if (!j1 && j2) {
    const s2 = input.slot === 'j2' ? data : lerSlot(c, 'j2');
    patch = {
      ...patchSlot('j1', s2),
      ...patchSlot('j2', {
        uid: '',
        nome: '',
        foto: '',
        parceiroUid: '',
        parceiroNome: '',
        parceiroFoto: '',
      }),
    };
    st = { status: 'bye', vencedorUid: s2.uid, resultadoTipo: 'bye' };
  }

  await updateDoc(ref, {
    ...patch,
    status: st.status,
    vencedorUid: st.vencedorUid,
    resultadoTipo: st.resultadoTipo ?? '',
    sets: [],
  });
}

async function aposResultadoGrupo(c: ConfrontoTorneio): Promise<void> {
  try {
    const { tentarPromoverClassificados, lerGruposConfigTorneio } = await import(
      './gruposTorneio'
    );
    const cfg = await lerGruposConfigTorneio(c.torneioId);
    const tSnap = await getDoc(doc(db, 'torneios', c.torneioId));
    const estruturaMata =
      tSnap.data()?.estruturaMata != null
        ? Number(tSnap.data()?.estruturaMata)
        : undefined;
    const r = await tentarPromoverClassificados({
      torneioId: c.torneioId,
      categoriaId: c.categoriaId,
      categoriaNome: c.categoriaNome,
      classificadosPorGrupo: cfg?.classificadosPorGrupo ?? 2,
      estruturaMata,
    });
    if (r.promoveu) {
      console.log('[grupos] mata gerado com', r.classificados, 'classificados');
    }
  } catch (e) {
    console.warn('[grupos] promover', e);
  }
}

async function finalizarCategoriaSeUltimoJogo(
  c: ConfrontoTorneio,
  vencedorUid: string
): Promise<void> {
  const campeaoNome = vencedorUid === c.j1Uid ? c.j1Nome : c.j2Nome;
  const catId = c.categoriaId ?? '';
  const tSnapFim = await getDoc(doc(db, 'torneios', c.torneioId));
  const tRaw = tSnapFim.data() ?? {};
  const todosApos = (
    await getDocs(collection(db, 'torneios', c.torneioId, 'confrontos'))
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
      (x) =>
        (x.categoriaId ?? '') === cid &&
        !x.nextConfrontoId &&
        (x.fase ?? 'mata') === 'mata'
    );
    if (finais.length === 0) return false;
    return finais.every(
      (f) => f.id === c.id || f.status === 'finalizado' || f.status === 'bye'
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
      uid: vencedorUid,
      nome: campeaoNome,
      categoriaId: catId || null,
      categoriaNome: c.categoriaNome ?? null,
      finalizadoEm: serverTimestamp(),
    },
  };
  if (torneioAcabou) {
    patchTorneio.status = 'finalizado';
    patchTorneio.campeaoUid = vencedorUid;
    patchTorneio.campeaoNome = campeaoNome;
    patchTorneio.finalizadoEm = serverTimestamp();
  }
  await updateDoc(doc(db, 'torneios', c.torneioId), patchTorneio);
  await bumpUsuarioStats(vencedorUid, { torneiosVencidos: increment(1) });

  try {
    const torneioNome = String(tRaw.nome ?? 'Torneio');
    const catLabel = c.categoriaNome ? ` (${c.categoriaNome})` : '';
    let corpoFim = torneioAcabou
      ? `${torneioNome} terminou. Campeão: ${campeaoNome}.`
      : `${torneioNome}${catLabel} terminou. Campeão: ${campeaoNome}.`;
    if (torneioAcabou) {
      const tAfter = await getDoc(doc(db, 'torneios', c.torneioId));
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
    const inscSnap = await getDocs(collection(db, 'torneios', c.torneioId, 'inscritos'));
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
        rota: `/torneio/${c.torneioId}`,
        refId: c.torneioId,
      }).catch((e) => console.warn('[torneio] notif fim', e));
    }
  } catch (e) {
    console.warn('[torneio] fim categoria notif', e);
  }
}

async function espelharPartidaEFeed(input: {
  torneioId: string;
  confrontoId: string;
  c: ConfrontoTorneio;
  sets: { j1: number; j2: number }[];
  vencedorUid: string;
  esporte: EsporteId;
  registradoPor: string;
  isWO?: boolean;
}): Promise<void> {
  const { c } = input;
  if (!c.j1Uid || !c.j2Uid) {
    // W.O. sem adversário — só bump vitória
    await bumpUsuarioStats(input.vencedorUid, { vitorias: increment(1) });
    return;
  }

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
    resultadoTipo: input.isWO ? 'wo' : 'placar',
    dataPartida: serverTimestamp(),
  });

  const perdedor = input.vencedorUid === c.j1Uid ? c.j2Uid : c.j1Uid;
  await bumpUsuarioStats(input.vencedorUid, { vitorias: increment(1) });
  await bumpUsuarioStats(perdedor, { derrotas: increment(1) });

  const placar = input.isWO
    ? 'W.O.'
    : input.sets.map((s) => `${s.j1}-${s.j2}`).join(', ');
  const vencedorNome = input.vencedorUid === c.j1Uid ? c.j1Nome : c.j2Nome;
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
export function normalizarHorarioAgenda(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function uidsParticipantesConfronto(c: ConfrontoTorneio): string[] {
  return [c.j1Uid, c.j2Uid, c.j1ParceiroUid, c.j2ParceiroUid].filter(
    (u): u is string => Boolean(u)
  );
}

export type ConflitoAgendaTorneio = {
  confrontoId: string;
  labelRodada: string;
  categoriaNome?: string;
  j1Nome: string;
  j2Nome: string;
  jogadorUid: string;
  jogadorNome: string;
  dataHoraInicio: string;
};

/**
 * Conflito se o mesmo atleta aparece em outro confronto (qualquer categoria)
 * com o mesmo horário (texto normalizado). Útil em chuva / multi-categoria.
 */
export function detectarConflitosAgendaConfronto(
  confrontos: ConfrontoTorneio[],
  confrontoId: string,
  dataHoraInicio: string
): ConflitoAgendaTorneio[] {
  const hora = normalizarHorarioAgenda(dataHoraInicio);
  if (!hora) return [];
  const alvo = confrontos.find((c) => c.id === confrontoId);
  if (!alvo || alvo.status === 'bye' || alvo.status === 'finalizado') return [];

  const uidsAlvo = new Set(uidsParticipantesConfronto(alvo));
  if (uidsAlvo.size === 0) return [];

  const nomePorUid = new Map<string, string>();
  if (alvo.j1Uid) nomePorUid.set(alvo.j1Uid, alvo.j1Nome);
  if (alvo.j2Uid) nomePorUid.set(alvo.j2Uid, alvo.j2Nome);
  if (alvo.j1ParceiroUid) {
    nomePorUid.set(alvo.j1ParceiroUid, alvo.j1ParceiroNome || alvo.j1Nome);
  }
  if (alvo.j2ParceiroUid) {
    nomePorUid.set(alvo.j2ParceiroUid, alvo.j2ParceiroNome || alvo.j2Nome);
  }

  const out: ConflitoAgendaTorneio[] = [];
  for (const c of confrontos) {
    if (c.id === confrontoId) continue;
    if (c.status === 'bye' || c.status === 'finalizado') continue;
    if (normalizarHorarioAgenda(c.dataHoraInicio ?? '') !== hora) continue;
    for (const uid of uidsParticipantesConfronto(c)) {
      if (!uidsAlvo.has(uid)) continue;
      out.push({
        confrontoId: c.id,
        labelRodada: c.labelRodada,
        categoriaNome: c.categoriaNome,
        j1Nome: c.j1Nome,
        j2Nome: c.j2Nome,
        jogadorUid: uid,
        jogadorNome: nomePorUid.get(uid) || uid,
        dataHoraInicio: c.dataHoraInicio || dataHoraInicio,
      });
    }
  }
  return out;
}

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
    for (const u of uidsParticipantesConfronto(c)) {
      void getDoc(doc(db, 'usuarios', u))
        .then((uSnap) => {
          if (!uSnap.exists()) return;
          return criarNotificacao({
            paraUid: u,
            tipo: 'sistema',
            titulo: 'Jogo lançado no torneio',
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

/** Preenche horário/quadra só nos confrontos ainda sem horário (exceto bye/finalizado). */
export async function aplicarHorarioPadraoConfrontos(
  torneioId: string,
  data: { dataHoraInicio: string; quadraNome?: string },
  confrontos: ConfrontoTorneio[]
): Promise<number> {
  const hora = data.dataHoraInicio.trim();
  if (!hora) throw new Error('Informe o horário padrão.');
  const quadra = data.quadraNome?.trim() ?? '';
  let n = 0;
  for (const c of confrontos) {
    if (c.status === 'bye' || c.status === 'finalizado') continue;
    if (normalizarHorarioAgenda(c.dataHoraInicio ?? '')) continue;
    await atualizarAgendaConfronto(torneioId, c.id, {
      dataHoraInicio: hora,
      quadraNome: quadra || c.quadraNome || '',
    });
    n += 1;
  }
  return n;
}

/**
 * Chuva / reagendamento: move só jogos NÃO finalizados para nova data.
 * Jogos já realizados ficam intactos.
 * - Se `redistribuir`: remonta horários a partir da nova data + horário base (por rodada).
 * - Senão: só troca a data no rótulo, mantendo o horário de cada jogo.
 */
export async function remarcarConfrontosPendentes(
  torneioId: string,
  confrontos: ConfrontoTorneio[],
  opts: {
    novaDataBR: string;
    /** HH:MM — obrigatório se redistribuir; senão fallback quando o jogo não tinha hora */
    novoHorarioHHMM?: string;
    quadraNome?: string;
    redistribuir?: boolean;
    intervaloJogosMin?: number;
    atribuirQuadras?: boolean;
    quadrasDisponiveis?: string[];
  }
): Promise<number> {
  const {
    trocarDataNoRotuloAgenda,
    calcularAgendaChaveamento,
    parseBaseAgendaTorneio,
    formatAgendaTorneio,
    offsetCategoriaAgendaMin,
  } = await import('../utils/agendaTorneio');

  const pendentes = confrontos.filter(
    (c) => c.status !== 'bye' && c.status !== 'finalizado'
  );
  if (pendentes.length === 0) return 0;

  const horaBase = (opts.novoHorarioHHMM || '09:00').trim();
  const quadra = opts.quadraNome?.trim();
  let intervalo = opts.intervaloJogosMin;
  let atribuir = opts.atribuirQuadras;
  let quadras = opts.quadrasDisponiveis;
  if (intervalo == null || atribuir == null || quadras == null) {
    try {
      const tSnap = await getDoc(doc(db, 'torneios', torneioId));
      const td = tSnap.data() || {};
      if (intervalo == null) intervalo = Number(td.intervaloJogosMin) || 60;
      if (atribuir == null) atribuir = Boolean(td.atribuirQuadrasAoSortear);
      if (quadras == null && Array.isArray(td.quadrasDisponiveis)) {
        quadras = (td.quadrasDisponiveis as unknown[])
          .map((q) => String(q ?? '').trim())
          .filter(Boolean);
      }
    } catch {
      /* ignore */
    }
  }
  const gap = Math.max(15, Number(intervalo) || 60);

  if (opts.redistribuir) {
    const base = parseBaseAgendaTorneio(opts.novaDataBR, horaBase);
    if (!base) throw new Error('Data/horário inválidos. Use DD/MM/AAAA e HH:MM.');
    const porCat = new Map<string, ConfrontoTorneio[]>();
    for (const c of pendentes) {
      const k = c.categoriaId || '_';
      const list = porCat.get(k) ?? [];
      list.push(c);
      porCat.set(k, list);
    }
    let catIdx = 0;
    let n = 0;
    for (const [, lista] of porCat) {
      const agenda = calcularAgendaChaveamento({
        dataInicio: opts.novaDataBR,
        horarioPadrao: horaBase,
        slots: lista.map((c) => ({
          id: c.id,
          round: c.round,
          pos: c.pos,
          status: c.status,
        })),
        intervaloJogoMin: gap,
        offsetCategoriaMin: offsetCategoriaAgendaMin(catIdx, gap),
        atribuirQuadras: Boolean(atribuir),
        quadras: quadras ?? [],
        quadraUnica: quadra,
      });
      if (agenda.size === 0) {
        for (const c of lista) {
          await atualizarAgendaConfronto(torneioId, c.id, {
            dataHoraInicio: formatAgendaTorneio(
              new Date(base.getTime() + catIdx * Math.min(45, gap) * 60_000)
            ),
            quadraNome: atribuir
              ? (quadra ?? c.quadraNome ?? '')
              : c.quadraNome ?? '',
          });
          n += 1;
        }
      } else {
        for (const c of lista) {
          const slot = agenda.get(c.id);
          if (!slot) continue;
          await atualizarAgendaConfronto(torneioId, c.id, {
            dataHoraInicio: slot.hora,
            quadraNome:
              slot.quadra ??
              (atribuir ? quadra ?? '' : c.quadraNome ?? ''),
          });
          n += 1;
        }
      }
      catIdx += 1;
    }
    return n;
  }

  let n = 0;
  for (const c of pendentes) {
    const novo = trocarDataNoRotuloAgenda(
      c.dataHoraInicio ?? '',
      opts.novaDataBR,
      horaBase
    );
    await atualizarAgendaConfronto(torneioId, c.id, {
      dataHoraInicio: novo,
      quadraNome: c.quadraNome ?? quadra ?? '',
    });
    n += 1;
  }
  return n;
}
