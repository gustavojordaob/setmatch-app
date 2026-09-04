import { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import {
  composicaoPadraoPorEsporte,
  labelComposicao,
  type ComposicaoId,
} from '../../constants/composicao';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { KeyboardDoneBar, KEYBOARD_DONE_NATIVE_ID } from '../../components/ui/KeyboardDoneBar';
import {
  RankingRegrasFormFields,
  regrasFromState,
  stateFromRegras,
  type RankingRegrasFormState,
} from '../../components/ranking/RankingRegrasFormFields';
import { useAuth } from '../../hooks/useAuth';
import { criarRankingNoClube } from '../../services/clubes';
import { REGRAS_JOGO_PADRAO } from '../../types/ranking';
import { formatoPartidaPadraoPorEsporte } from '../../constants/chaveamentosTorneio';

export default function RankingNovoAdminScreen() {
  const { clubeId } = useLocalSearchParams<{ clubeId: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [clubeNome, setClubeNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [clubeLogoUrl, setClubeLogoUrl] = useState('');
  const [nome, setNome] = useState('');
  const [esporte, setEsporte] = useState<EsporteId>('tenis');
  const [composicao, setComposicao] = useState<ComposicaoId>('simples');
  const [cobrar, setCobrar] = useState(false);
  const [valor, setValor] = useState('49.90');
  const [cicloMensal, setCicloMensal] = useState(true);
  const [exigeEntrar, setExigeEntrar] = useState(true);
  const [regras, setRegras] = useState('');
  const [descontoPix, setDescontoPix] = useState('0');
  const [descontoCartao, setDescontoCartao] = useState('0');
  const [regrasForm, setRegrasForm] = useState<RankingRegrasFormState>(
    stateFromRegras(REGRAS_JOGO_PADRAO)
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clubeId) return;
    void (async () => {
      const snap = await getDoc(doc(db, 'clubes', clubeId));
      if (snap.exists()) {
        const d = snap.data();
        setClubeNome(String(d.nome ?? ''));
        setCidade(String(d.cidade ?? ''));
        setClubeLogoUrl(String(d.logoUrl ?? ''));
        const esp = (d.esportes as EsporteId[])?.[0] ?? (d.esporte as EsporteId);
        if (esp) {
          setEsporte(esp);
          setComposicao(composicaoPadraoPorEsporte(esp));
          setRegrasForm((prev) => ({
            ...prev,
            formato: formatoPartidaPadraoPorEsporte(esp),
          }));
        }
      }
    })();
  }, [clubeId]);

  async function salvar() {
    if (!user || !clubeId || !nome.trim()) {
      Alert.alert('Ranking', 'Informe o nome do ranking.');
      return;
    }
    const v = Number(String(valor).replace(',', '.')) || 0;
    if (cobrar && v <= 0) {
      Alert.alert('Ranking', 'Informe o valor da mensalidade/taxa.');
      return;
    }
    setLoading(true);
    try {
      const id = await criarRankingNoClube({
        clubeId,
        clubeNome,
        cidade,
        esporte,
        composicao,
        nome,
        donoUid: user.uid,
        donoNome: perfil?.nome ?? 'Admin',
        donoFotoUrl: perfil?.fotoUrl,
        clubeLogoUrl: clubeLogoUrl || undefined,
        regrasJogo: regrasFromState(regrasForm),
        pagamento: {
          ativo: cobrar,
          valor: v,
          ciclo: cicloMensal ? 'mensal' : 'unico',
          regras: regras.trim(),
          exigeParaEntrar: cobrar && exigeEntrar,
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
      router.replace(`/ranking/${id}`);
    } catch (e: unknown) {
      Alert.alert('Ranking', e instanceof Error ? e.message : 'Erro ao criar.');
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
        <Text style={styles.title}>Novo ranking</Text>
        <View style={{ width: 26 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.meta}>{clubeNome}</Text>
          <Input
            label="Nome do ranking"
            value={nome}
            onChangeText={setNome}
            placeholder="Winner 2026"
          />
          <Text style={styles.label}>Esporte</Text>
          <View style={styles.chips}>
            {ESPORTES.map((e) => {
              const on = e.id === esporte;
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => {
                    setEsporte(e.id);
                    setComposicao(composicaoPadraoPorEsporte(e.id));
                    setRegrasForm((prev) => ({
                      ...prev,
                      formato: formatoPartidaPadraoPorEsporte(e.id),
                    }));
                  }}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{e.nome}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Composição</Text>
          <Text style={[styles.meta, { marginBottom: 8 }]}>
            Pickleball, padel e beach sugerem duplas. Em duplas, cada jogador paga a própria taxa.
          </Text>
          <View style={styles.chips}>
            {(['simples', 'dupla'] as ComposicaoId[]).map((c) => {
              const on = composicao === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setComposicao(c)}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                    {labelComposicao(c)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <RankingRegrasFormFields
            esporte={esporte}
            value={regrasForm}
            onChange={setRegrasForm}
          />

          <View style={styles.switchRow}>
            <Text style={styles.label}>Cobrar pelo ranking (Stripe)</Text>
            <Switch value={cobrar} onValueChange={setCobrar} trackColor={{ true: Colors.accent }} />
          </View>
          {cobrar ? (
            <>
              <Input
                label="Valor (R$)"
                value={valor}
                onChangeText={setValor}
                keyboardType="decimal-pad"
                inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
              />
              <View style={styles.switchRow}>
                <Text style={styles.label}>Recorrente mensal (cartão auto)</Text>
                <Switch
                  value={cicloMensal}
                  onValueChange={setCicloMensal}
                  trackColor={{ true: Colors.accent }}
                />
              </View>
              <Input
                label="Desconto PIX (%)"
                value={descontoPix}
                onChangeText={setDescontoPix}
                keyboardType="decimal-pad"
                inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
              />
              <Input
                label="Desconto cartão (%)"
                value={descontoCartao}
                onChangeText={setDescontoCartao}
                keyboardType="decimal-pad"
                inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
              />
              <View style={styles.switchRow}>
                <Text style={styles.label}>Exigir pagamento para entrar</Text>
                <Switch
                  value={exigeEntrar}
                  onValueChange={setExigeEntrar}
                  trackColor={{ true: Colors.accent }}
                />
              </View>
              <Input
                label="Regras de pagamento"
                value={regras}
                onChangeText={setRegras}
                multiline
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <ButtonFooter>
        <Button label="Criar ranking" onPress={salvar} loading={loading} />
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
  meta: { color: Colors.accent, fontWeight: '600' },
  label: { color: Colors.textPrimary, fontWeight: 'bold', flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '600' },
  chipTxtOn: { color: Colors.textOnAccent },
});
