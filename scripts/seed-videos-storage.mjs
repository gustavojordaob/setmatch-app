/**
 * Baixa MP4s REAIS de tênis (Mixkit) e sobe no Storage do professor Rodrigo.
 * Uso: node --env-file=.env scripts/seed-videos-storage.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';

const EMAIL = 'rodrigo.patah@setmatch.app';
const PASSWORD = 'SetmatchRodrigo2026!';
const UID = 'xo2uh0Hco6fmukKuWMvcf95K1HN2';
const PROJECT = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const BUCKET = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;

if (!API_KEY || !BUCKET || !PROJECT) {
  console.error('Missing EXPO_PUBLIC_FIREBASE_* env');
  process.exit(1);
}

/** IDs Mixkit conferidos por título na página (quadra / jogo / saque). */
const VIDEOS = [
  {
    aulaId: '70EiNAXVtAX66WGjE22K',
    file: 'forehand.mp4',
    url: 'https://assets.mixkit.co/videos/877/877-720.mp4',
    titulo: 'Forehand — treino na quadra',
    descricao: 'Homem jogando tênis na quadra (stock Mixkit — Man playing tennis).',
  },
  {
    aulaId: 'I67LAvLlyEK5RpKeRIth',
    file: 'backhand.mp4',
    url: 'https://assets.mixkit.co/videos/47278/47278-720.mp4',
    titulo: 'Backhand — bola em jogo',
    descricao: 'Jogador batendo a bola durante o jogo (stock Mixkit).',
  },
  {
    aulaId: '9PJXlmJE2M1itBSo0F51',
    file: 'saque.mp4',
    url: 'https://assets.mixkit.co/videos/873/873-720.mp4',
    titulo: 'Saque — toss e batida',
    descricao: 'Jogador de tênis sacando (stock Mixkit — Tennis player serving).',
  },
  {
    aulaId: 'WrRRSruJC34LnRVe0TrN',
    file: 'partida.mp4',
    url: 'https://assets.mixkit.co/videos/876/876-720.mp4',
    titulo: 'Partida — jogo na quadra',
    descricao: 'Jogadora em partida de tênis (stock Mixkit — aula paga demo).',
  },
];

const tmpDir = join(process.cwd(), 'scripts', '.tmp-videos');
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

async function signIn() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD,
        returnSecureToken: true,
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Auth failed');
  return data.idToken;
}

async function download(url, dest) {
  console.log('download', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fail ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log('saved', dest, buf.length);
}

async function upload(idToken, localPath, objectPath) {
  const bytes = readFileSync(localPath);
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectPath)}`;
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Firebase ${idToken}`,
      'Content-Type': 'video/mp4',
    },
    body: bytes,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload fail ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const token = data.downloadTokens?.split(',')?.[0];
  if (!token) throw new Error('No download token');
  const encoded = encodeURIComponent(data.name);
  return {
    path: objectPath,
    url: `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media&token=${token}`,
  };
}

async function patchAula(idToken, aulaId, patch) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/aulasPublicadas/${aulaId}` +
    `?updateMask.fieldPaths=videoUrl&updateMask.fieldPaths=videoStoragePath&updateMask.fieldPaths=titulo&updateMask.fieldPaths=descricao`;
  const fields = {
    videoUrl: { stringValue: patch.videoUrl },
    videoStoragePath: { stringValue: patch.videoStoragePath },
    titulo: { stringValue: patch.titulo },
    descricao: { stringValue: patch.descricao },
  };
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Firestore patch ${aulaId}: ${res.status} ${text.slice(0, 300)}`);
}

async function main() {
  const idToken = await signIn();
  console.log('auth ok');

  for (const v of VIDEOS) {
    const local = join(tmpDir, v.file);
    await download(v.url, local);
    const objectPath = `aulas/${UID}/tenis_${v.aulaId}.mp4`;
    const up = await upload(idToken, local, objectPath);
    console.log('uploaded', v.aulaId);
    await patchAula(idToken, v.aulaId, {
      videoUrl: up.url,
      videoStoragePath: up.path,
      titulo: v.titulo,
      descricao: v.descricao,
    });
    console.log('firestore ok', v.aulaId, '←', v.url);
  }
  console.log('DONE — vídeos de tênis reais');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
