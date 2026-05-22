import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebaseConfig';

export async function uploadFotoPerfil(uid: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `usuarios/${uid}/perfil.jpg`);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}
