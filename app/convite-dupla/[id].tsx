import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../utils/firebaseConfig';
import {
  aceitarConviteDupla,
  recusarConviteDupla,
  type ConviteDupla,
} from '../../services/duplas';

export default function ConviteDuplaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [convite, setConvite] = useState<ConviteDupla | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'convitesDupla', id));
        if (!snap.exists()) {
          setConvite(null);
          return;
        }
        const raw = snap.data();
        setConvite({
          id: snap.id,
          contexto: raw.contexto,
          refId: String(raw.refId),
          refNome: String(raw.refNome ?? ''),
          clubeId: raw.clubeId ? String(raw.clubeId) : undefined,
          clubeNome: raw.clubeNome ? String(raw.clubeNome) : undefined,
          donoUid: raw.donoUid ? String(raw.donoUid) : undefined,
          deUid: String(raw.deUid),
          deNome: String(raw.deNome ?? ''),
          paraUid: String(raw.paraUid),
          paraNome: String(raw.paraNome ?? ''),
          status: raw.status,
          busca: String(raw.busca ?? ''),
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function aceitar() {
    if (!user || !id) return;
    setBusy(true);
    try {
      const c = await aceitarConviteDupla(id, user.uid);
      Alert.alert(
        'Dupla confirmada',
        c.contexto === 'torneio'
          ? 'Se houver taxa, pague a sua parte em Pagamentos para confirmar a inscrição.'
          : 'Quando o clube aceitar a solicitação, cada um paga a própria taxa se houver.',
        [
          {
            text: 'OK',
            onPress: () =>
              router.replace(
                c.contexto === 'torneio' ? `/torneio/${c.refId}` : `/ranking/${c.refId}`
              ),
          },
        ]
      );
    } catch (e: unknown) {
      Alert.alert('Convite', e instanceof Error ? e.message : 'Falha ao aceitar.');
    } finally {
      setBusy(false);
    }
  }

  async function recusar() {
    if (!user || !id) return;
    setBusy(true);
    try {
      await recusarConviteDupla(id, user.uid);
      Alert.alert('Convite', 'Recusado.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: unknown) {
      Alert.alert('Convite', e instanceof Error ? e.message : 'Falha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Convite de dupla</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : !convite ? (
        <Text style={styles.empty}>Convite não encontrado.</Text>
      ) : (
        <View style={styles.body}>
          <Text style={styles.nome}>{convite.deNome}</Text>
          <Text style={styles.meta}>
            te convidou para dupla em {convite.refNome}
            {convite.clubeNome ? ` · ${convite.clubeNome}` : ''}
          </Text>
          <Text style={styles.status}>Status: {convite.status}</Text>

          {convite.status === 'pendente' && user?.uid === convite.paraUid ? (
            <View style={styles.actions}>
              <Button label="Aceitar" onPress={() => void aceitar()} loading={busy} />
              <TouchableOpacity style={styles.recusar} onPress={() => void recusar()} disabled={busy}>
                <Text style={styles.recusarTxt}>Recusar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
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
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  body: { padding: 24, gap: 12 },
  nome: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  meta: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22 },
  status: { color: Colors.accent, fontWeight: '600', marginTop: 8 },
  actions: { marginTop: 24, gap: 12 },
  recusar: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  recusarTxt: { color: Colors.textPrimary, fontWeight: '700' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
