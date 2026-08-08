import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

export type ModoAula = 'online' | 'presencial';
export type OrigemAula = 'clube' | 'professor';

export interface AulaPublicada {
  id: string;
  origemTipo: OrigemAula;
  origemId: string;
  origemNome: string;
  donoUid: string;
  modo: ModoAula;
  esporte: EsporteId;
  titulo: string;
  descricao: string;
  bannerUrl?: string;
  /** online */
  modulo?: string;
  ordem?: number;
  /** URL pública (Storage download ou YouTube placeholder) */
  videoUrl?: string;
  /** Path Storage `aulas/{uid}/...` quando o professor fez upload */
  videoStoragePath?: string;
  duracaoMin?: number;
  /** online: se true, só libera após pagamento / liberação */
  pago?: boolean;
  /** Valor unitário da aula online (quando pago) */
  valorOnline?: number;
  /** presencial */
  cidade?: string;
  local?: string;
  valorMensal?: number;
  modalidadeTipo?: string;
  ativo: boolean;
  criadoEm?: { seconds: number };
}

export async function listarAulasPorModo(
  modo: ModoAula,
  esporte?: EsporteId
): Promise<AulaPublicada[]> {
  const q = query(
    collection(db, 'aulasPublicadas'),
    where('modo', '==', modo),
    where('ativo', '==', true)
  );
  const snap = await getDocs(q);
  let list = snap.docs.map((d) => mapAula(d.id, d.data()));
  if (esporte) {
    list = list.filter((a) => a.esporte === esporte);
  }
  list.sort((a, b) => {
    const mo = (a.modulo ?? '').localeCompare(b.modulo ?? '');
    if (mo !== 0) return mo;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
  return list;
}

export async function listarAulasDoProfessor(
  donoUid: string,
  opts?: { modo?: ModoAula; esporte?: EsporteId }
): Promise<AulaPublicada[]> {
  const q = query(
    collection(db, 'aulasPublicadas'),
    where('donoUid', '==', donoUid),
    where('ativo', '==', true)
  );
  const snap = await getDocs(q);
  let list = snap.docs.map((d) => mapAula(d.id, d.data()));
  if (opts?.modo) list = list.filter((a) => a.modo === opts.modo);
  if (opts?.esporte) list = list.filter((a) => a.esporte === opts.esporte);
  list.sort((a, b) => {
    const mo = (a.modulo ?? '').localeCompare(b.modulo ?? '');
    if (mo !== 0) return mo;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
  return list;
}

export async function getAulaPublicada(id: string): Promise<AulaPublicada | null> {
  const snap = await getDoc(doc(db, 'aulasPublicadas', id));
  if (!snap.exists()) return null;
  return mapAula(snap.id, snap.data());
}

export interface CursoProfessorResumo {
  donoUid: string;
  origemId: string;
  origemNome: string;
  origemTipo: OrigemAula;
  esporte: EsporteId;
  totalAulas: number;
  totalModulos: number;
  fotoUrl?: string;
  bannerUrl?: string;
}

/** Agrupa aulas online por professor/dono. */
export function agruparCursosPorProfessor(
  aulas: AulaPublicada[]
): CursoProfessorResumo[] {
  const map = new Map<string, CursoProfessorResumo & { modulos: Set<string> }>();
  for (const a of aulas) {
    const key = a.donoUid || a.origemId;
    if (!map.has(key)) {
      map.set(key, {
        donoUid: a.donoUid,
        origemId: a.origemId,
        origemNome: a.origemNome,
        origemTipo: a.origemTipo,
        esporte: a.esporte,
        totalAulas: 0,
        totalModulos: 0,
        bannerUrl: a.bannerUrl,
        modulos: new Set(),
      });
    }
    const g = map.get(key)!;
    g.totalAulas += 1;
    if (a.modulo) g.modulos.add(a.modulo);
    if (!g.bannerUrl && a.bannerUrl) g.bannerUrl = a.bannerUrl;
  }
  return Array.from(map.values()).map(({ modulos, ...rest }) => ({
    ...rest,
    totalModulos: modulos.size || 1,
  }));
}

export async function listarAulasDoDono(donoUid: string): Promise<AulaPublicada[]> {
  const q = query(collection(db, 'aulasPublicadas'), where('donoUid', '==', donoUid));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => mapAula(d.id, d.data()));
  list.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return list;
}

export async function criarAulaPublicada(
  input: Omit<AulaPublicada, 'id' | 'criadoEm' | 'ativo'> & { ativo?: boolean }
): Promise<string> {
  const ref = await addDoc(collection(db, 'aulasPublicadas'), {
    origemTipo: input.origemTipo,
    origemId: input.origemId,
    origemNome: input.origemNome,
    donoUid: input.donoUid,
    modo: input.modo,
    esporte: input.esporte,
    titulo: input.titulo.trim(),
    descricao: input.descricao?.trim() ?? '',
    bannerUrl: input.bannerUrl ?? '',
    modulo: input.modulo ?? '',
    ordem: input.ordem ?? 0,
    videoUrl: input.videoUrl ?? '',
    videoStoragePath: input.videoStoragePath ?? '',
    duracaoMin: input.duracaoMin ?? 0,
    pago: input.modo === 'online' ? Boolean(input.pago) : false,
    valorOnline:
      input.modo === 'online' && input.pago
        ? Number(input.valorOnline) || 0
        : 0,
    cidade: input.cidade ?? '',
    local: input.local ?? '',
    valorMensal: input.valorMensal ?? 0,
    modalidadeTipo: input.modalidadeTipo ?? '',
    ativo: input.ativo ?? true,
    criadoEm: serverTimestamp(),
  });
  return ref.id;
}

/** Grátis, dono, ou pagamento aprovado/liberado com aulaPublicadaId. */
export async function temAcessoAulaOnline(
  uid: string | undefined,
  aula: AulaPublicada
): Promise<boolean> {
  if (!aula.pago) return true;
  if (!uid) return false;
  if (uid === aula.donoUid) return true;

  const snap = await getDocs(
    query(collection(db, 'pagamentos'), where('uid', '==', uid), limit(40))
  );
  return snap.docs.some((d) => {
    const raw = d.data();
    const status = String(raw.status ?? '');
    if (status !== 'aprovado' && status !== 'liberado_admin') return false;
    if (String(raw.aulaPublicadaId ?? '') === aula.id) return true;
    // Compra do curso inteiro do professor (futuro checkout)
    if (
      String(raw.tipo ?? '') === 'aula_online' &&
      String(raw.donoUid ?? '') === aula.donoUid &&
      !raw.aulaPublicadaId
    ) {
      return true;
    }
    return false;
  });
}

export async function atualizarAulaPublicada(
  id: string,
  data: Partial<Omit<AulaPublicada, 'id' | 'donoUid' | 'criadoEm'>>
): Promise<void> {
  await updateDoc(doc(db, 'aulasPublicadas', id), {
    ...data,
    atualizadoEm: serverTimestamp(),
  });
}

export async function excluirAulaPublicada(id: string): Promise<void> {
  await deleteDoc(doc(db, 'aulasPublicadas', id));
}

/** Pedido de liberação (sem pagar) — professor libera no financeiro. */
export async function pedirLiberacaoAulaOnline(input: {
  aula: AulaPublicada;
  uid: string;
  nome: string;
  setmatchId?: string;
  telefone?: string;
}): Promise<{ pagamentoId: string }> {
  const { aula } = input;
  const ref = await addDoc(collection(db, 'pagamentos'), {
    uid: input.uid,
    setmatchId: input.setmatchId ?? '',
    nome: input.nome,
    telefone: input.telefone ?? '',
    tipo: 'aula_online',
    clubeId: aula.origemTipo === 'clube' ? aula.origemId : '',
    clubeNome: aula.origemNome,
    donoUid: aula.donoUid,
    aulaPublicadaId: aula.id,
    aulaTitulo: aula.titulo,
    valor: aula.valorOnline ?? 0,
    ciclo: 'unico',
    status: 'pendente',
    solicitacaoLiberacao: true,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });

  await addDoc(collection(db, 'interessesAulas'), {
    uid: input.uid,
    nome: input.nome,
    telefone: input.telefone ?? '',
    donoUid: aula.donoUid,
    clubeId: aula.origemTipo === 'clube' ? aula.origemId : '',
    clubeNome: aula.origemNome,
    aulaPublicadaId: aula.id,
    aulaTitulo: aula.titulo,
    esporte: aula.esporte,
    mensagem: `Pediu liberação da aula online "${aula.titulo}".`,
    status: 'pendente',
    pagamentoId: ref.id,
    criadoEm: serverTimestamp(),
  });

  return { pagamentoId: ref.id };
}

/** Cria registro e devolve id para checkout Mercado Pago. */
export async function criarPagamentoAulaOnline(input: {
  aula: AulaPublicada;
  uid: string;
  nome: string;
  setmatchId?: string;
  telefone?: string;
}): Promise<string> {
  const { aula } = input;
  const valor = Number(aula.valorOnline ?? 0);
  if (!valor || valor <= 0) {
    throw new Error('Esta aula ainda não tem valor definido. Peça liberação ao professor.');
  }
  const ref = await addDoc(collection(db, 'pagamentos'), {
    uid: input.uid,
    setmatchId: input.setmatchId ?? '',
    nome: input.nome,
    telefone: input.telefone ?? '',
    tipo: 'aula_online',
    clubeId: aula.origemTipo === 'clube' ? aula.origemId : '',
    clubeNome: aula.origemNome,
    donoUid: aula.donoUid,
    aulaPublicadaId: aula.id,
    aulaTitulo: aula.titulo,
    valor,
    ciclo: 'unico',
    status: 'aguardando_pagamento',
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  return ref.id;
}

function mapAula(id: string, raw: Record<string, unknown>): AulaPublicada {
  return {
    id,
    origemTipo: (raw.origemTipo as OrigemAula) ?? 'clube',
    origemId: String(raw.origemId ?? ''),
    origemNome: String(raw.origemNome ?? ''),
    donoUid: String(raw.donoUid ?? ''),
    modo: (raw.modo as ModoAula) ?? 'presencial',
    esporte: (raw.esporte as EsporteId) ?? 'tenis',
    titulo: String(raw.titulo ?? ''),
    descricao: String(raw.descricao ?? ''),
    bannerUrl: raw.bannerUrl ? String(raw.bannerUrl) : undefined,
    modulo: raw.modulo ? String(raw.modulo) : undefined,
    ordem: raw.ordem != null ? Number(raw.ordem) : undefined,
    videoUrl: raw.videoUrl ? String(raw.videoUrl) : undefined,
    videoStoragePath: raw.videoStoragePath
      ? String(raw.videoStoragePath)
      : undefined,
    duracaoMin: raw.duracaoMin != null ? Number(raw.duracaoMin) : undefined,
    pago: Boolean(raw.pago),
    valorOnline: raw.valorOnline != null ? Number(raw.valorOnline) : undefined,
    cidade: raw.cidade ? String(raw.cidade) : undefined,
    local: raw.local ? String(raw.local) : undefined,
    valorMensal: raw.valorMensal != null ? Number(raw.valorMensal) : undefined,
    modalidadeTipo: raw.modalidadeTipo ? String(raw.modalidadeTipo) : undefined,
    ativo: raw.ativo !== false,
    criadoEm: raw.criadoEm as { seconds: number } | undefined,
  };
}
