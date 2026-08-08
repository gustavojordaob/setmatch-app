import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import { normalizarSetmatchId } from '../utils/setmatchId';

export type JogadorBusca = {
  uid: string;
  nome: string;
  fotoUrl?: string;
  cidade?: string;
  estado?: string;
  nivel?: string;
  esportes: EsporteId[];
  setmatchId?: string;
  vitorias: number;
  derrotas: number;
  role?: string;
};

export async function buscarJogadoresAvancado(filtros: {
  texto?: string;
  cidade?: string;
  nivel?: string;
  esporte?: EsporteId;
  excluirUid?: string;
  max?: number;
}): Promise<JogadorBusca[]> {
  const texto = (filtros.texto ?? '').trim().toLowerCase();
  const max = filtros.max ?? 40;

  // Busca por ID Setmatch exato (padrão mercado: código de atleta)
  if (/^sm-?[a-z0-9]{4,}$/i.test(texto.replace(/\s/g, ''))) {
    const sid = normalizarSetmatchId(texto);
    const snap = await getDocs(
      query(collection(db, 'usuarios'), where('setmatchId', '==', sid), limit(5))
    );
    return snap.docs
      .map((d) => mapJogador(d.id, d.data()))
      .filter((j) => j.uid !== filtros.excluirUid);
  }

  const snap = await getDocs(query(collection(db, 'usuarios'), limit(80)));
  let list = snap.docs.map((d) => mapJogador(d.id, d.data()));

  list = list.filter((j) => {
    if (j.uid === filtros.excluirUid) return false;
    if (j.role === 'admin_clube' || j.role === 'professor') return false;
    if (texto) {
      const hay = `${j.nome} ${j.cidade ?? ''} ${j.setmatchId ?? ''}`.toLowerCase();
      if (!hay.includes(texto)) return false;
    }
    if (filtros.cidade) {
      const c = (j.cidade ?? '').toLowerCase();
      if (!c.includes(filtros.cidade.trim().toLowerCase())) return false;
    }
    if (filtros.nivel && j.nivel) {
      if (j.nivel.toLowerCase() !== filtros.nivel.toLowerCase()) return false;
    }
    if (filtros.esporte && j.esportes.length) {
      if (!j.esportes.includes(filtros.esporte)) return false;
    }
    return true;
  });

  return list.slice(0, max);
}

function mapJogador(uid: string, raw: Record<string, unknown>): JogadorBusca {
  return {
    uid,
    nome: String(raw.nome ?? 'Jogador'),
    fotoUrl: raw.fotoUrl ? String(raw.fotoUrl) : undefined,
    cidade: raw.cidade ? String(raw.cidade) : undefined,
    estado: raw.estado ? String(raw.estado) : undefined,
    nivel: raw.nivel ? String(raw.nivel) : undefined,
    esportes: (raw.esportes as EsporteId[]) ?? [],
    setmatchId: raw.setmatchId ? String(raw.setmatchId) : undefined,
    vitorias: Number(raw.vitorias ?? 0),
    derrotas: Number(raw.derrotas ?? 0),
    role: raw.role ? String(raw.role) : undefined,
  };
}
