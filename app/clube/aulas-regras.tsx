import { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { atualizarClube, listarClubesDoDono, type ClubeCompleto } from '../../services/clubes';

export default function AulasRegrasScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [clube, setClube] = useState<ClubeCompleto | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [valor, setValor] = useState('250.00');
  const [regras, setRegras] = useState('');
  const [regrasGerais, setRegrasGerais] = useState('');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void listarClubesDoDono(user.uid).then((list) => {
        const c = list[0] ?? null;
        setClube(c);
        if (c?.aulas) {
          setAtivo(c.aulas.ativo);
          setValor(String(c.aulas.valorMensal || ''));
          setRegras(c.aulas.regras || '');
        }
        setRegrasGerais(c?.regrasGerais || '');
      });
    }, [user])
  );

  async function salvar() {
    if (!clube) return;
    const v = Number(String(valor).replace(',', '.')) || 0;
    if (ativo && v <= 0) {
      Alert.alert('Aulas', 'Informe o valor mensal.');
      return;
    }
    setLoading(true);
    try {
      await atualizarClube(clube.id, {
        regrasGerais: regrasGerais.trim(),
        aulas: {
          ativo,
          valorMensal: v,
          regras: regras.trim(),
          permitePix: true,
          permiteCartao: true,
        },
      });
      Alert.alert('Aulas', 'Regras salvas.', [
        { text: 'OK', onPress: () => router.replace('/clube/painel') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Aulas', e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Regras · Aulas</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sub}>
          Defina como funcionam as aulas e a cobrança recorrente (mensal via Mercado Pago).
        </Text>
        <Input
          label="Regras gerais do clube"
          value={regrasGerais}
          onChangeText={setRegrasGerais}
          multiline
          placeholder="Horários, dress code, cancelamentos…"
        />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Oferecer aulas pagas no app</Text>
          <Switch value={ativo} onValueChange={setAtivo} trackColor={{ true: Colors.accent }} />
        </View>
        {ativo ? (
          <>
            <Input
              label="Mensalidade (R$)"
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />
            <Input
              label="Regras das aulas / pagamento"
              value={regras}
              onChangeText={setRegras}
              multiline
              placeholder="Cobrança todo dia 5; atraso suspende; PIX ou cartão 1x…"
            />
          </>
        ) : null}
      </ScrollView>
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
  body: { padding: 20, gap: 14 },
  sub: { color: Colors.textSecondary, lineHeight: 20 },
  label: { color: Colors.textPrimary, fontWeight: 'bold', flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
