import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getRedirectUrl, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import { auth, db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

WebBrowser.maybeCompleteAuthSession();

export interface UsuarioPerfil {
  nome: string;
  fotoUrl: string;
  esportes: EsporteId[];
  vitorias: number;
  derrotas: number;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  perfil: UsuarioPerfil | null;
  onboardingComplete: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function hasGoogleWebClientId() {
  return !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB?.trim();
}

/**
 * Redirect OAuth que o Google valida no cliente Web.
 * No Expo Go, use o proxy `https://auth.expo.io/@owner/slug` (antes obtido com `makeRedirectUri({ useProxy: true })`;
 * no SDK 54+ isso vem de `getRedirectUrl()` — `useProxy` foi removido de `makeRedirectUri`.
 */
function googleOAuthRedirectUri(): string {
  try {
    return getRedirectUrl();
  } catch {
    return makeRedirectUri({ scheme: 'setmatch' });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [perfilLoading, setPerfilLoading] = useState(false);

  const redirectUri = googleOAuthRedirectUri();

  const [_request, _response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? '',
    redirectUri,
  });

  const ensureUsuarioDoc = useCallback(async (u: User) => {
    const ref = doc(db, 'usuarios', u.uid);
    const snap = await getDoc(ref);
    const base = {
      nome: u.displayName ?? 'Jogador',
      fotoUrl: u.photoURL ?? '',
      esportes: [] as EsporteId[],
      vitorias: 0,
      derrotas: 0,
      ultimoAcesso: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, {
        ...base,
        criadoEm: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, { ultimoAcesso: serverTimestamp() });
    }
  }, []);

  const loadPerfil = useCallback(async (uid: string) => {
    setPerfilLoading(true);
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (!snap.exists()) {
        setPerfil(null);
        return;
      }
      const d = snap.data();
      setPerfil({
        nome: (d.nome as string) ?? '',
        fotoUrl: (d.fotoUrl as string) ?? '',
        esportes: (d.esportes as EsporteId[]) ?? [],
        vitorias: (d.vitorias as number) ?? 0,
        derrotas: (d.derrotas as number) ?? 0,
      });
    } finally {
      setPerfilLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await ensureUsuarioDoc(u);
        await loadPerfil(u.uid);
      } else {
        setPerfil(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [ensureUsuarioDoc, loadPerfil]);

  const onboardingComplete = useMemo(
    () => !!perfil?.esportes?.length,
    [perfil?.esportes?.length]
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!hasGoogleWebClientId()) {
      Alert.alert(
        'Google Sign-In',
        'Defina EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB no .env (OAuth 2.0 Web client ID) e cadastre o redirect URI no Google Cloud Console.'
      );
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Google Sign-In', 'Use o app iOS/Android.');
      return;
    }
    const result = await promptAsync();
    if (result.type !== 'success') return;
    const idToken = result.params.id_token;
    if (!idToken || typeof idToken !== 'string') {
      throw new Error('Google Sign-In não retornou id_token.');
    }
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }, [promptAsync]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setPerfil(null);
  }, []);

  const refreshPerfil = useCallback(async () => {
    if (user) await loadPerfil(user.uid);
  }, [loadPerfil, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: loading || perfilLoading,
      perfil,
      onboardingComplete,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshPerfil,
    }),
    [
      user,
      loading,
      perfilLoading,
      perfil,
      onboardingComplete,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshPerfil,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
