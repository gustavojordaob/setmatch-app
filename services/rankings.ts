import {
  addDoc,
  arrayUnion,
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
import type { EsporteId } from '../constants/esportes';
import type { Classificacao, RankingRegrasJogo, Solicitacao } from '../types/ranking';
import { REGRAS_JOGO_PADRAO } from '../types/ranking';

interface CriarClubeInput {
  nome: string;
  cidade: string;
  esporte: EsporteId;
  donoUid: string;
  donoNome: string;
  donoFotoUrl?: string;
  rankingNome: string;
}

/** Dono de academia cria um clube + o primeiro ranking, entrando como membro inicial. */
export async function criarClubeComRanking(input: CriarClubeInput): Promise<{
  clubeId: string;
  rankingId: string;
}> {
  const clubeRef = await addDoc(collection(db, 'clubes'), {
    nome: input.nome.trim(),
    cidade: input.cidade.trim(),
    esporte: input.esporte,
    donoUid: input.donoUid,
    donoNome: input.donoNome,
    criadoEm: serverTimestamp(),
  });

  const rankingRef = await addDoc(collection(db, 'rankings'), {
    nome: input.rankingNome.trim(),
    clubeId: clubeRef.id,
    clubeNome: input.nome.trim(),
    cidade: input.cidade.trim(),
    esporte: input.esporte,
    donoUid: input.donoUid,
    membros: [input.donoUid],
    totalMembros: 1,
    criadoEm: serverTimestamp(),
  });

  await setDoc(doc(db, 'rankings', rankingRef.id, 'classificacao', input.donoUid), {
    uid: input.donoUid,
    nome: input.donoNome,
    fotoUrl: input.donoFotoUrl ?? '',
    pts: 0,
    vitorias: 0,
    derrotas: 0,
  });

  return { clubeId: clubeRef.id, rankingId: rankingRef.id };
}

interface SolicitarInput {
  rankingId: string;
  rankingNome: string;
  clubeId: string;
  clubeNome: string;
  donoUid: string;
  uid: string;
  nome: string;
  fotoUrl?: string;
  /** Duplas: parceiro convidado */
  parceiroUid?: string;
  parceiroNome?: string;
  parceiroBusca?: string;
}

/** Jogador solicita entrada num ranking. Evita duplicar solicitação pendente. */
export async function solicitarEntrada(input: SolicitarInput): Promise<void> {
  const rankingSnap = await getDoc(doc(db, 'rankings', input.rankingId));
  const composicao = rankingSnap.exists()
    ? String(rankingSnap.data()?.composicao ?? 'simples')
    : 'simples';

  if (composicao === 'dupla' && (!input.parceiroUid || !input.parceiroNome)) {
    throw new Error('Este ranking é de duplas — informe o parceiro (e-mail ou ID).');
  }

  const existentes = await getDocs(
    query(
      collection(db, 'solicitacoes'),
      where('rankingId', '==', input.rankingId),
      where('uid', '==', input.uid)
    )
  );
  const pendenteOuAceita = existentes.docs.some((d) => {
    const s = d.data().status;
    return s === 'pendente' || s === 'aceito';
  });
  if (pendenteOuAceita) return;

  let conviteId = '';
  if (composicao === 'dupla' && input.parceiroUid && input.parceiroNome) {
    const { criarConviteDupla } = await import('./duplas');
    conviteId = await criarConviteDupla({
      contexto: 'ranking',
      refId: input.rankingId,
      refNome: input.rankingNome,
      clubeId: input.clubeId,
      clubeNome: input.clubeNome,
      donoUid: input.donoUid,
      deUid: input.uid,
      deNome: input.nome,
      paraUid: input.parceiroUid,
      paraNome: input.parceiroNome,
      busca: input.parceiroBusca ?? '',
    });
  }

  await addDoc(collection(db, 'solicitacoes'), {
    rankingId: input.rankingId,
    rankingNome: input.rankingNome,
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    donoUid: input.donoUid,
    uid: input.uid,
    nome: input.nome,
    fotoUrl: input.fotoUrl ?? '',
    status: 'pendente',
    parceiroUid: input.parceiroUid ?? '',
    parceiroNome: input.parceiroNome ?? '',
    conviteId,
    criadoEm: serverTimestamp(),
  });
}

/** Dono aceita solicitação: adiciona o jogador aos membros + cria a classificação.
 * `nivelId` opcional — se o ranking tiver níveis, coloca direto nessa categoria.
 */
export async function aceitarSolicitacao(
  sol: Solicitacao,
  opts?: { nivelId?: string }
): Promise<void> {
  await updateDoc(doc(db, 'solicitacoes', sol.id), { status: 'aceito' });

  await updateDoc(doc(db, 'rankings', sol.rankingId), {
    membros: arrayUnion(sol.uid),
    totalMembros: increment(1),
  });

  const rankingSnap = await getDoc(doc(db, 'rankings', sol.rankingId));
  const r = rankingSnap.data() || {};
  const composicao = String(r.composicao ?? 'simples');
  const pag = r.pagamento as
    | { ativo?: boolean; valor?: number; ciclo?: string; exigeParaEntrar?: boolean }
    | undefined;
  const precisaPagar = Boolean(
    pag?.ativo && pag?.exigeParaEntrar && (pag.valor ?? 0) > 0
  );

  const solSnap = await getDoc(doc(db, 'solicitacoes', sol.id));
  const solData = solSnap.data() || {};
  const parceiroUid = String(solData.parceiroUid || '');
  const parceiroNome = String(solData.parceiroNome || '');

  const { normalizarNiveisConfig } = await import('../types/ranking');
  const { nivelIdEntradaPadrao } = await import('./rankingNiveis');
  const cfg = normalizarNiveisConfig(
    r.niveis as import('../types/ranking').RankingNiveisConfig | undefined
  );
  let nivelId: string | undefined;
  if (cfg.ativo) {
    if (opts?.nivelId && cfg.niveis.some((n) => n.id === opts.nivelId)) {
      nivelId = opts.nivelId;
    } else {
      nivelId = nivelIdEntradaPadrao(cfg);
    }
  }

  const classRef = doc(db, 'rankings', sol.rankingId, 'classificacao', sol.uid);
  const existe = await getDoc(classRef);
  if (!existe.exists()) {
    await setDoc(classRef, {
      uid: sol.uid,
      nome: sol.nome,
      fotoUrl: sol.fotoUrl ?? '',
      pts: 0,
      vitorias: 0,
      derrotas: 0,
      pagamentoOk: !precisaPagar,
      ...(nivelId ? { nivelId } : {}),
      parceiroUid: parceiroUid || undefined,
      parceiroNome: parceiroNome || undefined,
      parceiroAceito: composicao === 'dupla' ? Boolean(parceiroUid) : undefined,
    });
  }

  if (composicao === 'dupla' && parceiroUid) {
    await updateDoc(doc(db, 'rankings', sol.rankingId), {
      membros: arrayUnion(parceiroUid),
      totalMembros: increment(1),
    });
    await setDoc(
      doc(db, 'rankings', sol.rankingId, 'classificacao', parceiroUid),
      {
        uid: parceiroUid,
        nome: parceiroNome || 'Parceiro',
        pts: 0,
        vitorias: 0,
        derrotas: 0,
        pagamentoOk: !precisaPagar,
        ...(nivelId ? { nivelId } : {}),
        parceiroUid: sol.uid,
        parceiroNome: sol.nome,
        parceiroAceito: true,
        duplaCom: sol.uid,
      },
      { merge: true }
    );
  }

  if (precisaPagar) {
    const { criarRegistroPagamento } = await import('./pagamentos');
    const { criarNotificacao } = await import('./notificacoes');
    const valor = Number(pag!.valor);
    const ciclo = (pag!.ciclo as 'unico' | 'mensal') || 'mensal';
    const pagId = await criarRegistroPagamento({
      uid: sol.uid,
      setmatchId: '',
      nome: sol.nome,
      tipo: 'ranking',
      clubeId: sol.clubeId,
      clubeNome: sol.clubeNome,
      donoUid: sol.donoUid,
      rankingId: sol.rankingId,
      rankingNome: sol.rankingNome,
      valor,
      ciclo,
      status: 'aguardando_pagamento',
    });
    void criarNotificacao({
      paraUid: sol.uid,
      tipo: 'pagamento',
      titulo: 'Pagamento do ranking',
      corpo: `Pague para liberar sua vaga em ${sol.rankingNome}.`,
      rota: '/pagamentos',
      refId: pagId,
    }).catch(() => undefined);

    if (parceiroUid) {
      const pagP = await criarRegistroPagamento({
        uid: parceiroUid,
        setmatchId: '',
        nome: parceiroNome || 'Parceiro',
        tipo: 'ranking',
        clubeId: sol.clubeId,
        clubeNome: sol.clubeNome,
        donoUid: sol.donoUid,
        rankingId: sol.rankingId,
        rankingNome: sol.rankingNome,
        valor,
        ciclo,
        status: 'aguardando_pagamento',
      });
      void criarNotificacao({
        paraUid: parceiroUid,
        tipo: 'pagamento',
        titulo: 'Pagamento do ranking',
        corpo: `Pague sua parte do ranking ${sol.rankingNome}.`,
        rota: '/pagamentos',
        refId: pagP,
      }).catch(() => undefined);
    }
  }
}

export async function recusarSolicitacao(solId: string): Promise<void> {
  await updateDoc(doc(db, 'solicitacoes', solId), { status: 'recusado' });
}

export async function atualizarRegrasJogoRanking(
  rankingId: string,
  regrasJogo: RankingRegrasJogo
): Promise<void> {
  await updateDoc(doc(db, 'rankings', rankingId), { regrasJogo });
}

export type AdversarioSugerido = Classificacao & {
  posicao: number;
  direcao: 'acima' | 'abaixo';
};

/** Sugere adversários pela posição na tabela (acima/abaixo configuráveis).
 * Se `mesmoNivelOnly`, filtra pela categoria do jogador (ranking multi-nível).
 */
export function sugerirAdversariosRanking(
  rowsOrdenadosPorPts: Classificacao[],
  meuUid: string,
  regras?: RankingRegrasJogo | null,
  opts?: { mesmoNivelOnly?: boolean }
): AdversarioSugerido[] {
  const r = { ...REGRAS_JOGO_PADRAO, ...regras };
  let tabela = rowsOrdenadosPorPts;
  if (opts?.mesmoNivelOnly) {
    const eu = rowsOrdenadosPorPts.find((x) => x.uid === meuUid);
    const meuNivel = eu?.nivelId;
    if (meuNivel) {
      tabela = rowsOrdenadosPorPts.filter((x) => (x.nivelId || '') === meuNivel);
    }
  }
  const idx = tabela.findIndex((x) => x.uid === meuUid);
  if (idx < 0) return [];
  const out: AdversarioSugerido[] = [];
  for (let i = 1; i <= r.enfrentaAcima; i++) {
    const row = tabela[idx - i];
    if (row) out.push({ ...row, posicao: idx - i + 1, direcao: 'acima' });
  }
  for (let i = 1; i <= r.enfrentaAbaixo; i++) {
    const row = tabela[idx + i];
    if (row) out.push({ ...row, posicao: idx + i + 1, direcao: 'abaixo' });
  }
  return out;
}

export async function aplicarPtsPartidaRanking(input: {
  rankingId: string;
  vencedorUid: string;
  perdedorUid: string;
  ptsVencedor: number;
  ptsPerdedor: number;
}): Promise<void> {
  const mes = mesCivilAtual();
  const vRef = doc(db, 'rankings', input.rankingId, 'classificacao', input.vencedorUid);
  const pRef = doc(db, 'rankings', input.rankingId, 'classificacao', input.perdedorUid);
  await updateDoc(vRef, {
    pts: increment(input.ptsVencedor),
    vitorias: increment(1),
    ultimoJogoMes: mes,
  });
  await updateDoc(pRef, {
    pts: increment(input.ptsPerdedor),
    derrotas: increment(1),
    ultimoJogoMes: mes,
  });
}

/** YYYY-MM no fuso local do dispositivo. */
export function mesCivilAtual(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Quem não jogou no mês civil atual tem pts zerados (os dois / qualquer inativo).
 * Idempotente — só escreve quando pts > 0 e último jogo não é deste mês.
 */
export async function zerarPtsSemJogoNoMes(rankingId: string): Promise<number> {
  if (!rankingId) return 0;
  const mes = mesCivilAtual();
  const snap = await getDocs(
    collection(db, 'rankings', rankingId, 'classificacao')
  );
  let n = 0;
  await Promise.all(
    snap.docs.map(async (d) => {
      const raw = d.data();
      const pts = Number(raw.pts ?? 0);
      const ultimo = raw.ultimoJogoMes ? String(raw.ultimoJogoMes) : '';
      if (pts <= 0) return;
      if (ultimo === mes) return;
      await updateDoc(d.ref, { pts: 0 });
      n += 1;
    })
  );
  return n;
}
