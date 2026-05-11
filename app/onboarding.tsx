import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { ESPORTES, type EsporteId } from '../constants/esportes';
import { Button } from '../components/ui/Button';
import { db } from '../utils/firebaseConfig';
import { useAuth } from '../hooks/useAuth';

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, refreshPerfil } = useAuth();
  const [selecionados, setSelecionados] = useState<EsporteId[]>([]);
  const [saving, setSaving] = useState(false);

  function toggle(id: EsporteId) {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function salvar() {
    if (!user) return;
    if (!selecionados.length) {
      Alert.alert('Esportes', 'Selecione ao menos um esporte.');
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { esportes: selecionados });
      await refreshPerfil();
      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Quais esportes você joga?</Text>
        <Text style={styles.sub}>Toque para selecionar — pode escolher mais de um.</Text>
        <View style={styles.pills}>
          {ESPORTES.map((e) => {
            const on = selecionados.includes(e.id);
            return (
              <TouchableOpacity
                key={e.id}
                onPress={() => toggle(e.id)}
                style={[styles.pill, on && styles.pillSelected]}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillEmoji, on && styles.pillEmojiOn]}>{e.emoji}</Text>
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{e.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Button title="Continuar" onPress={salvar} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
  },
  sub: { color: Colors.textSecondary, lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  pill: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillSelected: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  pillEmoji: { fontSize: 18 },
  pillEmojiOn: {},
  pillText: { color: Colors.textPrimary, fontWeight: '700' },
  pillTextOn: { color: Colors.primary },
});
