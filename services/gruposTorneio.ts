/**
 * Fase de grupos + promoção ao mata-mata.
 * Confrontos de grupo usam a mesma coleção `confrontos` com fase: 'grupo'.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { GruposConfig } from '../constants/chaveamentosTorneio';
import { shuffleFisherYates, proximaPotenciaDe2 } from '../utils/chaveamento';
import {
  apagarChaveamentoCategoria,
  gerarChaveamento,
  listarInscritosTorneio,
  type InscritoSlot,
  type ConfrontoTorneio,
} from './chaveamentoTorneio';

const LABELS_GRUPO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type LinhaClassificacao = {
  uid: string;
  nome: string;
  foto?: string;
  jogados: number;
  vitorias: number;
  derrotas: number;
  setsPro: number;
  setsContra: number;
  gamesPro: number;
  gamesContra: number;
  pontos: number;
};

function mapConfrontoLeve(id: string, raw: Record<string, unknown>): ConfrontoTorneio {
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
    status: (raw.status as ConfrontoTorneio['status']) ?? 'aguardando',
    sets: (raw.sets as { j1: number; j2: number }[]) ?? [],
    vencedorUid: String(raw.vencedorUid ?? ''),
    nextConfrontoId: String(raw.nextConfrontoId ?? ''),
    nextSlot: (raw.nextSlot as 'j1' | 'j2' | '') ?? '',
    fase: (raw.fase as 'grupo' | 'mata') ?? 'mata',
    grupoId: raw.grupoId ? String(raw.grupoId) : undefined,
    grupoNome: raw.grupoNome ? String(raw.grupoNome) : undefined,
    resultadoTipo: raw.resultadoTipo as ConfrontoTorneio['resultadoTipo'],
  };
}

export function distribuirEmGrupos(
  inscritos: InscritoSlot[],
  qtdGrupos: number,
  sortear: boolean
): InscritoSlot[][] {
  const n = Math.max(1, Math.min(qtdGrupos, inscritos.length));
  const list = sortear ? shuffleFisherYates(inscritos) : [...inscritos];
  const grupos: InscritoSlot[][] = Array.from({ length: n }, () => []);
  list.forEach((p, i) => {
    grupos[i % n].push(p);
  });
  return grupos.filter((g) => g.length > 0);
}

function paresRoundRobin(membros: InscritoSlot[]): [InscritoSlot, InscritoSlot][] {
  const pares: [InscritoSlot, InscritoSlot][] = [];
  for (let i = 0; i < membros.length; i++) {
    for (let j = i + 1; j < membros.length; j++) {
      pares.push([membros[i], membros[j]]);
    }
  }
  return pares;
}

/** Classificação de um grupo a partir dos confrontos finalizados. */
export function classificarGrupo(
  membros: InscritoSlot[],
  confrontos: ConfrontoTorneio[]
): LinhaClassificacao[] {
  const map = new Map<string, LinhaClassificacao>();
  for (const m of membros) {
    map.set(m.uid, {
      uid: m.uid,
      nome: m.nome,
      foto: m.fotoUrl,
      jogados: 0,
      vitorias: 0,
      derrotas: 0,
      setsPro: 0,
      setsContra: 0,
      gamesPro: 0,
      gamesContra: 0,
      pontos: 0,
    });
  }

  for (const c of confrontos) {
    if (c.status !== 'finalizado' && c.status !== 'bye') continue;
    if (!c.j1Uid || !c.vencedorUid) continue;
    const a = map.get(c.j1Uid);
    const b = c.j2Uid ? map.get(c.j2Uid) : undefined;
    if (!a) continue;

    if (c.status === 'bye' || c.resultadoTipo === 'wo') {
      a.jogados += 1;
      a.vitorias += 1;
      a.pontos += 1;
      if (b && c.j2Uid && c.vencedorUid !== c.j2Uid) {
        b.jogados += 1;
        b.derrotas += 1;
      }
      continue;
    }

    if (!b || !c.j2Uid) continue;
    a.jogados += 1;
    b.jogados += 1;
    let setsJ1 = 0;
    let setsJ2 = 0;
    for (const s of c.sets) {
      a.gamesPro += s.j1;
      a.gamesContra += s.j2;
      b.gamesPro += s.j2;
      b.gamesContra += s.j1;
      if (s.j1 > s.j2) setsJ1 += 1;
      else if (s.j2 > s.j1) setsJ2 += 1;
    }
    a.setsPro += setsJ1;
    a.setsContra += setsJ2;
    b.setsPro += setsJ2;
    b.setsContra += setsJ1;
    if (c.vencedorUid === c.j1Uid) {
      a.vitorias += 1;
      a.pontos += 1;
      b.derrotas += 1;
    } else {
      b.vitorias += 1;
      b.pontos += 1;
      a.derrotas += 1;
    }
  }

  return [...map.values()].sort((x, y) => {
    if (y.pontos !== x.pontos) return y.pontos - x.pontos;
    const sx = x.setsPro - x.setsContra;
    const sy = y.setsPro - y.setsContra;
    if (sy !== sx) return sy - sx;
    const gx = x.gamesPro - x.gamesContra;
    const gy = y.gamesPro - y.gamesContra;
    if (gy !== gx) return gy - gx;
    return x.nome.localeCompare(y.nome, 'pt-BR');
  });
}

export async function listarConfrontosCategoria(
  torneioId: string,
  categoriaId?: string
): Promise<ConfrontoTorneio[]> {
  const snap = await getDocs(collection(db, 'torneios', torneioId, 'confrontos'));
  const catId = categoriaId?.trim() || '';
  return snap.docs
    .map((d) => mapConfrontoLeve(d.id, d.data()))
    .filter((c) => {
      if (!catId) return !c.categoriaId;
      return c.categoriaId === catId || c.id.startsWith(`${catId}-`);
    });
}

/**
 * Gera fase de grupos (todos contra todos dentro de cada grupo).
 * Não cria mata ainda — só após todos os jogos de grupo.
 */
export async function gerarFaseGrupos(input: {
  torneioId: string;
  categoriaId?: string;
  categoriaNome?: string;
  gruposConfig: GruposConfig;
  sortear?: boolean;
  forcar?: boolean;
}): Promise<{ grupos: number; jogos: number }> {
  const catId = input.categoriaId?.trim() || '';
  const existentes = await listarConfrontosCategoria(input.torneioId, catId || undefined);
  if (existentes.length > 0) {
    if (input.forcar) {
      await apagarChaveamentoCategoria(input.torneioId, catId || undefined);
    } else {
      throw new Error(
        catId
          ? 'Já existe chave/grupos nesta categoria. Use Refazer.'
          : 'Já existe chave/grupos. Use Refazer.'
      );
    }
  }

  const inscritos = await listarInscritosTorneio(input.torneioId, catId || undefined);
  if (inscritos.length < 2) {
    throw new Error('Precisa de pelo menos 2 inscritos confirmados.');
  }

  const cfg = input.gruposConfig;
  const qtd = Math.max(1, Math.min(cfg.qtdGrupos || 2, inscritos.length));
  const grupos = distribuirEmGrupos(inscritos, qtd, input.sortear !== false);
  const batch = writeBatch(db);
  const col = collection(db, 'torneios', input.torneioId, 'confrontos');
  let jogos = 0;
  const gruposMeta: {
    id: string;
    nome: string;
    membrosUids: string[];
  }[] = [];

  grupos.forEach((membros, gi) => {
    const letra = LABELS_GRUPO[gi] ?? String(gi + 1);
    const grupoId = catId ? `${catId}-g${letra}` : `g${letra}`;
    const grupoNome = `Grupo ${letra}`;
    gruposMeta.push({
      id: grupoId,
      nome: grupoNome,
      membrosUids: membros.map((m) => m.uid),
    });

    const pares = paresRoundRobin(membros);
    pares.forEach(([a, b], pi) => {
      const id = `${grupoId}-m${pi}`;
      batch.set(doc(col, id), {
        torneioId: input.torneioId,
        categoriaId: catId,
        categoriaNome: input.categoriaNome ?? '',
        fase: 'grupo',
        grupoId,
        grupoNome,
        round: 1,
        pos: pi,
        labelRodada: grupoNome,
        j1Uid: a.uid,
        j1Nome: a.nome,
        j1Foto: a.fotoUrl ?? '',
        j1ParceiroUid: a.parceiroUid ?? '',
        j1ParceiroNome: a.parceiroNome ?? '',
        j1ParceiroFoto: a.parceiroFoto ?? '',
        j2Uid: b.uid,
        j2Nome: b.nome,
        j2Foto: b.fotoUrl ?? '',
        j2ParceiroUid: b.parceiroUid ?? '',
        j2ParceiroNome: b.parceiroNome ?? '',
        j2ParceiroFoto: b.parceiroFoto ?? '',
        status: 'pronto',
        sets: [],
        vencedorUid: '',
        nextConfrontoId: '',
        nextSlot: '',
        resultadoTipo: '',
        criadoEm: serverTimestamp(),
      });
      jogos += 1;
    });
  });

  await batch.commit();

  await updateDoc(doc(db, 'torneios', input.torneioId), {
    chaveLiberada: true,
    faseTorneio: 'grupos',
    [`gruposPorCategoria.${catId || 'geral'}`]: {
      config: cfg,
      grupos: gruposMeta,
      status: 'em_andamento',
      atualizadoEm: serverTimestamp(),
    },
  });

  return { grupos: grupos.length, jogos };
}

export function extrairMembrosDosConfrontos(
  confrontosGrupo: ConfrontoTorneio[]
): Map<string, { nome: string; grupoId: string; grupoNome: string; foto?: string }> {
  const map = new Map<
    string,
    { nome: string; grupoId: string; grupoNome: string; foto?: string }
  >();
  for (const c of confrontosGrupo) {
    const gid = c.grupoId ?? '';
    const gnome = c.grupoNome ?? 'Grupo';
    if (c.j1Uid) {
      map.set(c.j1Uid, {
        nome: c.j1Nome,
        grupoId: gid,
        grupoNome: gnome,
        foto: c.j1Foto || undefined,
      });
    }
    if (c.j2Uid) {
      map.set(c.j2Uid, {
        nome: c.j2Nome,
        grupoId: gid,
        grupoNome: gnome,
        foto: c.j2Foto || undefined,
      });
    }
  }
  return map;
}

export function montarTabelasGrupos(
  confrontos: ConfrontoTorneio[]
): {
  grupoId: string;
  grupoNome: string;
  tabela: LinhaClassificacao[];
  jogos: ConfrontoTorneio[];
  completo: boolean;
}[] {
  const gruposOnly = confrontos.filter((c) => (c.fase ?? 'mata') === 'grupo');
  const byGrupo = new Map<string, ConfrontoTorneio[]>();
  for (const c of gruposOnly) {
    const id = c.grupoId ?? 'x';
    if (!byGrupo.has(id)) byGrupo.set(id, []);
    byGrupo.get(id)!.push(c);
  }

  const membrosAll = extrairMembrosDosConfrontos(gruposOnly);
  const out: {
    grupoId: string;
    grupoNome: string;
    tabela: LinhaClassificacao[];
    jogos: ConfrontoTorneio[];
    completo: boolean;
  }[] = [];

  for (const [grupoId, jogos] of byGrupo) {
    const membros: InscritoSlot[] = [];
    const seen = new Set<string>();
    for (const c of jogos) {
      for (const uid of [c.j1Uid, c.j2Uid]) {
        if (!uid || seen.has(uid)) continue;
        seen.add(uid);
        const m = membrosAll.get(uid);
        membros.push({
          uid,
          nome: m?.nome ?? uid,
          fotoUrl: m?.foto,
        });
      }
    }
    const tabela = classificarGrupo(membros, jogos);
    const completo = jogos.every(
      (j) => j.status === 'finalizado' || j.status === 'bye'
    );
    out.push({
      grupoId,
      grupoNome: jogos[0]?.grupoNome ?? grupoId,
      tabela,
      jogos: [...jogos].sort((a, b) => a.pos - b.pos),
      completo,
    });
  }

  out.sort((a, b) => a.grupoNome.localeCompare(b.grupoNome, 'pt-BR'));
  return out;
}

/**
 * Se todos os jogos de grupo da categoria terminaram, gera o mata-mata
 * com os classificados (classificadosPorGrupo por grupo).
 */
export async function tentarPromoverClassificados(input: {
  torneioId: string;
  categoriaId?: string;
  categoriaNome?: string;
  classificadosPorGrupo: number;
  estruturaMata?: number;
  forcar?: boolean;
}): Promise<{ promoveu: boolean; classificados: number; motivo?: string }> {
  const catId = input.categoriaId?.trim() || '';
  const todos = await listarConfrontosCategoria(input.torneioId, catId || undefined);
  const grupos = montarTabelasGrupos(todos);
  if (grupos.length === 0) {
    return { promoveu: false, classificados: 0, motivo: 'Sem fase de grupos.' };
  }
  if (!grupos.every((g) => g.completo)) {
    return {
      promoveu: false,
      classificados: 0,
      motivo: 'Ainda há jogos de grupo em aberto.',
    };
  }

  const jaTemMata = todos.some((c) => (c.fase ?? 'mata') === 'mata');
  if (jaTemMata && !input.forcar) {
    return { promoveu: false, classificados: 0, motivo: 'Mata-mata já gerado.' };
  }

  // Apaga só confrontos de mata se forçar; mantém grupos
  if (jaTemMata && input.forcar) {
    const batch = writeBatch(db);
    let n = 0;
    for (const c of todos) {
      if ((c.fase ?? 'mata') !== 'mata') continue;
      batch.delete(doc(db, 'torneios', input.torneioId, 'confrontos', c.id));
      n += 1;
    }
    if (n > 0) await batch.commit();
  }

  const nClass = Math.max(1, input.classificadosPorGrupo || 2);
  const classificados: InscritoSlot[] = [];
  // Snake: 1ºA, 1ºB, … depois 2ºB, 2ºA… (evita mesmo grupo se enfrentar cedo)
  const porPos: InscritoSlot[][] = [];
  for (let pos = 0; pos < nClass; pos++) {
    const fila: InscritoSlot[] = [];
    const ordem = pos % 2 === 0 ? grupos : [...grupos].reverse();
    for (const g of ordem) {
      const linha = g.tabela[pos];
      if (!linha) continue;
      fila.push({
        uid: linha.uid,
        nome: linha.nome,
        fotoUrl: linha.foto,
      });
    }
    porPos.push(fila);
  }
  for (const fila of porPos) classificados.push(...fila);

  if (classificados.length < 2) {
    throw new Error('Menos de 2 classificados — ajuste os grupos.');
  }

  // Monta slots manuais na ordem dos classificados (+ byes)
  const tamanho = proximaPotenciaDe2(
    Math.max(classificados.length, input.estruturaMata ?? 2)
  );
  const slotsManuais: (string | null)[] = Array.from({ length: tamanho }, () => null);
  classificados.forEach((p, i) => {
    slotsManuais[i] = p.uid;
  });

  // Garante inscritos “virtuais” já estão na lista via confrontos; gerarChaveamento
  // lê inscritos do torneio — os classificados precisam estar inscritos (estão).
  await gerarChaveamento({
    torneioId: input.torneioId,
    donoUid: '',
    estruturaMata: tamanho,
    sortear: false,
    categoriaId: catId || undefined,
    categoriaNome: input.categoriaNome,
    slotsManuais,
    forcar: false,
    fase: 'mata',
    pularCheckExistenteGrupos: true,
  });

  await updateDoc(doc(db, 'torneios', input.torneioId), {
    faseTorneio: 'mata',
    [`gruposPorCategoria.${catId || 'geral'}.status`]: 'promovido',
    [`gruposPorCategoria.${catId || 'geral'}.promovidoEm`]: serverTimestamp(),
  });

  return { promoveu: true, classificados: classificados.length };
}

/** Lê config de grupos do doc do torneio. */
export async function lerGruposConfigTorneio(
  torneioId: string
): Promise<GruposConfig | null> {
  const snap = await getDoc(doc(db, 'torneios', torneioId));
  if (!snap.exists()) return null;
  const raw = snap.data()?.gruposConfig;
  if (!raw || typeof raw !== 'object') return null;
  return {
    qtdGrupos: Number((raw as GruposConfig).qtdGrupos) || 2,
    jogadoresPorGrupo: Number((raw as GruposConfig).jogadoresPorGrupo) || 4,
    classificadosPorGrupo: Number((raw as GruposConfig).classificadosPorGrupo) || 2,
  };
}
