import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import { composicaoPadraoPorEsporte } from '../constants/composicao';
import type { ComposicaoId } from '../constants/composicao';

export interface ClubeCompleto {
  id: string;
  nome: string;
  cidade: string;
  bairro?: string;
  estado?: string;
  cep?: string;
  endereco?: string;
  telefone?: string;
  descricao?: string;
  /** URL do logo do clube (Storage `clubes/{id}/logo_*.jpg`) */
  logoUrl?: string;
  lat?: number;
  lng?: number;
  esportes: EsporteId[];
  donoUid: string;
  donoNome: string;
  regrasGerais?: string;
  aulas?: {
    ativo: boolean;
    valorMensal: number;
    regras: string;
    permitePix: boolean;
    permiteCartao: boolean;
    descontoPixPercent?: number;
    descontoCartaoPercent?: number;
  };
  /** Agenda de quadras (funcionamento + slots). */
  agenda?: import('../types/agenda').AgendaClubeConfig;
  /** Stripe Connect Express */
  stripeAccountId?: string;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
  criadoEm?: { seconds: number };
}

export interface Torneio {
  id: string;
  clubeId: string;
  nome: string;
  esporte: EsporteId;
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
  status: 'aberto' | 'em_andamento' | 'finalizado';
}

interface CriarClubeInput {
  nome: string;
  cidade: string;
  bairro?: string;
  estado?: string;
  cep?: string;
  endereco?: string;
  telefone?: string;
  descricao?: string;
  esportes: EsporteId[];
  donoUid: string;
  donoNome: string;
}

export async function criarClube(input: CriarClubeInput): Promise<string> {
  const ref = await addDoc(collection(db, 'clubes'), {
    nome: input.nome.trim(),
    cidade: input.cidade.trim(),
    bairro: input.bairro?.trim() ?? '',
    estado: input.estado?.trim().toUpperCase() ?? '',
    cep: input.cep?.trim() ?? '',
    endereco: input.endereco?.trim() ?? '',
    telefone: input.telefone?.trim() ?? '',
    descricao: input.descricao?.trim() ?? '',
    esportes: input.esportes,
    esporte: input.esportes[0] ?? 'tenis',
    donoUid: input.donoUid,
    donoNome: input.donoNome,
    criadoEm: serverTimestamp(),
  });

  await updateDoc(doc(db, 'usuarios', input.donoUid), {
    clubeId: ref.id,
    role: 'admin_clube',
  });

  return ref.id;
}

export async function atualizarClube(
  clubeId: string,
  data: Partial<Omit<ClubeCompleto, 'id' | 'donoUid' | 'donoNome' | 'criadoEm'>>
): Promise<void> {
  await updateDoc(doc(db, 'clubes', clubeId), data);
}

/** Espelha `logoUrl` do clube em todos os rankings (card / detalhe). */
export async function sincronizarLogoNosRankings(
  clubeId: string,
  logoUrl: string
): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'rankings'), where('clubeId', '==', clubeId))
  );
  await Promise.all(
    snap.docs.map((d) => updateDoc(d.ref, { clubeLogoUrl: logoUrl }))
  );
}

export async function salvarLogoClube(
  clubeId: string,
  logoUrl: string
): Promise<void> {
  await atualizarClube(clubeId, { logoUrl });
  await sincronizarLogoNosRankings(clubeId, logoUrl);
}

export async function criarRankingNoClube(input: {
  clubeId: string;
  clubeNome: string;
  cidade: string;
  esporte: EsporteId;
  nome: string;
  donoUid: string;
  donoNome: string;
  donoFotoUrl?: string;
  clubeLogoUrl?: string;
  regrasJogo?: import('../types/ranking').RankingRegrasJogo;
  composicao?: ComposicaoId;
  pagamento?: {
    ativo: boolean;
    valor: number;
    ciclo: 'unico' | 'mensal';
    regras: string;
    exigeParaEntrar: boolean;
    permitePix: boolean;
    permiteCartao: boolean;
    descontoPixPercent?: number;
    descontoCartaoPercent?: number;
  };
}): Promise<string> {
  const rankingRef = await addDoc(collection(db, 'rankings'), {
    nome: input.nome.trim(),
    clubeId: input.clubeId,
    clubeNome: input.clubeNome,
    clubeLogoUrl: input.clubeLogoUrl ?? '',
    cidade: input.cidade,
    esporte: input.esporte,
    composicao: input.composicao ?? composicaoPadraoPorEsporte(input.esporte),
    donoUid: input.donoUid,
    membros: [input.donoUid],
    totalMembros: 1,
    regrasJogo: input.regrasJogo ?? {
      formatoPartidaId: 'melhor_de_3_stb',
      modelo: 'ladder',
      jogosPorMes: 2,
      enfrentaAcima: 1,
      enfrentaAbaixo: 1,
      ptsJogoCompleto: 35,
      ptsParticipacao: 5,
      participacaoTambemVencedor: true,
      qtdGrupos: 4,
      jogadoresPorGrupo: 4,
      textoLivre: '',
    },
    pagamento: input.pagamento ?? {
      ativo: false,
      valor: 0,
      ciclo: 'mensal',
      regras: '',
      exigeParaEntrar: false,
      permitePix: true,
      permiteCartao: true,
      descontoPixPercent: 0,
      descontoCartaoPercent: 0,
    },
    criadoEm: serverTimestamp(),
  });

  await setDoc(doc(db, 'rankings', rankingRef.id, 'classificacao', input.donoUid), {
    uid: input.donoUid,
    nome: input.donoNome,
    fotoUrl: input.donoFotoUrl ?? '',
    pts: 0,
    vitorias: 0,
    derrotas: 0,
    pagamentoOk: true,
  });

  return rankingRef.id;
}

/** @deprecated use services/rankingNiveis — reexport para imports antigos */
export {
  salvarNiveisRanking,
  moverJogadorNivel,
  aplicarMovimentacaoRanking,
  previewMovimentacaoRanking,
  colocarUsuarioNoNivel,
} from './rankingNiveis';

export async function criarTorneio(input: {
  clubeId: string;
  nome: string;
  esporte: EsporteId;
  dataInicio?: string;
  dataFim?: string;
  descricao?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'torneios'), {
    clubeId: input.clubeId,
    nome: input.nome.trim(),
    esporte: input.esporte,
    dataInicio: input.dataInicio ?? '',
    dataFim: input.dataFim ?? '',
    descricao: input.descricao?.trim() ?? '',
    status: 'aberto',
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

export async function listarClubesDoDono(donoUid: string): Promise<ClubeCompleto[]> {
  const snap = await getDocs(query(collection(db, 'clubes'), where('donoUid', '==', donoUid)));
  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      nome: String(raw.nome ?? ''),
      cidade: String(raw.cidade ?? ''),
      bairro: String(raw.bairro ?? ''),
      estado: String(raw.estado ?? ''),
      cep: String(raw.cep ?? ''),
      endereco: String(raw.endereco ?? ''),
      telefone: String(raw.telefone ?? ''),
      descricao: String(raw.descricao ?? ''),
      logoUrl: raw.logoUrl ? String(raw.logoUrl) : undefined,
      esportes: (raw.esportes as EsporteId[]) ?? [raw.esporte as EsporteId].filter(Boolean),
      donoUid: String(raw.donoUid ?? ''),
      donoNome: String(raw.donoNome ?? ''),
      regrasGerais: raw.regrasGerais ? String(raw.regrasGerais) : '',
      aulas: raw.aulas
        ? {
            ativo: Boolean((raw.aulas as { ativo?: boolean }).ativo),
            valorMensal: Number((raw.aulas as { valorMensal?: number }).valorMensal ?? 0),
            regras: String((raw.aulas as { regras?: string }).regras ?? ''),
            permitePix: Boolean((raw.aulas as { permitePix?: boolean }).permitePix ?? true),
            permiteCartao: Boolean((raw.aulas as { permiteCartao?: boolean }).permiteCartao ?? true),
            descontoPixPercent: Number(
              (raw.aulas as { descontoPixPercent?: number }).descontoPixPercent ?? 0
            ),
            descontoCartaoPercent: Number(
              (raw.aulas as { descontoCartaoPercent?: number }).descontoCartaoPercent ?? 0
            ),
          }
        : undefined,
      stripeAccountId: raw.stripeAccountId ? String(raw.stripeAccountId) : undefined,
      stripeChargesEnabled: Boolean(raw.stripeChargesEnabled),
      stripePayoutsEnabled: Boolean(raw.stripePayoutsEnabled),
      stripeDetailsSubmitted: Boolean(raw.stripeDetailsSubmitted),
    };
  });
}
