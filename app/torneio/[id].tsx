import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ChaveamentoBracket } from '../../components/torneio/ChaveamentoBracket';
import { useAuth } from '../../hooks/useAuth';
import {
  inscreverTorneio,
  jaInscrito,
  ouvirInscritosTorneio,
  type InscricaoTorneio,
  type Torneio,
} from '../../services/torneios';
import {
  gerarChaveamento,
  ouvirConfrontos,
  registrarResultadoConfronto,
  type ConfrontoTorneio,
} from '../../services/chaveamentoTorneio';
import { criarRegistroPagamento } from '../../services/pagamentos';
import { abrirOuCriarConversaClube, enviarMensagem } from '../../services/mensagens';
import { pagarComEscolhaDeMeio, resumoPromoCurto } from '../../utils/checkoutComMeio';
import type { EsporteId } from '../../constants/esportes';

export default function TorneioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [torneio, setTorneio] = useState<Torneio | null>(null);
  const [inscrito, setInscrito] = useState(false);
  const [inscritos, setInscritos] = useState<InscricaoTorneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [confrontos, setConfrontos] = useState<ConfrontoTorneio[]>([]);
  const [edit, setEdit] = useState<ConfrontoTorneio | null>(null);
  const [set1a, setSet1a] = useState('6');
  const [set1b, setSet1b] = useState('4');
  const [set2a, setSet2a] = useState('6');
  const [set2b, setSet2b] = useState('3');
  const [vencedor, setVencedor] = useState<'j1' | 'j2'>('j1');
  const [salvandoPlacar, setSalvandoPlacar] = useState(false);

  async function reloadTorneio() {
    if (!id) return;
    const snap = await getDoc(doc(db, 'torneios', id));
    if (!snap.exists()) return;
    const raw = snap.data();
    setTorneio({
      id: snap.id,
      clubeId: String(raw.clubeId ?? ''),
      clubeNome: String(raw.clubeNome ?? ''),
      cidade: String(raw.cidade ?? ''),
      nome: String(raw.nome ?? ''),
      esporte: (raw.esporte as EsporteId) ?? 'tenis',
      dataInicio: raw.dataInicio ? String(raw.dataInicio) : undefined,
      dataFim: raw.dataFim ? String(raw.dataFim) : undefined,
      descricao: raw.descricao ? String(raw.descricao) : undefined,
      local: raw.local ? String(raw.local) : undefined,
      donoUid: String(raw.donoUid ?? ''),
      status: (raw.status as Torneio['status']) ?? 'aberto',
      totalInscritos: Number(raw.totalInscritos ?? 0),
      estruturaMata: raw.estruturaMata != null ? (Number(raw.estruturaMata) as Torneio['estruturaMata']) : undefined,
      definicaoChave: raw.definicaoChave as Torneio['definicaoChave'],
      campeaoUid: raw.campeaoUid ? String(raw.campeaoUid) : undefined,
      campeaoNome: raw.campeaoNome ? String(raw.campeaoNome) : undefined,
      chaveLiberada: Boolean(raw.chaveLiberada),
      pagamento: raw.pagamento
        ? {
            ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
            valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
            regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
            prazoPagamento: (raw.pagamento as { prazoPagamento?: string }).prazoPagamento
              ? String((raw.pagamento as { prazoPagamento?: string }).prazoPagamento)
              : undefined,
            permitePix: Boolean((raw.pagamento as { permitePix?: boolean }).permitePix ?? true),
            permiteCartao: Boolean(
              (raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true
            ),
            descontoPixPercent: Number(
              (raw.pagamento as { descontoPixPercent?: number }).descontoPixPercent ?? 0
            ),
            descontoCartaoPercent: Number(
              (raw.pagamento as { descontoCartaoPercent?: number }).descontoCartaoPercent ?? 0
            ),
          }
        : undefined,
    });
  }

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        await reloadTorneio();
        if (user) setInscrito(await jaInscrito(id, user.uid));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    return ouvirInscritosTorneio(id, setInscritos);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return ouvirConfrontos(id, setConfrontos);
  }, [id]);

  const souDono = Boolean(user && torneio && user.uid === torneio.donoUid);
  const chaveVisivel =
    Boolean(torneio?.chaveLiberada) ||
    (confrontos.length > 0 && (souDono || torneio?.status !== 'aberto'));

  const confrontosVisiveis = useMemo(
    () => (chaveVisivel ? confrontos : []),
    [chaveVisivel, confrontos]
  );

  async function onInscrever() {
    if (!user || !torneio || !perfil) return;
    if (torneio.status !== 'aberto') {
      Alert.alert('Torneio', 'Inscrições fechadas.');
      return;
    }
    setEnviando(true);
    try {
      await inscreverTorneio({
        torneioId: torneio.id,
        uid: user.uid,
        nome: perfil.nome,
        fotoUrl: perfil.fotoUrl,
        telefone: perfil.telefone,
      });
      setInscrito(true);
      await reloadTorneio();

      // Chat com o clube é opcional — não pode impedir a inscrição
      try {
        const conversaId = await abrirOuCriarConversaClube({
          uid: user.uid,
          nome: perfil.nome,
          clubeId: torneio.clubeId,
          clubeNome: torneio.clubeNome,
          donoUid: torneio.donoUid,
        });
        await enviarMensagem({
          conversaId,
          deUid: user.uid,
          deNome: perfil.nome,
          texto: `Me inscrevi no torneio "${torneio.nome}". ID: ${perfil.setmatchId}. WhatsApp: ${perfil.telefone || '—'}.`,
        });
      } catch {
        // inscrição já gravada
      }

      const paga = torneio.pagamento?.ativo && (torneio.pagamento.valor ?? 0) > 0;
      if (paga && torneio.pagamento) {
        const pagamentoId = await criarRegistroPagamento({
          uid: user.uid,
          setmatchId: perfil.setmatchId || '',
          nome: perfil.nome,
          telefone: perfil.telefone,
          tipo: 'torneio',
          clubeId: torneio.clubeId,
          clubeNome: torneio.clubeNome,
          donoUid: torneio.donoUid,
          torneioId: torneio.id,
          torneioNome: torneio.nome,
          valor: torneio.pagamento.valor,
          ciclo: 'unico',
          status: 'aguardando_pagamento',
        });
        Alert.alert(
          'Inscrição feita',
          [
            `Pague a partir de R$ ${torneio.pagamento.valor.toFixed(2)}.`,
            resumoPromoCurto(torneio.pagamento) || '',
          ]
            .filter(Boolean)
            .join('\n'),
          [
            {
              text: 'Pagar agora',
              onPress: () =>
                void pagarComEscolhaDeMeio({
                  pagamentoId,
                  titulo: `Inscrição · ${torneio.nome}`,
                  ciclo: 'unico',
                  regras: {
                    valor: torneio.pagamento!.valor,
                    permitePix: torneio.pagamento!.permitePix,
                    permiteCartao: torneio.pagamento!.permiteCartao,
                    descontoPixPercent: torneio.pagamento!.descontoPixPercent,
                    descontoCartaoPercent: torneio.pagamento!.descontoCartaoPercent,
                    ciclo: 'unico',
                  },
                }),
            },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('Inscrição feita', 'Você entrou no torneio.');
      }
    } catch (e: unknown) {
      Alert.alert('Torneio', e instanceof Error ? e.message : 'Falha na inscrição.');
    } finally {
      setEnviando(false);
    }
  }

  async function onGerarChave() {
    if (!torneio || !user) return;
    Alert.alert(
      'Liberar chaveamento',
      'Sorteia os confrontos, fecha as inscrições e publica a chave para todos os inscritos. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar agora',
          onPress: () =>
            void (async () => {
              setGerando(true);
              try {
                const n = await gerarChaveamento({
                  torneioId: torneio.id,
                  donoUid: user.uid,
                  estruturaMata: torneio.estruturaMata,
                  sortear: torneio.definicaoChave !== 'manual',
                });
                await reloadTorneio();
                Alert.alert(
                  'Chave liberada',
                  `${n} jogadores na chave. Todos os inscritos já podem ver o chaveamento.`
                );
              } catch (e: unknown) {
                Alert.alert('Chave', e instanceof Error ? e.message : 'Falha ao gerar.');
              } finally {
                setGerando(false);
              }
            })(),
        },
      ]
    );
  }

  function abrirPlacar(c: ConfrontoTorneio) {
    if (c.status !== 'pronto') return;
    const pode =
      souDono || user?.uid === c.j1Uid || user?.uid === c.j2Uid;
    if (!pode) {
      Alert.alert('Confronto', 'Só os jogadores ou o organizador registram o placar.');
      return;
    }
    setEdit(c);
    setVencedor('j1');
    setSet1a('6');
    setSet1b('4');
    setSet2a('6');
    setSet2b('3');
  }

  async function salvarPlacar() {
    if (!edit || !user || !torneio) return;
    setSalvandoPlacar(true);
    try {
      const sets = [
        { j1: Number(set1a) || 0, j2: Number(set1b) || 0 },
        { j1: Number(set2a) || 0, j2: Number(set2b) || 0 },
      ];
      await registrarResultadoConfronto({
        torneioId: torneio.id,
        confrontoId: edit.id,
        sets,
        vencedorUid: vencedor === 'j1' ? edit.j1Uid : edit.j2Uid,
        esporte: torneio.esporte,
        registradoPor: user.uid,
      });
      setEdit(null);
      await reloadTorneio();
      Alert.alert('Resultado', 'Placar salvo e vencedor avançou na chave.');
    } catch (e: unknown) {
      Alert.alert('Placar', e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvandoPlacar(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!torneio) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Torneio não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const pag = torneio.pagamento;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {torneio.nome}
        </Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.clube}>{torneio.clubeNome}</Text>
        <Text style={styles.meta}>
          {torneio.cidade}
          {torneio.local ? ` · ${torneio.local}` : ''}
        </Text>
        <Text style={styles.meta}>
          {torneio.dataInicio || '—'} → {torneio.dataFim || '—'} · {torneio.status} ·{' '}
          {torneio.totalInscritos} inscritos
        </Text>
        {torneio.campeaoNome ? (
          <Text style={styles.campeao}>🏆 Campeão: {torneio.campeaoNome}</Text>
        ) : null}
        {torneio.descricao ? <Text style={styles.desc}>{torneio.descricao}</Text> : null}

        {pag?.ativo ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>
              Inscrição R$ {pag.valor.toFixed(2)} · PIX ou cartão
            </Text>
            {resumoPromoCurto(pag) ? (
              <Text style={styles.desc}>{resumoPromoCurto(pag)}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>
            {inscrito ? 'Você está inscrito' : 'Inscrições'}
          </Text>
        </View>
        <Button
          label={
            inscrito
              ? pag?.ativo
                ? 'Inscrito — ver pagamentos'
                : 'Já inscrito'
              : 'Inscrever-me'
          }
          onPress={() => {
            if (inscrito && pag?.ativo) router.push('/pagamentos');
            else if (!inscrito) void onInscrever();
          }}
          loading={enviando}
          disabled={
            inscrito ? !pag?.ativo : torneio.status !== 'aberto'
          }
        />

        <View style={styles.inscritosBox}>
          <Text style={styles.chaveTitle}>
            Inscritos ({inscritos.length})
          </Text>
          {inscritos.length === 0 ? (
            <Text style={styles.chaveHint}>Ninguém inscrito ainda.</Text>
          ) : (
            inscritos.map((i) => (
              <View key={i.uid} style={styles.inscritoRow}>
                <Avatar uri={i.fotoUrl} nome={i.nome} size="sm" />
                <Text style={styles.inscritoNome} numberOfLines={1}>
                  {i.nome}
                  {user?.uid === i.uid ? ' (você)' : ''}
                </Text>
              </View>
            ))
          )}
        </View>

        {souDono && confrontos.length === 0 ? (
          <Button
            label="Liberar chaveamento (sortear)"
            variant="outline"
            loading={gerando}
            onPress={() => void onGerarChave()}
            disabled={inscritos.length < 2}
          />
        ) : null}
        {souDono && confrontos.length === 0 && inscritos.length < 2 ? (
          <Text style={styles.chaveHint}>
            Precisa de pelo menos 2 inscritos para liberar o chaveamento.
          </Text>
        ) : null}

        {confrontosVisiveis.length > 0 ? (
          <ChaveamentoBracket
            confrontos={confrontosVisiveis}
            onPressMatch={abrirPlacar}
            highlightUid={user?.uid}
          />
        ) : (
          <Text style={styles.chaveHint}>
            {souDono
              ? 'Quando houver 2+ inscritos, toque em Liberar chaveamento para sortear e publicar a chave.'
              : 'O chaveamento aparece para todos quando o organizador liberar o sorteio.'}
          </Text>
        )}
      </ScrollView>

      <Modal visible={!!edit} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrar placar</Text>
            {edit ? (
              <>
                <Text style={styles.meta}>
                  {edit.j1Nome} vs {edit.j2Nome}
                </Text>
                <Text style={styles.modalLabel}>Set 1</Text>
                <View style={styles.scoreRow}>
                  <TextInput
                    style={styles.scoreInput}
                    keyboardType="number-pad"
                    value={set1a}
                    onChangeText={setSet1a}
                  />
                  <Text style={styles.meta}>–</Text>
                  <TextInput
                    style={styles.scoreInput}
                    keyboardType="number-pad"
                    value={set1b}
                    onChangeText={setSet1b}
                  />
                </View>
                <Text style={styles.modalLabel}>Set 2</Text>
                <View style={styles.scoreRow}>
                  <TextInput
                    style={styles.scoreInput}
                    keyboardType="number-pad"
                    value={set2a}
                    onChangeText={setSet2a}
                  />
                  <Text style={styles.meta}>–</Text>
                  <TextInput
                    style={styles.scoreInput}
                    keyboardType="number-pad"
                    value={set2b}
                    onChangeText={setSet2b}
                  />
                </View>
                <Text style={styles.modalLabel}>Vencedor</Text>
                <View style={styles.winnerRow}>
                  <TouchableOpacity
                    style={[styles.winnerChip, vencedor === 'j1' && styles.winnerOn]}
                    onPress={() => setVencedor('j1')}
                  >
                    <Text style={styles.winnerTxt}>{edit.j1Nome.split(' ')[0]}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.winnerChip, vencedor === 'j2' && styles.winnerOn]}
                    onPress={() => setVencedor('j2')}
                  >
                    <Text style={styles.winnerTxt}>{edit.j2Nome.split(' ')[0]}</Text>
                  </TouchableOpacity>
                </View>
                <Button
                  label="Salvar e avançar"
                  loading={salvandoPlacar}
                  onPress={() => void salvarPlacar()}
                />
                <TouchableOpacity onPress={() => setEdit(null)}>
                  <Text style={styles.cancel}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
    paddingBottom: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  clube: { color: Colors.accent, fontSize: 20, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary },
  campeao: { color: Colors.accent, fontWeight: '900', fontSize: 16 },
  desc: { color: Colors.textPrimary, lineHeight: 22, marginTop: 4 },
  payBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    marginTop: 8,
  },
  payTitle: { color: Colors.accent, fontWeight: 'bold' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8,
  },
  badgeTxt: { color: Colors.textPrimary, fontWeight: '600' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  inscritosBox: {
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  inscritoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inscritoNome: { color: Colors.textPrimary, fontWeight: '600', flex: 1 },
  chaveTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: 18 },
  chaveHint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 10,
  },
  modalTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: 18 },
  modalLabel: { color: Colors.textSecondary, fontWeight: '700', marginTop: 6 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreInput: {
    width: 56,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 10,
    fontWeight: '800',
    fontSize: 18,
  },
  winnerRow: { flexDirection: 'row', gap: 10 },
  winnerChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  winnerOn: { backgroundColor: Colors.accent },
  winnerTxt: { color: Colors.textPrimary, fontWeight: '800' },
  cancel: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 12,
  },
});
