import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from './firebaseConfig';

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

function storageBucket(): string {
  const bucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET não está definido no .env');
  }
  return bucket;
}

function guessContentType(uri: string, mime?: string | null): string {
  if (mime) return mime;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  return 'video/mp4';
}

function downloadUrlFromRestResponse(bucket: string, body: string): string {
  const data = JSON.parse(body) as {
    name: string;
    downloadTokens?: string;
  };
  const token = data.downloadTokens?.split(',')?.[0];
  if (!token) {
    throw new Error('Storage respondeu sem token de download.');
  }
  const encodedName = encodeURIComponent(data.name);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedName}?alt=media&token=${token}`;
}

function parseStorageError(status: number, body: string): string {
  try {
    const err = JSON.parse(body) as { error?: { message?: string } };
    const msg = err.error?.message ?? '';
    if (msg.includes('not been set up') || status === 404) {
      return 'Firebase Storage não está ativo. Ative no Console e faça deploy das rules.';
    }
    if (
      status === 403 ||
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('denied')
    ) {
      return 'Permissão negada no Storage. Confira login e rules de aulas/.';
    }
    return msg || `Upload falhou (HTTP ${status}).`;
  } catch {
    return body?.slice(0, 200) || `Upload falhou (HTTP ${status}).`;
  }
}

async function uploadViaRest(
  uri: string,
  objectPath: string,
  contentType: string
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');

  const file = new File(uri);
  if (!file.exists) {
    throw new Error('Arquivo de vídeo não encontrado.');
  }

  const bytes = await file.bytes();
  if (bytes.byteLength === 0) {
    throw new Error('Vídeo vazio — selecione outro arquivo.');
  }
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('Vídeo muito grande (máx. 200 MB). Comprima ou use um arquivo menor.');
  }

  const bucket = storageBucket();
  const idToken = await user.getIdToken(true);
  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectPath)}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Firebase ${idToken}`,
      'Content-Type': contentType,
    },
    body: bytes,
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(parseStorageError(response.status, responseBody));
  }

  return downloadUrlFromRestResponse(bucket, responseBody);
}

async function uploadViaWebSdk(
  uri: string,
  objectPath: string,
  contentType: string
): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Não foi possível ler o vídeo.');
  const blob = await response.blob();
  if (blob.size > MAX_BYTES) {
    throw new Error('Vídeo muito grande (máx. 200 MB).');
  }
  const storageRef = ref(storage, objectPath);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

/** Upload de aula online → `aulas/{uid}/aula_{ts}.mp4` */
export async function uploadVideoAula(
  uri: string,
  opts?: { mimeType?: string | null; aulaId?: string }
): Promise<{ url: string; path: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');

  const contentType = guessContentType(uri, opts?.mimeType);
  const ext =
    contentType.includes('quicktime') || uri.toLowerCase().endsWith('.mov')
      ? 'mov'
      : 'mp4';
  const objectPath = `aulas/${user.uid}/aula_${opts?.aulaId ?? Date.now()}.${ext}`;

  const url =
    Platform.OS === 'web'
      ? await uploadViaWebSdk(uri, objectPath, contentType)
      : await uploadViaRest(uri, objectPath, contentType);

  return { url, path: objectPath };
}

export function isYoutubeOuVimeo(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com');
}
