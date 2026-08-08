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
import type { NivelAtividade, UserRole } from '../types/usuario';
import { garantirSetmatchId } from '../services/pagamentos';

WebBrowser.maybeCompleteAuthSession();

export interface UsuarioPerfil {
  nome: string;
  fotoUrl: string;
  email: string;
  role: UserRole;
  setmatchId: string;
  esportes: EsporteId[];
  idade: number;
  genero: string;
  peso: number;
  altura: number;
  nivel: NivelAtividade | '';
  cidade: string;
  bairro: string;
  estado: string;
  cep: string;
  rua: string;
  telefone: string;
  vitorias: number;
  derrotas: number;
  onboardingOk: boolean;
  clubeId?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  perfil: UsuarioPerfil | null;
  onboardingComplete: boolean;
  isAdminClube: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Sempre cria como jogador — admin_clube só via Console/equipe Setmatch. */
  signUpWithEmail: (email: string, password: string, nome?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  saveWizardProfile: (draft: WizardDraft) => Promise<void>;
  updatePerfil: (data: Partial<UsuarioPerfil>) => Promise<void>;
  saveAdminOnboarding: (data: {
    nome: string;
    cidade: string;
    estado?: string;
    telefone: string;
  }) => Promise<void>;
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

function mapPerfil(
  uid: string,
  d: Record<string, unknown>,
  fallbackEmail?: string | null
): UsuarioPerfil {
  return {
    nome: (d.nome as string) ?? 'Jogador',
    fotoUrl: (d.fotoUrl as string) ?? '',
    email: (d.email as string) ?? fallbackEmail ?? '',
    role: (d.role as UserRole) ?? 'jogador',
    setmatchId: (d.setmatchId as string) ?? '',
    esportes: (d.esportes as EsporteId[]) ?? [],
    idade: (d.idade as number) ?? 0,
    genero: (d.genero as string) ?? '',
    peso: (d.peso as number) ?? 0,
    altura: (d.altura as number) ?? 0,
    nivel: (d.nivel as NivelAtividade) ?? '',
    cidade: (d.cidade as string) ?? '',
    bairro: (d.bairro as string) ?? '',
    estado: (d.estado as string) ?? '',
    cep: (d.cep as string) ?? '',
    rua: (d.rua as string) ?? '',
    telefone: (d.telefone as string) ?? '',
    vitorias: (d.vitorias as number) ?? 0,
    derrotas: (d.derrotas as number) ?? 0,
    onboardingOk: (d.onboardingOk as boolean) ?? false,
    clubeId: d.clubeId ? String(d.clubeId) : undefined,
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
      role: 'jogador' as UserRole,
      esportes: [] as EsporteId[],
      idade: 0,
      genero: '',
      peso: 0,
      altura: 0,
      nivel: '' as const,
      cidade: '',
      bairro: '',
      estado: '',
      cep: '',
      rua: '',
      telefone: '',
      vitorias: 0,
      derrotas: 0,
      onboardingOk: false,
      ultimoAcesso: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(ref, { ...base, criadoEm: serverTimestamp() });
      await garantirSetmatchId(u.uid);
    } else {
      await updateDoc(ref, {
        ultimoAcesso: serverTimestamp(),
        email: u.email ?? snap.data().email ?? '',
      });
      const sid = snap.data().setmatchId as string | undefined;
      if (!sid) await garantirSetmatchId(u.uid);
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
      // Marca loading ANTES do await — senão AuthGuard vê user sem perfil
      // e manda pro wizard (flash de idade) por um frame.
      setLoading(true);
      setUser(u);
      try {
        if (u) {
          await ensureUsuarioDoc(u);
          await loadPerfil(u.uid, u.email);
        } else {
          setPerfil(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, [ensureUsuarioDoc, loadPerfil]);

  const onboardingComplete = useMemo(() => !!perfil?.onboardingOk, [perfil?.onboardingOk]);
  /** Painel admin: dono de clube OU professor. */
  const isAdminClube = useMemo(
    () => perfil?.role === 'admin_clube' || perfil?.role === 'professor',
    [perfil?.role]
  );

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, nome?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (nome?.trim()) {
      await updateProfile(cred.user, { displayName: nome.trim() });
    }
    await setDoc(
      doc(db, 'usuarios', cred.user.uid),
      {
        nome: nome?.trim() || 'Jogador',
        email: email.trim(),
        role: 'jogador' as UserRole,
        telefone: '',
        onboardingOk: false,
        criadoEm: serverTimestamp(),
        ultimoAcesso: serverTimestamp(),
      },
      { merge: true }
    );
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
        cidade: draft.cidade ?? '',
        bairro: draft.bairro ?? '',
        estado: draft.estado ?? '',
        cep: draft.cep ?? '',
        rua: draft.rua ?? '',
        telefone: draft.telefone ?? '',
        esportes: draft.esportes ?? [],
        nivel: draft.nivel ?? 'iniciante',
        fotoUrl: draft.fotoUrl ?? user.photoURL ?? '',
        onboardingOk: true,
        ultimoAcesso: serverTimestamp(),
      });
      await garantirSetmatchId(user.uid);
      await loadPerfil(user.uid, user.email);
    },
    [loadPerfil, user]
  );

  const updatePerfil = useCallback(
    async (data: Partial<UsuarioPerfil>) => {
      if (!user) throw new Error('Usuário não autenticado.');
      const { role: _role, onboardingOk: _ok, email: _email, ...safe } = data;
      await updateDoc(doc(db, 'usuarios', user.uid), {
        ...safe,
        ultimoAcesso: serverTimestamp(),
      });
      await loadPerfil(user.uid, user.email);
    },
    [loadPerfil, user]
  );

  const saveAdminOnboarding = useCallback(
    async (data: { nome: string; cidade: string; estado?: string; telefone: string }) => {
      if (!user) throw new Error('Usuário não autenticado.');
      // Não altera role — conta admin já criada pela equipe Setmatch
      await updateDoc(doc(db, 'usuarios', user.uid), {
        nome: data.nome.trim(),
        cidade: data.cidade.trim(),
        estado: data.estado?.trim() ?? '',
        telefone: data.telefone.trim(),
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
      isAdminClube,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshPerfil,
      resetPassword,
      saveWizardProfile,
      updatePerfil,
      saveAdminOnboarding,
    }),
    [
      user,
      loading,
      perfilLoading,
      perfil,
      onboardingComplete,
      isAdminClube,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      refreshPerfil,
      resetPassword,
      saveWizardProfile,
      updatePerfil,
      saveAdminOnboarding,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
