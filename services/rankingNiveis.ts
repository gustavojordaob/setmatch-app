import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import {
  mesCivilAtual,
} from './rankings';
import type {
  Classificacao,
  RankingNivel,
  RankingNiveisConfig,
} from '../types/ranking';
import {
  nivelMaisBaixo,
  normalizarNiveisConfig,
} from '../types/ranking';

export type MovimentacaoItem = {
  uid: string;
  nome: string;
  deNivelId: string;
  deNivelNome: string;
  paraNivelId: string;
  paraNivelNome: string;
  motivo: 'sobe' | 'cai';
  pts: number;
};

export type PreviewMovimentacao = {
  movimentos: MovimentacaoItem[];
  mes: string;
};

/** Salva config de níveis no ranking (dono). */
export async function salvarNiveisRanking(
  rankingId: string,
  config: RankingNiveisConfig
): Promise<void> {
  const niveis = normalizarNiveisConfig(config);
  if (niveis.ativo && niveis.niveis.length < 2) {
    throw new Error('Ative com pelo menos 2 níveis (ex.: A e B).');
  }
  const ids = new Set(niveis.niveis.map((n) => n.id));
  if (ids.size !== niveis.niveis.length) {
    throw new Error('Cada nível precisa de um id único.');
  }

  await updateDoc(doc(db, 'rankings', rankingId), {
    niveis,
    atualizadoEm: serverTimestamp(),
  });

  if (!niveis.ativo) return;

  // Garante que todo jogador tenha nivelId (default = mais baixo).
  const baixo = nivelMaisBaixo(niveis.niveis);
  if (!baixo) return;
  const snap = await getDocs(collection(db, 'rankings', rankingId, 'classificacao'));
  const batch = writeBatch(db);
  let n = 0;
  for (const d of snap.docs) {
    const raw = d.data();
    const atual = raw.nivelId ? String(raw.nivelId) : '';
    if (atual && ids.has(atual)) continue;
    batch.update(d.ref, { nivelId: baixo.id });
    n += 1;
    if (n >= 400) break;
  }
  if (n > 0) await batch.commit();
}

/** Dono move um jogador para outro nível (manual). */
export async function moverJogadorNivel(input: {
  rankingId: string;
  uid: string;
  paraNivelId: string;
  zerarPts?: boolean;
}): Promise<void> {
  const rankingSnap = await getDoc(doc(db, 'rankings', input.rankingId));
  if (!rankingSnap.exists()) throw new Error('Ranking não encontrado.');
  const cfg = normalizarNiveisConfig(
    rankingSnap.data()?.niveis as RankingNiveisConfig | undefined
  );
  if (!cfg.ativo) throw new Error('Níveis não estão ativos neste ranking.');
  const alvo = cfg.niveis.find((n) => n.id === input.paraNivelId);
  if (!alvo) throw new Error('Nível inválido.');

  const patch: Record<string, unknown> = { nivelId: alvo.id };
  if (input.zerarPts) patch.pts = 0;
  await updateDoc(
    doc(db, 'rankings', input.rankingId, 'classificacao', input.uid),
    patch
  );
}

/**
 * Dono coloca um usuário diretamente num nível do ranking.
 * Se ainda não for membro, entra no ranking + classificação nesse nível.
 */
export async function colocarUsuarioNoNivel(input: {
  rankingId: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
  nivelId: string;
  zerarPts?: boolean;
}): Promise<'criado' | 'movido'> {
  const rankingRef = doc(db, 'rankings', input.rankingId);
  const rankingSnap = await getDoc(rankingRef);
  if (!rankingSnap.exists()) throw new Error('Ranking não encontrado.');
  const raw = rankingSnap.data();
  const cfg = normalizarNiveisConfig(raw?.niveis as RankingNiveisConfig | undefined);
  if (!cfg.ativo) throw new Error('Ative os níveis deste ranking antes.');
  const alvo = cfg.niveis.find((n) => n.id === input.nivelId);
  if (!alvo) throw new Error('Nível inválido.');

  const membros = (raw.membros as string[]) ?? [];
  const jaMembro = membros.includes(input.uid);
  const classRef = doc(db, 'rankings', input.rankingId, 'classificacao', input.uid);
  const classSnap = await getDoc(classRef);

  if (!jaMembro) {
    await updateDoc(rankingRef, {
      membros: arrayUnion(input.uid),
      totalMembros: increment(1),
      atualizadoEm: serverTimestamp(),
    });
  }

  if (!classSnap.exists()) {
    const pag = raw.pagamento as
      | { ativo?: boolean; valor?: number; exigeParaEntrar?: boolean }
      | undefined;
    const precisaPagar = Boolean(
      pag?.ativo && pag?.exigeParaEntrar && (pag.valor ?? 0) > 0
    );
    await setDoc(classRef, {
      uid: input.uid,
      nome: input.nome,
      fotoUrl: input.fotoUrl ?? '',
      pts: 0,
      vitorias: 0,
      derrotas: 0,
      nivelId: alvo.id,
      pagamentoOk: !precisaPagar,
    });
    return 'criado';
  }

  const patch: Record<string, unknown> = {
    nivelId: alvo.id,
    nome: input.nome || classSnap.data()?.nome,
  };
  if (input.fotoUrl) patch.fotoUrl = input.fotoUrl;
  if (input.zerarPts) patch.pts = 0;
  await updateDoc(classRef, patch);
  return jaMembro ? 'movido' : 'criado';
}

/**
 * Calcula sobe/desce entre níveis adjacentes a partir do snapshot atual.
 * Top N do nível inferior sobem; bottom M do nível superior caem.
 */
export function calcularMovimentacao(
  niveis: RankingNivel[],
  rows: Classificacao[]
): MovimentacaoItem[] {
  const ordenados = [...niveis].sort((a, b) => a.ordem - b.ordem);
  if (ordenados.length < 2) return [];

  const porNivel = new Map<string, Classificacao[]>();
  for (const n of ordenados) porNivel.set(n.id, []);
  const fallback = ordenados[ordenados.length - 1].id;
  for (const r of rows) {
    const nid = r.nivelId && porNivel.has(r.nivelId) ? r.nivelId : fallback;
    porNivel.get(nid)!.push(r);
  }
  for (const [, list] of porNivel) {
    list.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
  }

  const moves = new Map<string, MovimentacaoItem>();

  for (let i = 0; i < ordenados.length - 1; i++) {
    const upper = ordenados[i];
    const lower = ordenados[i + 1];
    const upperRows = porNivel.get(upper.id) ?? [];
    const lowerRows = porNivel.get(lower.id) ?? [];

    const qCai = Math.min(upper.caiQuantos, upperRows.length);
    const qSobe = Math.min(lower.sobeQuantos, lowerRows.length);

    const caem = upperRows.slice(Math.max(0, upperRows.length - qCai));
    const sobem = lowerRows.slice(0, qSobe);

    for (const p of caem) {
      moves.set(p.uid, {
        uid: p.uid,
        nome: p.nome,
        deNivelId: upper.id,
        deNivelNome: upper.nome,
        paraNivelId: lower.id,
        paraNivelNome: lower.nome,
        motivo: 'cai',
        pts: p.pts ?? 0,
      });
    }
    for (const p of sobem) {
      // Se já estava marcado para cair no mesmo ciclo (improvável), sobe prevalece? Keep last.
      moves.set(p.uid, {
        uid: p.uid,
        nome: p.nome,
        deNivelId: lower.id,
        deNivelNome: lower.nome,
        paraNivelId: upper.id,
        paraNivelNome: upper.nome,
        motivo: 'sobe',
        pts: p.pts ?? 0,
      });
    }
  }

  return [...moves.values()];
}

export async function previewMovimentacaoRanking(
  rankingId: string
): Promise<PreviewMovimentacao> {
  const rankingSnap = await getDoc(doc(db, 'rankings', rankingId));
  if (!rankingSnap.exists()) throw new Error('Ranking não encontrado.');
  const cfg = normalizarNiveisConfig(
    rankingSnap.data()?.niveis as RankingNiveisConfig | undefined
  );
  if (!cfg.ativo) throw new Error('Níveis não ativos.');
  const snap = await getDocs(collection(db, 'rankings', rankingId, 'classificacao'));
  const rows = snap.docs.map((d) => d.data() as Classificacao);
  return {
    movimentos: calcularMovimentacao(cfg.niveis, rows),
    mes: mesCivilAtual(),
  };
}

/**
 * Aplica rodada de sobe/desce (manual ou chamada pela CF).
 * Zera pts de quem mudou de nível. Registra ultimaMovimentacaoMes.
 */
export async function aplicarMovimentacaoRanking(
  rankingId: string,
  opts?: { forcarMes?: boolean }
): Promise<{ aplicados: number; mes: string }> {
  const rankingRef = doc(db, 'rankings', rankingId);
  const rankingSnap = await getDoc(rankingRef);
  if (!rankingSnap.exists()) throw new Error('Ranking não encontrado.');
  const raw = rankingSnap.data();
  const cfg = normalizarNiveisConfig(raw?.niveis as RankingNiveisConfig | undefined);
  if (!cfg.ativo) throw new Error('Níveis não ativos.');

  const mes = mesCivilAtual();
  if (!opts?.forcarMes && cfg.ultimaMovimentacaoMes === mes) {
    throw new Error('Movimentação deste mês já foi aplicada. Use forçar se quiser de novo.');
  }

  const preview = await previewMovimentacaoRanking(rankingId);
  if (preview.movimentos.length === 0) {
    await updateDoc(rankingRef, {
      'niveis.ultimaMovimentacaoMes': mes,
      atualizadoEm: serverTimestamp(),
    });
    return { aplicados: 0, mes };
  }

  const batch = writeBatch(db);
  for (const m of preview.movimentos) {
    batch.update(doc(db, 'rankings', rankingId, 'classificacao', m.uid), {
      nivelId: m.paraNivelId,
      pts: 0,
    });
  }
  batch.update(rankingRef, {
    'niveis.ultimaMovimentacaoMes': mes,
    atualizadoEm: serverTimestamp(),
  });
  await batch.commit();
  return { aplicados: preview.movimentos.length, mes };
}

export function nivelIdEntradaPadrao(cfg: RankingNiveisConfig): string | undefined {
  if (!cfg.ativo) return undefined;
  return nivelMaisBaixo(cfg.niveis)?.id;
}
