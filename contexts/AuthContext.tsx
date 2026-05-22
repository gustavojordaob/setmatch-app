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
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Alert, Platform } from 'react-native';
import { auth, db } from '../utils/firebaseConfig';
import type { EsporteId } from '../constants/esportes';
import type { WizardDraft } from './WizardContext';
import type { NivelAtividade } from '../types/usuario';

WebBrowser.maybeCompleteAuthSession();

export interface UsuarioPerfil {
  nome: string;
  fotoUrl: string;
  email: string;
  esportes: EsporteId[];
  idade: number;
  genero: string;
  peso: number;
  altura: number;
  nivel: NivelAtividade | '';
  vitorias: number;
  derrotas: number;
  onboardingOk: boolean;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  perfil: UsuarioPerfil | null;
  onboardingComplete: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, nome?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveWizardProfile: (draft: WizardDraft) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function hasGoogleWebClientId() {
  return !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB?.trim();
}

function googleOAuthRedirectUri(): string {
  try {
    return getRedirectUrl();
  } catch {
    return makeRedirectUri({ scheme: 'setmatch' });
  }
}

function mapPerfil(uid: string, d: Record<string, unknown>, fallbackEmail?: string | null): UsuarioPerfil {
  return {
    nome: (d.nome as string) ?? 'Jogador',
    fotoUrl: (d.fotoUrl as string) ?? '',
    email: (d.email as string) ?? fallbackEmail ?? '',
    esportes: (d.esportes as EsporteId[]) ?? [],
    idade: (d.idade as number) ?? 0,
    genero: (d.genero as string) ?? '',
    peso: (d.peso as number) ?? 0,
    altura: (d.altura as number) ?? 0,
    nivel: (d.nivel as NivelAtividade) ?? '',
    vitorias: (d.vitorias as number) ?? 0,
    derrotas: (d.derrotas as number) ?? 0,
    onboardingOk: (d.onboardingOk as boolean) ?? false,
  };
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
      email: u.email ?? '',
      esportes: [] as EsporteId[],
      idade: 0,
      genero: '',
      peso: 0,
      altura: 0,
      nivel: '' as const,
      vitorias: 0,
      derrotas: 0,
      onboardingOk: false,
      ultimoAcesso: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, { ...base, criadoEm: serverTimestamp() });
    } else {
      await updateDoc(ref, {
        ultimoAcesso: serverTimestamp(),
        email: u.email ?? snap.data().email ?? '',
      });
    }
  }, []);

  const loadPerfil = useCallback(async (uid: string, fallbackEmail?: string | null) => {
    setPerfilLoading(true);
    try {
      const snap = await getDoc(doc(db, 'usuarios', uid));
      if (!snap.exists()) {
        setPerfil(null);
        return;
      }
      setPerfil(mapPerfil(uid, snap.data(), fallbackEmail));
    } finally {
      setPerfilLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await ensureUsuarioDoc(u);
        await loadPerfil(u.uid, u.email);
      } else {
        setPerfil(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [ensureUsuarioDoc, loadPerfil]);

  const onboardingComplete = useMemo(() => !!perfil?.onboardingOk, [perfil?.onboardingOk]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, nome?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (nome?.trim()) {
      await updateProfile(cred.user, { displayName: nome.trim() });
      await setDoc(
        doc(db, 'usuarios', cred.user.uid),
        { nome: nome.trim(), ultimoAcesso: serverTimestamp() },
        { merge: true }
      );
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!hasGoogleWebClientId()) {
      Alert.alert(
        'Google Sign-In',
        'Defina EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB no .env e cadastre o redirect URI no Google Cloud Console.'
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
    if (user) await loadPerfil(user.uid, user.email);
  }, [loadPerfil, user]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const saveWizardProfile = useCallback(
    async (draft: WizardDraft) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const ref = doc(db, 'usuarios', user.uid);
      await updateDoc(ref, {
        idade: draft.idade ?? 0,
        genero: draft.genero ?? '',
        peso: draft.peso ?? 0,
        altura: draft.altura ?? 0,
        esportes: draft.esportes ?? [],
        nivel: draft.nivel ?? 'iniciante',
        fotoUrl: draft.fotoUrl ?? user.photoURL ?? '',
        onboardingOk: true,
        ultimoAcesso: serverTimestamp(),
      });
      await loadPerfil(user.uid, user.email);
    },
    [loadPerfil, user]
  );

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
      resetPassword,
      saveWizardProfile,
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
      resetPassword,
      saveWizardProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
