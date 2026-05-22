import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from './firebaseConfig';

function storageBucket(): string {
  const bucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET não está definido no .env');
  }
  return bucket;
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
      return 'Firebase Storage não está ativo. No Console: Build → Storage → Get started, depois deploy das rules.';
    }
    if (
      status === 403 ||
      msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('denied')
    ) {
      return 'Permissão negada no Storage. Faça login de novo e tente outra vez. Se persistir, confira as regras no Firebase Console.';
    }
    return msg || `Upload falhou (HTTP ${status}).`;
  } catch {
    return body?.slice(0, 200) || `Upload falhou (HTTP ${status}).`;
  }
}

/**
 * Upload via REST + bytes do arquivo — não usa Blob (quebrado no RN).
 */
async function uploadViaRest(uri: string, objectPath: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');

  const file = new File(uri);
  if (!file.exists) {
    throw new Error('Arquivo de imagem não encontrado.');
  }

  const bytes = await file.bytes();
  if (bytes.byteLength === 0) {
    throw new Error('Imagem vazia — selecione outra foto.');
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
      'Content-Type': 'image/jpeg',
    },
    body: bytes,
  });

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(parseStorageError(response.status, responseBody));
  }

  return downloadUrlFromRestResponse(bucket, responseBody);
}

async function uploadViaWebSdk(uri: string, objectPath: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Não foi possível ler a imagem.');
  const blob = await response.blob();
  const storageRef = ref(storage, objectPath);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

export async function uploadFotoPerfil(uri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Não autenticado');

  const objectPath = `usuarios/${user.uid}/perfil_${Date.now()}.jpg`;

  if (Platform.OS === 'web') {
    return uploadViaWebSdk(uri, objectPath);
  }

  // iOS/Android: REST + Uint8Array — o SDK JS cria Blob internamente e quebra no RN.
  return uploadViaRest(uri, objectPath);
}
