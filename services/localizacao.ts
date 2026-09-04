import * as Location from 'expo-location';
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../utils/firebaseConfig';
import { getBuscarQuadrasMapsUrl } from '../utils/config';
import { distanciaKm } from '../utils/geo';

export const RAIO_PADRAO_KM = 25;
/** Distância para considerar Places duplicado de um clube conveniado. */
const DEDUP_CLUBE_KM = 0.12;

export interface Coords {
  lat: number;
  lng: number;
}

export async function pedirPermissaoLocalizacao(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function obterCoordsAtuais(): Promise<Coords | null> {
  const ok = await pedirPermissaoLocalizacao();
  if (!ok) return null;
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export async function salvarLocalizacaoUsuario(
  uid: string,
  coords: Coords
): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), {
    lat: coords.lat,
    lng: coords.lng,
    localizacaoAtualizadaEm: serverTimestamp(),
  });
}

export async function salvarLocalizacaoClube(
  clubeId: string,
  coords: Coords
): Promise<void> {
  await updateDoc(doc(db, 'clubes', clubeId), {
    lat: coords.lat,
    lng: coords.lng,
    localizacaoAtualizadaEm: serverTimestamp(),
  });
}

export interface PessoaProxima {
  uid: string;
  nome: string;
  fotoUrl?: string;
  cidade?: string;
  estado?: string;
  distanciaKm: number;
}

export interface QuadraProxima {
  id: string;
  nome: string;
  cidade?: string;
  estado?: string;
  endereco?: string;
  distanciaKm: number;
  tipo: 'clube' | 'quadra' | 'maps';
  /** 'rally' = clube/quadra no app; 'maps' = Google Places */
  fonte: 'rally' | 'maps';
  lat?: number;
  lng?: number;
  placeId?: string;
  mapsUrl?: string;
  rating?: number;
}

type MapsPlaceDto = {
  id: string;
  placeId: string;
  nome: string;
  endereco?: string;
  lat: number;
  lng: number;
  distanciaKm: number;
  rating?: number;
  mapsUrl: string;
};

/** Google Places via Cloud Function (qualquer quadra perto, não só conveniadas). */
export async function buscarQuadrasNoMaps(opts: {
  lat: number;
  lng: number;
  raioKm?: number;
  query?: string;
}): Promise<QuadraProxima[]> {
  const user = auth.currentUser;
  if (!user) return [];
  const token = await user.getIdToken();
  const res = await fetch(getBuscarQuadrasMapsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      lat: opts.lat,
      lng: opts.lng,
      raioKm: opts.raioKm ?? RAIO_PADRAO_KM,
      query: opts.query?.trim() || undefined,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    lugares?: MapsPlaceDto[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error || `Maps HTTP ${res.status}`);
  }
  return (json.lugares || []).map((p) => ({
    id: p.id,
    nome: p.nome,
    endereco: p.endereco,
    distanciaKm: p.distanciaKm,
    tipo: 'maps' as const,
    fonte: 'maps' as const,
    lat: p.lat,
    lng: p.lng,
    placeId: p.placeId,
    mapsUrl: p.mapsUrl,
    rating: p.rating,
  }));
}

/** Candidatos por estado (ou todos se vazio), filtrados por Haversine. */
export async function listarPessoasProximas(opts: {
  meuUid: string;
  lat: number;
  lng: number;
  estado?: string;
  raioKm?: number;
}): Promise<PessoaProxima[]> {
  const raio = opts.raioKm ?? RAIO_PADRAO_KM;
  async function fetchSnap(estado?: string) {
    return estado
      ? getDocs(
          query(collection(db, 'usuarios'), where('estado', '==', estado), limit(80))
        )
      : getDocs(query(collection(db, 'usuarios'), limit(80)));
  }
  let snap = await fetchSnap(opts.estado);
  const out: PessoaProxima[] = [];
  const mapDocs = (docs: typeof snap.docs) => {
    for (const d of docs) {
      if (d.id === opts.meuUid) continue;
      const raw = d.data();
      const role = String(raw.role ?? 'jogador');
      if (role === 'admin_clube') continue;
      const lat = Number(raw.lat);
      const lng = Number(raw.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const km = distanciaKm(opts.lat, opts.lng, lat, lng);
      if (km > raio) continue;
      out.push({
        uid: d.id,
        nome: String(raw.nome ?? 'Jogador'),
        fotoUrl: raw.fotoUrl ? String(raw.fotoUrl) : undefined,
        cidade: raw.cidade ? String(raw.cidade) : undefined,
        estado: raw.estado ? String(raw.estado) : undefined,
        distanciaKm: km,
      });
    }
  };
  mapDocs(snap.docs);
  if (out.length === 0 && opts.estado) {
    snap = await fetchSnap(undefined);
    mapDocs(snap.docs);
  }
  return out.sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export async function listarQuadrasProximas(opts: {
  lat: number;
  lng: number;
  estado?: string;
  raioKm?: number;
  /** Busca textual no Google Places (ex.: "padel", "Winner"). */
  queryMaps?: string;
  /** Se false, só clubes/quadras do app. Default true. */
  incluirMaps?: boolean;
}): Promise<QuadraProxima[]> {
  const raio = opts.raioKm ?? RAIO_PADRAO_KM;
  const out: QuadraProxima[] = [];

  const qClubes = opts.estado
    ? query(collection(db, 'clubes'), where('estado', '==', opts.estado), limit(60))
    : query(collection(db, 'clubes'), limit(60));
  const clubesSnap = await getDocs(qClubes);
  for (const d of clubesSnap.docs) {
    const raw = d.data();
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const km = distanciaKm(opts.lat, opts.lng, lat, lng);
    if (km > raio) continue;
    out.push({
      id: d.id,
      nome: String(raw.nome ?? 'Clube'),
      cidade: raw.cidade ? String(raw.cidade) : undefined,
      estado: raw.estado ? String(raw.estado) : undefined,
      endereco: raw.endereco ? String(raw.endereco) : undefined,
      distanciaKm: km,
      tipo: 'clube',
      fonte: 'rally',
      lat,
      lng,
    });
  }

  try {
    const qQuad = query(collection(db, 'quadras'), limit(40));
    const quadSnap = await getDocs(qQuad);
    for (const d of quadSnap.docs) {
      const raw = d.data();
      const lat = Number(raw.lat);
      const lng = Number(raw.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (opts.estado && raw.estado && String(raw.estado) !== opts.estado) continue;
      const km = distanciaKm(opts.lat, opts.lng, lat, lng);
      if (km > raio) continue;
      out.push({
        id: d.id,
        nome: String(raw.nome ?? raw.quadra ?? 'Quadra'),
        cidade: raw.cidade ? String(raw.cidade) : undefined,
        estado: raw.estado ? String(raw.estado) : undefined,
        endereco: raw.endereco ? String(raw.endereco) : undefined,
        distanciaKm: km,
        tipo: 'quadra',
        fonte: 'rally',
        lat,
        lng,
      });
    }
  } catch {
    // coleção pode estar vazia / sem índice
  }

  if (opts.incluirMaps !== false) {
    try {
      const maps = await buscarQuadrasNoMaps({
        lat: opts.lat,
        lng: opts.lng,
        raioKm: raio,
        query: opts.queryMaps,
      });
      const rallyComCoord = out.filter(
        (q) => Number.isFinite(q.lat) && Number.isFinite(q.lng)
      );
      for (const m of maps) {
        const dup = rallyComCoord.some(
          (r) =>
            distanciaKm(r.lat!, r.lng!, m.lat!, m.lng!) < DEDUP_CLUBE_KM
        );
        if (dup) continue;
        out.push(m);
      }
    } catch (e) {
      console.warn('[listarQuadrasProximas] Maps:', e);
    }
  }

  return out.sort((a, b) => a.distanciaKm - b.distanciaKm);
}
