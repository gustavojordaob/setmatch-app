import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { StatsCard } from '../../components/jogador/StatsCard';
import { useAuth } from '../../hooks/useAuth';
import { abrirOuCriarConversaAmigo } from '../../services/mensagens';
import { abrirWhatsApp } from '../../utils/whatsapp';
import type { UsuarioPerfil } from '../../contexts/AuthContext';

export default function JogadorScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { user, perfil: meuPerfil } = useAuth();
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        if (snap.exists()) {
          const d = snap.data();
          setPerfil({
            nome: String(d.nome ?? 'Jogador'),
            fotoUrl: String(d.fotoUrl ?? ''),
            email: String(d.email ?? ''),
            role: (d.role as UsuarioPerfil['role']) ?? 'jogador',
            esportes: (d.esportes as UsuarioPerfil['esportes']) ?? [],
            idade: Number(d.idade ?? 0),
            genero: String(d.genero ?? ''),
            peso: Number(d.peso ?? 0),
            altura: Number(d.altura ?? 0),
            nivel: (d.nivel as UsuarioPerfil['nivel']) ?? '',
            cidade: String(d.cidade ?? ''),
            bairro: String(d.bairro ?? ''),
            estado: String(d.estado ?? ''),
            cep: String(d.cep ?? ''),
            rua: String(d.rua ?? ''),
            telefone: String(d.telefone ?? ''),
            vitorias: Number(d.vitorias ?? 0),
            derrotas: Number(d.derrotas ?? 0),
            onboardingOk: Boolean(d.onboardingOk),
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  async function mensagem() {
    if (!user || !meuPerfil || !uid || !perfil) return;
    try {
      const id = await abrirOuCriarConversaAmigo({
        uidA: user.uid,
        nomeA: meuPerfil.nome,
        uidB: uid,
        nomeB: perfil.nome,
      });
      router.push(`/chat/${id}`);
    } catch (e: unknown) {
      Alert.alert(
        'Mensagem',
        e instanceof Error ? e.message : 'Não foi possível abrir o chat.'
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Jogador não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const souEu = user?.uid === uid;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.top}>
          <Avatar uri={perfil.fotoUrl} nome={perfil.nome} size="xl" verified />
          <Text style={styles.nome}>{perfil.nome}</Text>
          {perfil.cidade ? (
            <Text style={styles.meta}>
              {[perfil.bairro, perfil.cidade, perfil.estado].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {perfil.nivel ? <Text style={styles.meta}>Nível: {perfil.nivel}</Text> : null}
        </View>

        <StatsCard vitorias={perfil.vitorias} derrotas={perfil.derrotas} />

        {!souEu ? (
          <View style={styles.actions}>
            <Button
              label="Convidar para jogar"
              onPress={() =>
                router.push({ pathname: '/desafio/novo', params: { desafiadoUid: uid } })
              }
            />
            <Button label="Mensagem no app" variant="outline" onPress={() => void mensagem()} />
            {perfil.telefone ? (
              <Button
                label="WhatsApp"
                variant="outline"
                onPress={() =>
                  void abrirWhatsApp(
                    perfil.telefone,
                    `Olá ${perfil.nome}! Vi seu perfil no Setmatch. Bora marcar um jogo?`
                  )
                }
              />
            ) : null}
          </View>
        ) : (
          <Button label="Editar meu perfil" onPress={() => router.push('/perfil/editar')} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  top: { alignItems: 'center', gap: 8 },
  nome: { color: Colors.textPrimary, fontSize: 26, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, textAlign: 'center' },
  actions: { gap: 12, marginTop: 8 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
