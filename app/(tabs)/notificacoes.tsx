import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Typography } from '../../constants/typography';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useDesafios, type Desafio } from '../../hooks/useDesafios';
import { db } from '../../utils/firebaseConfig';

export default function NotificacoesScreen() {
  const { user } = useAuth();
  const { desafios, loading } = useDesafios();
  const [nomes, setNomes] = useState<Record<string, string>>({});

  const recebidos = useMemo(
    () =>
      desafios.filter(
        (d) => d.desafiado === user?.uid && d.status === 'pendente'
      ),
    [desafios, user?.uid]
  );

  const carregarNomes = useCallback(async (lista: Desafio[]) => {
    const uids = [...new Set(lista.map((d) => d.desafiante))];
    const entries = await Promise.all(
      uids.map(async (uid) => {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        const nome = snap.exists() ? (snap.data().nome as string) : 'Jogador';
        return [uid, nome] as const;
      })
    );
    setNomes((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
  }, []);

  useEffect(() => {
    if (recebidos.length) void carregarNomes(recebidos);
  }, [recebidos, carregarNomes]);

  async function responder(desafioId: string, status: 'aceito' | 'recusado') {
    try {
      await updateDoc(doc(db, 'desafios', desafioId), { status });
    } catch (e: unknown) {
      Alert.alert('Desafio', e instanceof Error ? e.message : 'Erro ao responder.');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Notificações</Text>
      <FlatList
        data={recebidos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {loading ? 'Carregando…' : 'Nenhum desafio pendente.'}
          </Text>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Text style={styles.nome}>{nomes[item.desafiante] ?? 'Jogador'}</Text>
            <Text style={styles.meta}>
              {item.esporte} · {item.quadra}
            </Text>
            <Text style={styles.msg}>Quer te desafiar!</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.recusar}
                onPress={() => responder(item.id, 'recusado')}
              >
                <Text style={styles.recusarTxt}>Recusar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aceitar}
                onPress={() => responder(item.id, 'aceito')}
              >
                <Text style={styles.aceitarTxt}>Aceitar</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 16 },
  title: { ...Typography.sectionTitle, color: Colors.textPrimary, marginBottom: 14 },
  list: { paddingBottom: 24, gap: 10 },
  card: { marginBottom: 4 },
  nome: { color: Colors.textPrimary, fontWeight: '900', fontSize: 17 },
  meta: { color: Colors.accent, marginTop: 4, textTransform: 'capitalize', fontWeight: '700' },
  msg: { color: Colors.textSecondary, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  recusar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  recusarTxt: { color: Colors.textPrimary, fontWeight: '700' },
  aceitar: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  aceitarTxt: { color: Colors.textOnAccent, fontWeight: '800' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 32 },
});
