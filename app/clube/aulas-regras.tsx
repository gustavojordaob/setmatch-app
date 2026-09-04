import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { KeyboardDoneBar, KEYBOARD_DONE_NATIVE_ID } from '../../components/ui/KeyboardDoneBar';
import { useAuth } from '../../hooks/useAuth';
import { atualizarClube, listarClubesDoDono, type ClubeCompleto } from '../../services/clubes';

export default function AulasRegrasScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [clube, setClube] = useState<ClubeCompleto | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [regras, setRegras] = useState('');
  const [regrasGerais, setRegrasGerais] = useState('');
  const [descontoPix, setDescontoPix] = useState('0');
  const [descontoCartao, setDescontoCartao] = useState('0');
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void listarClubesDoDono(user.uid).then((list) => {
        const c = list[0] ?? null;
        setClube(c);
        if (c?.aulas) {
          setAtivo(c.aulas.ativo);
          setRegras(c.aulas.regras || '');
          setDescontoPix(String(c.aulas.descontoPixPercent ?? 0));
          setDescontoCartao(String(c.aulas.descontoCartaoPercent ?? 0));
        }
        setRegrasGerais(c?.regrasGerais || '');
      });
    }, [user])
  );

  async function salvar() {
    if (!clube) return;
    setLoading(true);
    try {
      await atualizarClube(clube.id, {
        regrasGerais: regrasGerais.trim(),
        aulas: {
          ativo,
          // Valor fica nas modalidades — preserva o que já existir no doc
          valorMensal: Number(clube.aulas?.valorMensal ?? 0),
          regras: regras.trim(),
          permitePix: true,
          permiteCartao: true,
          descontoPixPercent: Math.min(
            100,
            Math.max(0, Number(String(descontoPix).replace(',', '.')) || 0)
          ),
          descontoCartaoPercent: Math.min(
            100,
            Math.max(0, Number(String(descontoCartao).replace(',', '.')) || 0)
          ),
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
      <KeyboardDoneBar />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Regras · Aulas</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.sub}>
            Ative aulas no app e defina regras/descontos. O valor de cada aula fica em{' '}
            <Text style={styles.em}>Modalidades</Text> — não aqui.
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
                label="Desconto PIX (%)"
                value={descontoPix}
                onChangeText={setDescontoPix}
                keyboardType="decimal-pad"
                inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
                placeholder="Ex: 10"
              />
              <Input
                label="Desconto cartão (%)"
                value={descontoCartao}
                onChangeText={setDescontoCartao}
                keyboardType="decimal-pad"
                inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
                placeholder="Ex: 0"
              />
              <Input
                label="Regras das aulas / pagamento"
                value={regras}
                onChangeText={setRegras}
                multiline
                placeholder="Cobrança todo dia 5; atraso suspende; PIX ou cartão…"
              />
            </>
          ) : null}
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
  sub: { color: Colors.textSecondary, lineHeight: 20 },
  em: { color: Colors.accent, fontWeight: '700' },
  label: { color: Colors.textPrimary, fontWeight: 'bold', flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
