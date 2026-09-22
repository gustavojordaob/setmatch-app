"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buscarQuadrasMaps = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
function mapsApiKey() {
    return process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
}
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function requireUid(req) {
    const authHeader = String(req.headers.authorization || '');
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token)
        throw new Error('UNAUTHORIZED');
    const decoded = await (0, auth_1.getAuth)().verifyIdToken(token);
    return decoded.uid;
}
function mapPlace(p, originLat, originLng) {
    const placeId = String(p.place_id || '');
    const lat = Number(p.geometry?.location?.lat);
    const lng = Number(p.geometry?.location?.lng);
    if (!placeId || !Number.isFinite(lat) || !Number.isFinite(lng))
        return null;
    const km = haversineKm(originLat, originLng, lat, lng);
    return {
        id: `maps:${placeId}`,
        placeId,
        nome: String(p.name || 'Quadra'),
        endereco: p.vicinity || p.formatted_address || undefined,
        lat,
        lng,
        distanciaKm: km,
        rating: typeof p.rating === 'number' ? p.rating : undefined,
        mapsUrl: `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`,
        fonte: 'maps',
    };
}
async function nearbySearch(opts) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${opts.lat},${opts.lng}`);
    url.searchParams.set('radius', String(opts.radiusM));
    url.searchParams.set('keyword', opts.keyword);
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('key', opts.key);
    const res = await fetch(url.toString());
    const json = (await res.json());
    if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
        throw new Error(json.error_message || `Places nearby: ${json.status}`);
    }
    return json.results || [];
}
async function textSearch(opts) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    url.searchParams.set('query', opts.query);
    url.searchParams.set('location', `${opts.lat},${opts.lng}`);
    url.searchParams.set('radius', String(opts.radiusM));
    url.searchParams.set('language', 'pt-BR');
    url.searchParams.set('key', opts.key);
    const res = await fetch(url.toString());
    const json = (await res.json());
    if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
        throw new Error(json.error_message || `Places text: ${json.status}`);
    }
    return json.results || [];
}
/**
 * Busca quadras/clubes próximos via Google Places (não só conveniados).
 * Body: { lat, lng, raioKm?, query? }
 */
exports.buscarQuadrasMaps = (0, https_1.onRequest)({ cors: true, region: 'southamerica-east1' }, async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return;
    }
    try {
        await requireUid(req);
        const key = mapsApiKey();
        if (!key) {
            res.status(503).json({
                error: 'GOOGLE_MAPS_API_KEY não configurada nas Cloud Functions.',
            });
            return;
        }
        const lat = Number(req.body?.lat);
        const lng = Number(req.body?.lng);
        const raioKm = Math.min(50, Math.max(1, Number(req.body?.raioKm) || 15));
        const queryTxt = String(req.body?.query || '').trim();
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            res.status(400).json({ error: 'lat e lng obrigatórios' });
            return;
        }
        const radiusM = Math.round(raioKm * 1000);
        const keywords = [
            'quadra de tênis',
            'clube de tênis',
            'padel',
            'beach tennis',
            'quadra poliesportiva',
        ];
        let raw = [];
        if (queryTxt.length >= 2) {
            raw = await textSearch({
                key,
                lat,
                lng,
                radiusM,
                query: `${queryTxt} tênis padel quadra`,
            });
        }
        else {
            const batches = await Promise.all(keywords.map((keyword) => nearbySearch({ key, lat, lng, radiusM, keyword }).catch(() => [])));
            raw = batches.flat();
        }
        const byId = new Map();
        for (const p of raw) {
            const mapped = mapPlace(p, lat, lng);
            if (!mapped || mapped.distanciaKm > raioKm)
                continue;
            const prev = byId.get(mapped.placeId);
            if (!prev || mapped.distanciaKm < prev.distanciaKm) {
                byId.set(mapped.placeId, mapped);
            }
        }
        const lugares = [...byId.values()].sort((a, b) => a.distanciaKm - b.distanciaKm);
        res.json({ ok: true, lugares: lugares.slice(0, 40) });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro';
        if (msg === 'UNAUTHORIZED') {
            res.status(401).json({ error: 'Não autenticado' });
            return;
        }
        console.error('[buscarQuadrasMaps]', e);
        res.status(500).json({ error: msg });
    }
});
//# sourceMappingURL=buscarQuadrasMaps.js.map