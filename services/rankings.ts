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
import type { Classificacao, RankingEtapaMes, RankingRegrasJogo, Solicitacao } from '../types/ranking';
import { REGRAS_JOGO_PADRAO, normalizarEtapaMes, normalizarRegrasJogo } from '../types/ranking';

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
    const esporteRank = String(r.esporte ?? '');
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
      esporte: esporteRank || undefined,
      modalidadeNome: sol.rankingNome || esporteRank || 'Ranking',
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
        esporte: esporteRank || undefined,
        modalidadeNome: sol.rankingNome || esporteRank || 'Ranking',
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

/**
 * Dono do ranking cadastra jogador (e parceiro, se dupla) sem solicitação.
 * Cria classificação, cobra se o ranking exigir pagamento, e notifica o jogador.
 */
export async function adicionarMembroRankingPorDono(input: {
  rankingId: string;
  donoUid: string;
  buscaJogador: string;
  buscaParceiro?: string;
  /** Se o ranking tiver níveis, coloca neste (senão usa entrada padrão). */
  nivelId?: string;
}): Promise<{ uid: string; nome: string; parceiroUid?: string; parceiroNome?: string }> {
  if (!input.rankingId || !input.donoUid) throw new Error('Dados inválidos.');

  const rRef = doc(db, 'rankings', input.rankingId);
  const rSnap = await getDoc(rRef);
  if (!rSnap.exists()) throw new Error('Ranking não encontrado.');
  const r = rSnap.data()!;
  if (String(r.donoUid ?? '') !== input.donoUid) {
    throw new Error('Só o dono do ranking pode cadastrar jogadores.');
  }

  const { buscarUsuarioPorEmailOuId } = await import('./duplas');
  const jogador = await buscarUsuarioPorEmailOuId(input.buscaJogador);
  if (!jogador) {
    throw new Error('Jogador não encontrado. Use e-mail ou ID (SM-…).');
  }

  const membros = (r.membros as string[]) ?? [];
  if (membros.includes(jogador.uid)) {
    throw new Error('Este jogador já está no ranking.');
  }

  const composicao = String(r.composicao ?? 'simples');
  let parceiroUid = '';
  let parceiroNome = '';
  let parceiroFoto = '';
  if (composicao === 'dupla') {
    if (!input.buscaParceiro?.trim()) {
      throw new Error('Este ranking é de duplas — informe o parceiro (e-mail ou ID).');
    }
    const parceiro = await buscarUsuarioPorEmailOuId(input.buscaParceiro);
    if (!parceiro) {
      throw new Error('Parceiro não encontrado. Use e-mail ou ID (SM-…).');
    }
    if (parceiro.uid === jogador.uid) {
      throw new Error('Jogador e parceiro precisam ser pessoas diferentes.');
    }
    if (membros.includes(parceiro.uid)) {
      throw new Error('O parceiro já está no ranking.');
    }
    parceiroUid = parceiro.uid;
    parceiroNome = parceiro.nome;
    parceiroFoto = parceiro.fotoUrl ?? '';
  }

  const pag = r.pagamento as
    | { ativo?: boolean; valor?: number; ciclo?: string; exigeParaEntrar?: boolean }
    | undefined;
  const precisaPagar = Boolean(
    pag?.ativo && pag?.exigeParaEntrar && (pag.valor ?? 0) > 0
  );

  const { normalizarNiveisConfig } = await import('../types/ranking');
  const { nivelIdEntradaPadrao } = await import('./rankingNiveis');
  const cfg = normalizarNiveisConfig(
    r.niveis as import('../types/ranking').RankingNiveisConfig | undefined
  );
  let nivelId: string | undefined;
  if (cfg.ativo) {
    if (input.nivelId && cfg.niveis.some((n) => n.id === input.nivelId)) {
      nivelId = input.nivelId;
    } else {
      nivelId = nivelIdEntradaPadrao(cfg);
    }
  }

  const rankingNome = String(r.nome ?? 'Ranking');
  const clubeId = String(r.clubeId ?? '');
  const clubeNome = String(r.clubeNome ?? '');

  await updateDoc(rRef, {
    membros: arrayUnion(jogador.uid),
    totalMembros: increment(1),
  });

  await setDoc(doc(db, 'rankings', input.rankingId, 'classificacao', jogador.uid), {
    uid: jogador.uid,
    nome: jogador.nome,
    fotoUrl: jogador.fotoUrl ?? '',
    pts: 0,
    vitorias: 0,
    derrotas: 0,
    pagamentoOk: !precisaPagar,
    ...(nivelId ? { nivelId } : {}),
    parceiroUid: parceiroUid || undefined,
    parceiroNome: parceiroNome || undefined,
    parceiroAceito: composicao === 'dupla' ? Boolean(parceiroUid) : undefined,
    inscritoPorDono: true,
    inscritoEm: serverTimestamp(),
  });

  if (parceiroUid) {
    await updateDoc(rRef, {
      membros: arrayUnion(parceiroUid),
      totalMembros: increment(1),
    });
    await setDoc(
      doc(db, 'rankings', input.rankingId, 'classificacao', parceiroUid),
      {
        uid: parceiroUid,
        nome: parceiroNome || 'Parceiro',
        fotoUrl: parceiroFoto,
        pts: 0,
        vitorias: 0,
        derrotas: 0,
        pagamentoOk: !precisaPagar,
        ...(nivelId ? { nivelId } : {}),
        parceiroUid: jogador.uid,
        parceiroNome: jogador.nome,
        parceiroAceito: true,
        duplaCom: jogador.uid,
        inscritoPorDono: true,
        inscritoEm: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // Fecha solicitação pendente do jogador, se houver
  try {
    const sols = await getDocs(
      query(
        collection(db, 'solicitacoes'),
        where('rankingId', '==', input.rankingId),
        where('uid', '==', jogador.uid)
      )
    );
    for (const d of sols.docs) {
      if (String(d.data().status) === 'pendente') {
        await updateDoc(d.ref, { status: 'aceito' });
      }
    }
  } catch {
    /* índice / rules — cadastro já feito */
  }

  const { criarNotificacao } = await import('./notificacoes');
  void criarNotificacao({
    paraUid: jogador.uid,
    tipo: 'sistema',
    titulo: 'Você entrou no ranking',
    corpo: `O organizador te adicionou em ${rankingNome}.`,
    rota: `/ranking/${input.rankingId}`,
    refId: input.rankingId,
  }).catch(() => undefined);

  if (parceiroUid) {
    void criarNotificacao({
      paraUid: parceiroUid,
      tipo: 'sistema',
      titulo: 'Você entrou no ranking',
      corpo: `O organizador te adicionou em ${rankingNome} (dupla com ${jogador.nome}).`,
      rota: `/ranking/${input.rankingId}`,
      refId: input.rankingId,
    }).catch(() => undefined);
  }

  if (precisaPagar) {
    const { criarRegistroPagamento } = await import('./pagamentos');
    const valor = Number(pag!.valor);
    const ciclo = (pag!.ciclo as 'unico' | 'mensal') || 'mensal';
    const pagId = await criarRegistroPagamento({
      uid: jogador.uid,
      setmatchId: jogador.setmatchId || '',
      nome: jogador.nome,
      telefone: jogador.telefone,
      tipo: 'ranking',
      clubeId,
      clubeNome,
      donoUid: input.donoUid,
      rankingId: input.rankingId,
      rankingNome,
      esporte: String(r.esporte ?? '') || undefined,
      modalidadeNome: rankingNome || String(r.esporte ?? '') || 'Ranking',
      valor,
      ciclo,
      status: 'aguardando_pagamento',
    });
    void criarNotificacao({
      paraUid: jogador.uid,
      tipo: 'pagamento',
      titulo: 'Pagamento do ranking',
      corpo: `Pague para liberar sua vaga em ${rankingNome}.`,
      rota: '/pagamentos',
      refId: pagId,
    }).catch(() => undefined);

    if (parceiroUid) {
      const pagP = await criarRegistroPagamento({
        uid: parceiroUid,
        setmatchId: '',
        nome: parceiroNome || 'Parceiro',
        tipo: 'ranking',
        clubeId,
        clubeNome,
        donoUid: input.donoUid,
        rankingId: input.rankingId,
        rankingNome,
        esporte: String(r.esporte ?? '') || undefined,
        modalidadeNome: rankingNome || String(r.esporte ?? '') || 'Ranking',
        valor,
        ciclo,
        status: 'aguardando_pagamento',
      });
      void criarNotificacao({
        paraUid: parceiroUid,
        tipo: 'pagamento',
        titulo: 'Pagamento do ranking',
        corpo: `Pague sua parte do ranking ${rankingNome}.`,
        rota: '/pagamentos',
        refId: pagP,
      }).catch(() => undefined);
    }
  }

  return {
    uid: jogador.uid,
    nome: jogador.nome,
    parceiroUid: parceiroUid || undefined,
    parceiroNome: parceiroNome || undefined,
  };
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

export function adicionarDiasYYYYMMDD(dias: number, base = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + Math.max(0, Math.floor(dias)));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatarDataBR(yyyyMmDd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return yyyyMmDd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Fim do dia local da data YYYY-MM-DD. */
export function fimDoDiaLocal(yyyyMmDd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd.trim());
  if (!m) return new Date(0);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
}

export function etapaJogosAberta(etapa?: RankingEtapaMes | null, agora = new Date()): boolean {
  if (!etapa?.jogosLiberados) return false;
  if (etapa.mes !== mesCivilAtual(agora)) return false;
  if (!etapa.prazoJogosAte) return true;
  return agora.getTime() <= fimDoDiaLocal(etapa.prazoJogosAte).getTime();
}

/**
 * Bloqueia marcar confronto se a etapa do mês não foi liberada ou o prazo passou.
 * Rankings sem etapa no mês atual → bloqueados (dono precisa liberar).
 */
export function assertEtapaJogosAberta(etapa?: RankingEtapaMes | null): void {
  const mes = mesCivilAtual();
  if (!etapa || etapa.mes !== mes || !etapa.jogosLiberados) {
    throw new Error(
      'Os jogos deste mês ainda não foram liberados pelo clube. Aguarde a liberação.'
    );
  }
  if (!etapaJogosAberta(etapa)) {
    throw new Error(
      `O prazo dos jogos encerrou em ${formatarDataBR(etapa.prazoJogosAte)}. Peça ao clube para estender.`
    );
  }
}

async function notificarMembrosRanking(input: {
  rankingId: string;
  membros: string[];
  titulo: string;
  corpo: string;
}): Promise<void> {
  const { notificarVarios } = await import('./notificacoes');
  await notificarVarios({
    uids: input.membros,
    tipo: 'ranking',
    titulo: input.titulo,
    corpo: input.corpo,
    rota: `/ranking/${input.rankingId}`,
    refId: input.rankingId,
  });
}

/**
 * Inicia / reabre a etapa do mês: libera jogos, define prazo e avisa membros (push).
 * Idempotente se já liberado no mesmo mês com o mesmo prazo — ainda assim pode reenviar notif se `forcarNotif`.
 */
export async function iniciarEtapaMensalRanking(input: {
  rankingId: string;
  porUid: string;
  /** Sobrescreve regras.prazoPadraoDias */
  prazoDias?: number;
  /** Se false, não envia push (ex.: batch silencioso). Default true. */
  notificar?: boolean;
  /** Motivo no corpo da notificação */
  origem?: 'manual' | 'torneio';
}): Promise<RankingEtapaMes> {
  const ref = doc(db, 'rankings', input.rankingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Ranking não encontrado.');
  const raw = snap.data();
  if (input.origem !== 'torneio' && String(raw.donoUid ?? '') !== input.porUid) {
    throw new Error('Só o dono do ranking pode liberar os jogos.');
  }

  const regras = normalizarRegrasJogo(raw.regrasJogo as RankingRegrasJogo | undefined);
  const mes = mesCivilAtual();
  const dias = input.prazoDias ?? regras.prazoPadraoDias ?? 28;
  const prazoJogosAte = adicionarDiasYYYYMMDD(dias);
  const etapa: RankingEtapaMes = {
    mes,
    jogosLiberados: true,
    prazoJogosAte,
    liberadoPorUid: input.porUid,
  };

  await updateDoc(ref, { etapa });
  try {
    await zerarPtsSemJogoNoMes(input.rankingId);
  } catch (e) {
    console.warn('[ranking] zerar pts ao iniciar etapa', e);
  }

  if (input.notificar !== false) {
    const membros = (raw.membros as string[]) ?? [];
    const nome = String(raw.nome ?? 'Ranking');
    const origemTxt =
      input.origem === 'torneio'
        ? ' (junto com a liberação do chaveamento do torneio)'
        : '';
    await notificarMembrosRanking({
      rankingId: input.rankingId,
      membros,
      titulo: 'Ranking do mês liberado',
      corpo: `Os jogos de ${nome} estão liberados até ${formatarDataBR(prazoJogosAte)}${origemTxt}. Marque seus confrontos!`,
    });
  }

  return etapa;
}

/** Estende o prazo dos jogos da etapa atual (dono). */
export async function estenderPrazoJogosRanking(input: {
  rankingId: string;
  donoUid: string;
  /** Nova data YYYY-MM-DD (deve ser depois de hoje) */
  novaDataYYYYMMDD: string;
}): Promise<RankingEtapaMes> {
  const ref = doc(db, 'rankings', input.rankingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Ranking não encontrado.');
  const raw = snap.data();
  if (String(raw.donoUid) !== input.donoUid) {
    throw new Error('Só o dono do ranking pode estender o prazo.');
  }

  const mes = mesCivilAtual();
  const atual = normalizarEtapaMes(raw.etapa as RankingEtapaMes | undefined);
  if (!atual || atual.mes !== mes || !atual.jogosLiberados) {
    throw new Error('Libere os jogos do mês antes de estender o prazo.');
  }

  const nova = input.novaDataYYYYMMDD.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nova)) {
    throw new Error('Data inválida. Use AAAA-MM-DD.');
  }
  if (fimDoDiaLocal(nova).getTime() < Date.now()) {
    throw new Error('A nova data precisa ser hoje ou no futuro.');
  }

  const etapa: RankingEtapaMes = {
    ...atual,
    prazoJogosAte: nova,
  };
  await updateDoc(ref, { etapa });

  const membros = (raw.membros as string[]) ?? [];
  const nome = String(raw.nome ?? 'Ranking');
  await notificarMembrosRanking({
    rankingId: input.rankingId,
    membros,
    titulo: 'Prazo do ranking estendido',
    corpo: `O prazo dos jogos de ${nome} foi estendido até ${formatarDataBR(nova)}.`,
  });

  return etapa;
}

/** Ao liberar chave do torneio: inicia etapa mensal de todos os rankings do mesmo clube. */
export async function iniciarEtapaMensalRankingsDoClube(input: {
  clubeId: string;
  porUid: string;
}): Promise<number> {
  if (!input.clubeId) return 0;
  const snap = await getDocs(
    query(collection(db, 'rankings'), where('clubeId', '==', input.clubeId))
  );
  let n = 0;
  for (const d of snap.docs) {
    const raw = d.data();
    const etapa = normalizarEtapaMes(raw.etapa as RankingEtapaMes | undefined);
    const mes = mesCivilAtual();
    // Já liberado neste mês → não reenvia spam
    if (etapa?.mes === mes && etapa.jogosLiberados) continue;
    try {
      await iniciarEtapaMensalRanking({
        rankingId: d.id,
        porUid: input.porUid || String(raw.donoUid ?? ''),
        notificar: true,
        origem: 'torneio',
      });
      n += 1;
    } catch (e) {
      console.warn('[ranking] iniciar etapa via torneio', d.id, e);
    }
  }
  return n;
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
