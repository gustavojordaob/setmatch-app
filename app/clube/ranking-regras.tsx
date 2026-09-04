import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { KeyboardDoneBar } from '../../components/ui/KeyboardDoneBar';
import {
  RankingRegrasFormFields,
  regrasFromState,
  stateFromRegras,
  type RankingRegrasFormState,
} from '../../components/ranking/RankingRegrasFormFields';
import { useAuth } from '../../hooks/useAuth';
import { atualizarRegrasJogoRanking } from '../../services/rankings';
import {
  REGRAS_JOGO_PADRAO,
  normalizarRegrasJogo,
  type RankingRegrasJogo,
} from '../../types/ranking';
import type { EsporteId } from '../../constants/esportes';

export default function RankingRegrasAdminScreen() {
  const { rankingId } = useLocalSearchParams<{ rankingId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [esporte, setEsporte] = useState<EsporteId>('tenis');
  const [regrasForm, setRegrasForm] = useState<RankingRegrasFormState>(
    stateFromRegras(REGRAS_JOGO_PADRAO)
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rankingId) return;
    void (async () => {
      const snap = await getDoc(doc(db, 'rankings', rankingId));
      if (!snap.exists()) return;
      const raw = snap.data();
      if (user && raw.donoUid !== user.uid) {
        Alert.alert('Ranking', 'Só o dono pode editar as regras.');
        router.back();
        return;
      }
      setNome(String(raw.nome ?? ''));
      setEsporte((raw.esporte as EsporteId) ?? 'tenis');
      const rj = normalizarRegrasJogo(raw.regrasJogo as RankingRegrasJogo | undefined);
      setRegrasForm(stateFromRegras(rj));
    })();
  }, [rankingId, user, router]);

  async function salvar() {
    if (!rankingId) return;
    setLoading(true);
    try {
      await atualizarRegrasJogoRanking(rankingId, regrasFromState(regrasForm));
      Alert.alert('Ranking', 'Regras atualizadas.', [
        { text: 'OK', onPress: () => router.replace(`/ranking/${rankingId}`) },
      ]);
    } catch (e: unknown) {
      Alert.alert('Ranking', e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardDoneBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Regras · Ranking</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.meta}>{nome}</Text>
          <RankingRegrasFormFields
            esporte={esporte}
            value={regrasForm}
            onChange={setRegrasForm}
          />
        </ScrollView>
      </KeyboardAvoidingView>
      <ButtonFooter>
        <Button label="Salvar regras" onPress={salvar} loading={loading} />
      </ButtonFooter>
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
  body: { padding: 20, gap: 14, paddingBottom: 48 },
  meta: { color: Colors.accent, fontWeight: '700' },
});
