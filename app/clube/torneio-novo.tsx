import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import {
  composicaoPadraoPorEsporte,
  labelComposicao,
  type ComposicaoId,
} from '../../constants/composicao';
import {
  DEFINICOES_CHAVE,
  ESTRUTURAS_MATA,
  FORMATOS_CHAVES,
  formatoPartidaPadraoPorEsporte,
  formatosPartidaPorEsporte,
  previewEstruturaTorneio,
  type DefinicaoChaveId,
  type EstruturaMataId,
  type FormatoChavesId,
  type FormatoPartidaTorneioId,
} from '../../constants/chaveamentosTorneio';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import {
  atualizarMidiaTorneio,
  criarTorneioCompleto,
} from '../../services/torneios';
import {
  uploadBannerTorneio,
  uploadLogoTorneio,
} from '../../utils/uploadFoto';

export default function TorneioNovoScreen() {
  const { clubeId } = useLocalSearchParams<{ clubeId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [esporte, setEsporte] = useState<EsporteId>('tenis');
  const [composicao, setComposicao] = useState<ComposicaoId>('simples');
  const [dataInicio, setDataInicio] = useState('');
  const [local, setLocal] = useState('');
  const [horarioPadrao, setHorarioPadrao] = useState('');
  const [quadraNome, setQuadraNome] = useState('');
  const [formatoChaves, setFormatoChaves] = useState<FormatoChavesId>('simples');
  const [definicaoChave, setDefinicaoChave] = useState<DefinicaoChaveId>('sorteio');
  const [estruturaMata, setEstruturaMata] = useState<EstruturaMataId>(16);
  const [qtdGrupos, setQtdGrupos] = useState('4');
  const [jogPorGrupo, setJogPorGrupo] = useState('4');
  const [classifPorGrupo, setClassifPorGrupo] = useState('2');
  const [formatoPartida, setFormatoPartida] =
    useState<FormatoPartidaTorneioId>('tres_sets_de_3');
  const [cobrar, setCobrar] = useState(true);
  const [valor, setValor] = useState('80.00');
  const [prazo, setPrazo] = useState('');
  const [regras, setRegras] = useState(
    'Inscrição via PIX ou cartão. Pagamento até a data limite.'
  );
  const [descontoPix, setDescontoPix] = useState('0');
  const [descontoCartao, setDescontoCartao] = useState('0');
  const [loading, setLoading] = useState(false);
  const [logoLocal, setLogoLocal] = useState<string | null>(null);
  const [bannerLocal, setBannerLocal] = useState<string | null>(null);

  const formatosJogo = useMemo(() => formatosPartidaPorEsporte(esporte), [esporte]);

  async function pickImage(kind: 'logo' | 'banner') {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Mídia', 'Permita acesso às fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'logo' ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    if (kind === 'logo') setLogoLocal(result.assets[0].uri);
    else setBannerLocal(result.assets[0].uri);
  }

  const preview = useMemo(
    () =>
      previewEstruturaTorneio({
        formatoChaves,
        estruturaMata,
        grupos:
          formatoChaves === 'grupos_mata'
            ? {
                qtdGrupos: Number(qtdGrupos) || 0,
                jogadoresPorGrupo: Number(jogPorGrupo) || 0,
                classificadosPorGrupo: Number(classifPorGrupo) || 0,
              }
            : undefined,
      }),
    [formatoChaves, estruturaMata, qtdGrupos, jogPorGrupo, classifPorGrupo]
  );

  async function salvar() {
    if (!clubeId || !nome.trim() || !user) {
      Alert.alert('Torneio', 'Informe o nome do torneio.');
      return;
    }
    const v = Number(String(valor).replace(',', '.')) || 0;
    if (cobrar && v <= 0) {
      Alert.alert('Torneio', 'Informe o valor da inscrição.');
      return;
    }
    setLoading(true);
    try {
      const clubes = await listarClubesDoDono(user.uid);
      const clube = clubes.find((c) => c.id === clubeId) ?? clubes[0];
      if (!clube) {
        Alert.alert('Torneio', 'Clube não encontrado.');
        return;
      }
      const id = await criarTorneioCompleto({
        clubeId: clube.id,
        clubeNome: clube.nome,
        cidade: clube.cidade,
        donoUid: user.uid,
        nome,
        esporte,
        composicao,
        dataInicio,
        local,
        horarioPadrao,
        quadraNome,
        formatoChaves,
        definicaoChave,
        estruturaMata,
        gruposConfig:
          formatoChaves === 'grupos_mata'
            ? {
                qtdGrupos: Number(qtdGrupos) || 4,
                jogadoresPorGrupo: Number(jogPorGrupo) || 4,
                classificadosPorGrupo: Number(classifPorGrupo) || 2,
              }
            : undefined,
        formatoPartidaId: formatoPartida,
        estruturaPreview: preview,
        clubeLogoUrl: clube.logoUrl,
        pagamento: {
          ativo: cobrar,
          valor: v,
          regras: regras.trim(),
          prazoPagamento: prazo.trim(),
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

      const midia: { logoUrl?: string; bannerUrl?: string } = {};
      if (logoLocal) {
        midia.logoUrl = await uploadLogoTorneio(id, logoLocal);
      }
      if (bannerLocal) {
        midia.bannerUrl = await uploadBannerTorneio(id, bannerLocal);
      }
      if (midia.logoUrl || midia.bannerUrl) {
        await atualizarMidiaTorneio(id, midia);
      }

      Alert.alert('Torneio', 'Torneio criado!', [
        { text: 'OK', onPress: () => router.replace('/clube/painel') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Torneio', e instanceof Error ? e.message : 'Falha ao criar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>CRIAR TORNEIO</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Input
          title="Nome"
          value={nome}
          onChangeText={setNome}
          placeholder="Digite o nome do torneio"
        />

        <Text style={styles.sectionLabel}>Divulgação</Text>
        <Text style={styles.hint}>
          Logo do torneio (patrocínio) e banner largo. O logo do clube entra
          automaticamente se já estiver cadastrado.
        </Text>
        <View style={styles.midiaRow}>
          <TouchableOpacity
            style={[styles.midiaBox, styles.midiaLogoBox]}
            onPress={() => void pickImage('logo')}
          >
            {logoLocal ? (
              <Image source={{ uri: logoLocal }} style={styles.midiaLogo} />
            ) : (
              <View style={styles.midiaPlaceholder}>
                <Ionicons name="image-outline" size={22} color={Colors.accent} />
                <Text style={styles.midiaTxt}>Logo</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.midiaBox, styles.midiaBannerBox]}
            onPress={() => void pickImage('banner')}
          >
            {bannerLocal ? (
              <Image source={{ uri: bannerLocal }} style={styles.midiaBanner} />
            ) : (
              <View style={styles.midiaPlaceholder}>
                <Ionicons name="images-outline" size={22} color={Colors.accent} />
                <Text style={styles.midiaTxt}>Banner</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Input title="Data" value={dataInicio} onChangeText={setDataInicio} placeholder="DD/MM" />
          </View>
          <View style={{ flex: 1.15 }}>
            <Input
              title="Localização"
              value={local}
              onChangeText={setLocal}
              placeholder="Clube / cidade"
            />
          </View>
        </View>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Input
              title="Horário (ref.)"
              value={horarioPadrao}
              onChangeText={setHorarioPadrao}
              placeholder="Ex: 09:00"
            />
          </View>
          <View style={{ flex: 1.15 }}>
            <Input
              title="Quadra (opcional)"
              value={quadraNome}
              onChangeText={setQuadraNome}
              placeholder="Ex: Quadra 1"
            />
          </View>
        </View>
        <Text style={[styles.label, { marginTop: -4, opacity: 0.75, fontSize: 12 }]}>
          Horário e quadra são definidos por você — jogadores não reservam na agenda.
        </Text>

        <Text style={styles.label}>Esporte</Text>
        <View style={styles.chips}>
          {ESPORTES.map((e) => (
            <Chip
              key={e.id}
              label={e.nome}
              on={esporte === e.id}
              onPress={() => {
                setEsporte(e.id);
                setComposicao(composicaoPadraoPorEsporte(e.id));
                setFormatoPartida(formatoPartidaPadraoPorEsporte(e.id));
              }}
            />
          ))}
        </View>

        <Text style={styles.label}>Composição</Text>
        <Text style={[styles.label, { marginTop: -4, opacity: 0.75, fontSize: 12 }]}>
          Beach, padel, pickleball e raquetinha sugerem duplas. Cada atleta paga a própria inscrição.
        </Text>
        <View style={styles.chips}>
          {(['simples', 'dupla'] as ComposicaoId[]).map((c) => (
            <Chip
              key={c}
              label={labelComposicao(c)}
              on={composicao === c}
              onPress={() => setComposicao(c)}
            />
          ))}
        </View>

        <Text style={styles.label}>Formato de chaves</Text>
        <View style={styles.chips}>
          {FORMATOS_CHAVES.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              on={formatoChaves === f.id}
              onPress={() => setFormatoChaves(f.id)}
            />
          ))}
        </View>

        {formatoChaves === 'grupos_mata' ? (
          <>
            <Text style={styles.label}>Fase de grupos</Text>
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Input title="Nº grupos" value={qtdGrupos} onChangeText={setQtdGrupos} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Input title="Jog./grupo" value={jogPorGrupo} onChangeText={setJogPorGrupo} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Input title="Classif." value={classifPorGrupo} onChangeText={setClassifPorGrupo} keyboardType="number-pad" />
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Tamanho da chave (mata)</Text>
            <View style={styles.chips}>
              {ESTRUTURAS_MATA.map((e) => (
                <Chip
                  key={e.id}
                  label={e.label}
                  on={estruturaMata === e.id}
                  onPress={() => setEstruturaMata(e.id)}
                />
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Definir chaveamento</Text>
        <View style={styles.chips}>
          {DEFINICOES_CHAVE.map((d) => (
            <Chip
              key={d.id}
              label={d.label}
              on={definicaoChave === d.id}
              onPress={() => setDefinicaoChave(d.id)}
            />
          ))}
        </View>

        <Text style={styles.label}>Formato da Partida</Text>
        <View style={styles.chips}>
          {formatosJogo.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              on={formatoPartida === f.id}
              onPress={() => setFormatoPartida(f.id)}
            />
          ))}
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Estrutura</Text>
          <Text style={styles.previewTxt}>{preview}</Text>
        </View>

        <View style={styles.bannerBox}>
          <Text style={styles.bannerTxt}>Banner (opcional — em breve upload)</Text>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Cobrar inscrição</Text>
          <Switch
            value={cobrar}
            onValueChange={setCobrar}
            trackColor={{ true: Colors.accent, false: Colors.surface }}
          />
        </View>
        {cobrar ? (
          <>
            <Input title="Valor (R$)" value={valor} onChangeText={setValor} keyboardType="decimal-pad" />
            <Input
              title="Desconto PIX (%)"
              value={descontoPix}
              onChangeText={setDescontoPix}
              keyboardType="decimal-pad"
              placeholder="Ex: 10"
            />
            <Input
              title="Desconto cartão (%)"
              value={descontoCartao}
              onChangeText={setDescontoCartao}
              keyboardType="decimal-pad"
              placeholder="Ex: 0"
            />
            <Text style={styles.promoHint}>
              O inscrito vê o desconto do meio na hora de pagar (ex.: PIX −10%).
            </Text>
            <Input title="Prazo pagamento" value={prazo} onChangeText={setPrazo} />
            <Input title="Regras" value={regras} onChangeText={setRegras} />
          </>
        ) : null}
      </ScrollView>

      <ButtonFooter>
        <Button label="Criar torneio" loading={loading} onPress={() => void salvar()} />
      </ButtonFooter>
    </SafeAreaView>
  );
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { color: Colors.accent, fontSize: 22, fontWeight: '900' },
  body: { padding: 16, paddingBottom: 120, gap: 4 },
  sectionLabel: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 14,
    marginTop: 12,
  },
  hint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16, marginBottom: 8 },
  midiaRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  midiaBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  midiaLogoBox: { width: 72 },
  midiaBannerBox: { flex: 1 },
  midiaLogo: { width: 72, height: 72 },
  midiaBanner: { width: '100%', height: 72 },
  midiaPlaceholder: {
    width: '100%',
    minWidth: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  midiaTxt: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: 10 },
  label: { color: Colors.textPrimary, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: '46%',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  chipTxtOn: { color: Colors.textOnAccent },
  preview: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  previewTitle: { color: Colors.accent, fontWeight: '800', marginBottom: 6 },
  previewTxt: { color: Colors.textPrimary, lineHeight: 20 },
  bannerBox: {
    marginTop: 14,
    height: 100,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.surface,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTxt: { color: Colors.textSecondary, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  promoHint: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 18,
  },
});
