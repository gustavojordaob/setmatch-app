import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import {
  convidarAdminTemporario,
  listarAdminsTemporariosDono,
  revogarAdminTemporario,
} from '../../utils/adminsTemporarios';

export default function AdminsTemporariosScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [clubeId, setClubeId] = useState('');
  const [codigo, setCodigo] = useState('');
  const [admins, setAdmins] = useState<
    { id: string; nome: string; email: string; status: string }[]
  >([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (perfil?.role === 'admin_temporario') {
        Alert.alert('Acesso', 'Só o organizador gerencia admins temporários.');
        router.back();
        return;
      }
      const clubes = await listarClubesDoDono(user.uid);
      const c = clubes.find((x) => x.donoUid === user.uid) ?? clubes[0];
      if (!c) {
        Alert.alert('Clube', 'Crie um clube antes de convidar admin temporário.');
        router.back();
        return;
      }
      setClubeId(c.id);
      const data = await listarAdminsTemporariosDono(c.id);
      setCodigo(data.codigoAcessoAdmin || '');
      setAdmins(data.admins || []);
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, [user, perfil?.role, router]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function convidar() {
    if (!clubeId || !nome.trim() || !email.trim()) {
      Alert.alert('Convite', 'Informe nome e e-mail.');
      return;
    }
    setBusy(true);
    try {
      const r = await convidarAdminTemporario({
        clubeId,
        nome: nome.trim(),
        email: email.trim(),
      });
      setCodigo(r.codigoAcessoAdmin);
      setNome('');
      setEmail('');
      await carregar();
      Alert.alert(
        'Convite criado',
        `Passe o código ${r.codigoAcessoAdmin} para a pessoa. Ela abre Login admin → Perfis, digita o código, clica no perfil e define a senha.`
      );
    } catch (e: unknown) {
      Alert.alert('Convite', e instanceof Error ? e.message : 'Falha');
    } finally {
      setBusy(false);
    }
  }

  async function copiarCodigo() {
    if (!codigo) return;
    try {
      await Share.share({ message: `Código Rally Up (admin temporário): ${codigo}` });
    } catch {
      Alert.alert('Código', codigo);
    }
  }

  function revogar(id: string, n: string) {
    Alert.alert('Revogar', `Remover acesso de ${n}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Revogar',
        style: 'destructive',
        onPress: () =>
          void revogarAdminTemporario(id)
            .then(() => carregar())
            .catch((e: unknown) =>
              Alert.alert('Erro', e instanceof Error ? e.message : 'Falha')
            ),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Admin temporário</Text>
        <View style={{ width: 26 }} />
      </View>
      <Text style={styles.sub}>
        Chame alguém para entrar no painel do organizador. A pessoa vê o perfil, define a senha e
        entra — sem criar conta de organizador própria.
      </Text>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={admins}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 8 }}>
              <View style={styles.codigoCard}>
                <Text style={styles.codigoLabel}>Código do clube (tela de perfis)</Text>
                <Text style={styles.codigoValor}>{codigo || '— (gere ao convidar)'}</Text>
                {codigo ? (
                  <Button label="Copiar código" variant="outline" onPress={() => void copiarCodigo()} />
                ) : null}
              </View>
              <Text style={styles.section}>Novo convite</Text>
              <Input label="Nome" value={nome} onChangeText={setNome} placeholder="Nome da pessoa" />
              <Input
                label="E-mail"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="email@exemplo.com"
              />
              <Button label="Convidar" onPress={() => void convidar()} loading={busy} />
              <Text style={styles.section}>Convidados</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhum admin temporário ainda.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.meta}>{item.email}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              {item.status !== 'revogado' ? (
                <TouchableOpacity onPress={() => revogar(item.id, item.nome)}>
                  <Ionicons name="trash-outline" size={22} color={Colors.danger} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
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
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  sub: {
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  codigoCard: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  codigoLabel: { color: Colors.textOnAccent, fontSize: 12, opacity: 0.85 },
  codigoValor: {
    color: Colors.textOnAccent,
    fontWeight: '800',
    fontSize: 28,
    letterSpacing: 4,
  },
  section: { color: Colors.accent, fontWeight: '700', fontSize: 14, marginTop: 4 },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  nome: { color: Colors.textPrimary, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  status: { color: Colors.accent, fontWeight: '700', fontSize: 11, marginTop: 4 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
});
