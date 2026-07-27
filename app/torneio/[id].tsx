import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Radius } from '../../constants/radius';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { inscreverTorneio, jaInscrito, type Torneio } from '../../services/torneios';
import { criarRegistroPagamento } from '../../services/pagamentos';
import { abrirOuCriarConversaClube, enviarMensagem } from '../../services/mensagens';
import { iniciarCheckoutMercadoPago } from '../../utils/mercadoPago';
import type { EsporteId } from '../../constants/esportes';

export default function TorneioDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [torneio, setTorneio] = useState<Torneio | null>(null);
  const [inscrito, setInscrito] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'torneios', id));
        if (snap.exists()) {
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
            pagamento: raw.pagamento
              ? {
                  ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
                  valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
                  regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
                  prazoPagamento: (raw.pagamento as { prazoPagamento?: string }).prazoPagamento
                    ? String((raw.pagamento as { prazoPagamento?: string }).prazoPagamento)
                    : undefined,
                  permitePix: Boolean(
                    (raw.pagamento as { permitePix?: boolean }).permitePix ?? true
                  ),
                  permiteCartao: Boolean(
                    (raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true
                  ),
                }
              : undefined,
          });
        }
        if (user) setInscrito(await jaInscrito(id, user.uid));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user]);

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
          `Pague R$ ${torneio.pagamento.valor.toFixed(2)} (PIX ou cartão 1x). Prazo: ${torneio.pagamento.prazoPagamento || 'conforme regras'}.`,
          [
            {
              text: 'Pagar agora',
              onPress: () =>
                void iniciarCheckoutMercadoPago({
                  pagamentoId,
                  titulo: `Inscrição · ${torneio.nome}`,
                  valor: torneio.pagamento!.valor,
                  ciclo: 'unico',
                  permitePix: torneio.pagamento!.permitePix,
                  permiteCartao: torneio.pagamento!.permiteCartao,
                }),
            },
            { text: 'Meus pagamentos', onPress: () => router.push('/pagamentos') },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('Inscrição feita', 'O admin do clube foi notificado no chat.', [
          { text: 'Abrir chat', onPress: () => router.push(`/chat/${conversaId}`) },
          { text: 'OK' },
        ]);
      }
    } catch (e: unknown) {
      Alert.alert('Torneio', e instanceof Error ? e.message : 'Falha na inscrição.');
    } finally {
      setEnviando(false);
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
          {torneio.dataInicio || '—'} → {torneio.dataFim || '—'} · {torneio.status}
        </Text>
        {torneio.descricao ? <Text style={styles.desc}>{torneio.descricao}</Text> : null}

        {pag?.ativo ? (
          <View style={styles.payBox}>
            <Text style={styles.payTitle}>
              Inscrição R$ {pag.valor.toFixed(2)} · PIX ou cartão 1x
            </Text>
            {pag.prazoPagamento ? (
              <Text style={styles.meta}>Pagar até {pag.prazoPagamento}</Text>
            ) : null}
            {pag.regras ? <Text style={styles.desc}>{pag.regras}</Text> : null}
          </View>
        ) : null}

        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>{inscrito ? 'Você está inscrito' : 'Inscrições abertas'}</Text>
        </View>
        <Button
          label={inscrito ? (pag?.ativo ? 'Inscrito — ver pagamentos' : 'Já inscrito') : 'Inscrever-me'}
          onPress={() => {
            if (inscrito && pag?.ativo) router.push('/pagamentos');
            else if (!inscrito) void onInscrever();
          }}
          loading={enviando}
          disabled={torneio.status !== 'aberto' && !inscrito}
        />
      </ScrollView>
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
  body: { padding: 20, gap: 12 },
  clube: { color: Colors.accent, fontSize: 20, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary },
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
});
