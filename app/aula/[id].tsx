import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ResizeMode, Video } from 'expo-av';
import { Colors } from '../../constants/colors';
import { ESPORTES } from '../../constants/esportes';
import { useAuth } from '../../hooks/useAuth';
import {
  getAulaPublicada,
  pedirLiberacaoAulaOnline,
  temAcessoAulaOnline,
  type AulaPublicada,
} from '../../services/aulasPublicadas';
import { abrirOuCriarConversaAmigo, enviarMensagem } from '../../services/mensagens';
import { isYoutubeOuVimeo } from '../../utils/uploadVideoAula';

export default function AulaDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [aula, setAula] = useState<AulaPublicada | null>(null);
  const [liberada, setLiberada] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const a = await getAulaPublicada(id);
        setAula(a);
        if (a) {
          setLiberada(await temAcessoAulaOnline(user?.uid, a));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user?.uid]);

  async function abrirExterno() {
    if (!aula?.videoUrl || !liberada) return;
    const ok = await Linking.canOpenURL(aula.videoUrl);
    if (ok) await Linking.openURL(aula.videoUrl);
  }

  /** Fluxo único: mensagem ao professor/clube — liberação combinada no chat. */
  async function handleFalarProfessor() {
    if (!user || !aula || !perfil) return;
    setBusy(true);
    try {
      await pedirLiberacaoAulaOnline({
        aula,
        uid: user.uid,
        nome: perfil.nome || user.displayName || 'Aluno',
        setmatchId: perfil.setmatchId,
        telefone: perfil.telefone,
      });

      const conversaId = await abrirOuCriarConversaAmigo({
        uidA: user.uid,
        nomeA: perfil.nome || 'Aluno',
        uidB: aula.donoUid,
        nomeB: aula.origemNome,
      });
      await enviarMensagem({
        conversaId,
        deUid: user.uid,
        deNome: perfil.nome || 'Aluno',
        texto:
          `Olá! Quero acesso à aula "${aula.titulo}". ` +
          `Meu ID Setmatch: ${perfil.setmatchId || '—'}. ` +
          `Pode me liberar por aqui?`,
      });

      Alert.alert(
        'Mensagem enviada',
        'Combine a liberação com o professor/clube no chat. Quando ele liberar no financeiro, o vídeo aparece aqui.',
        [
          { text: 'Abrir chat', onPress: () => router.push(`/chat/${conversaId}`) },
          { text: 'OK' },
        ]
      );
    } catch (e: unknown) {
      Alert.alert(
        'Erro',
        e instanceof Error ? e.message : 'Não foi possível abrir a conversa.'
      );
    } finally {
      setBusy(false);
    }
  }

  const esporteNome = aula
    ? ESPORTES.find((e) => e.id === aula.esporte)?.nome ?? aula.esporte
    : '';

  const usaPlayerNativo =
    liberada &&
    !!aula?.videoUrl &&
    (!!aula.videoStoragePath || !isYoutubeOuVimeo(aula.videoUrl));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color={Colors.accent} />
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : !aula ? (
        <Text style={styles.empty}>Aula não encontrada.</Text>
      ) : (
        <View style={styles.body}>
          <Text style={styles.origem}>
            {aula.origemNome} · {esporteNome}
          </Text>
          <Text style={styles.title}>{aula.titulo}</Text>
          {aula.modulo ? <Text style={styles.mod}>{aula.modulo}</Text> : null}

          <View style={[styles.badge, aula.pago ? styles.badgePago : styles.badgeGratis]}>
            <Text style={styles.badgeTxt}>
              {aula.pago
                ? `Aula exclusiva${aula.valorOnline ? ` · ref. R$ ${aula.valorOnline.toFixed(2)}` : ''}`
                : 'Aula grátis'}
            </Text>
          </View>

          {aula.descricao ? <Text style={styles.desc}>{aula.descricao}</Text> : null}

          {!liberada ? (
            <View style={styles.locked}>
              <Ionicons name="lock-closed" size={36} color={Colors.accent} />
              <Text style={styles.lockedTitle}>Conteúdo exclusivo</Text>
              <Text style={styles.lockedTxt}>
                Envie uma mensagem ao professor ou clube. Na conversa vocês
                combinam e ele libera o acesso.
              </Text>

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => void handleFalarProfessor()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={Colors.textOnAccent} />
                ) : (
                  <Text style={styles.btnPrimaryTxt}>
                    Mensagem para liberar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : !aula.videoUrl ? (
            <View style={styles.video}>
              <Text style={styles.videoHint}>Vídeo em breve</Text>
            </View>
          ) : usaPlayerNativo ? (
            <Video
              style={styles.videoPlayer}
              source={{ uri: aula.videoUrl }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={false}
            />
          ) : (
            <TouchableOpacity style={styles.video} onPress={() => void abrirExterno()}>
              <View style={styles.play}>
                <Ionicons name="play" size={36} color={Colors.textOnAccent} />
              </View>
              <Text style={styles.videoHint}>Abrir no YouTube / Vimeo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  back: { padding: 16 },
  body: { paddingHorizontal: 20 },
  origem: { color: Colors.textSecondary, fontWeight: '600' },
  title: { color: Colors.textPrimary, fontSize: 24, fontWeight: '900', marginTop: 8 },
  mod: { color: Colors.accent, fontWeight: '700', marginTop: 6 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderRadius: 60,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeGratis: { backgroundColor: 'rgba(199,217,65,0.25)' },
  badgePago: { backgroundColor: Colors.surface },
  badgeTxt: { color: Colors.textPrimary, fontWeight: '800', fontSize: 12 },
  desc: { color: Colors.textSecondary, marginTop: 12, lineHeight: 20 },
  locked: {
    marginTop: 28,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  lockedTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: 18 },
  lockedTxt: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  btnPrimary: {
    marginTop: 8,
    width: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPrimaryTxt: { color: Colors.textOnAccent, fontWeight: '900', fontSize: 15 },
  video: {
    marginTop: 24,
    height: 220,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  videoPlayer: {
    marginTop: 24,
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: '#000',
  },
  play: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  videoHint: { color: Colors.textPrimary, fontWeight: '700' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
});
