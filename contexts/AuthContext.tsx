import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
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
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { auth, db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [perfilLoading, setPerfilLoading] = useState(false);

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

  useEffect(() => {
    if (webClientId && Platform.OS !== 'web') {
      GoogleSignin.configure({
        webClientId,
        offlineAccess: true,
      });
    }
  }, [webClientId]);

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
    if (!webClientId) {
      Alert.alert(
        'Google Sign-In',
        'Defina EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID no .env (Web client ID em Firebase Console → Authentication → Google).'
      );
      return;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Google Sign-In', 'Use o app iOS/Android.');
      return;
    }
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    const idToken =
      (response as { data?: { idToken?: string | null } }).data?.idToken ??
      (response as { idToken?: string | null }).idToken;
    if (!idToken) {
      throw new Error('Google Sign-In não retornou idToken.');
    }
    const credential = GoogleAuthProvider.credential(idToken);
    await signInWithCredential(auth, credential);
  }, [webClientId]);

  const signOut = useCallback(async () => {
    if (Platform.OS !== 'web') {
      try {
        await GoogleSignin.signOut();
      } catch {
        /* ignore */
      }
    }
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
