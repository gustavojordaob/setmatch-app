import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { getAulaPublicada, type AulaPublicada } from '../../services/aulasPublicadas';
import { isYoutubeOuVimeo } from '../../utils/uploadVideoAula';

export default function AulaDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [aula, setAula] = useState<AulaPublicada | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        setAula(await getAulaPublicada(id));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function abrirExterno() {
    if (!aula?.videoUrl) return;
    const ok = await Linking.canOpenURL(aula.videoUrl);
    if (ok) await Linking.openURL(aula.videoUrl);
  }

  const esporteNome = aula
    ? ESPORTES.find((e) => e.id === aula.esporte)?.nome ?? aula.esporte
    : '';

  const usaPlayerNativo =
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
          {aula.descricao ? <Text style={styles.desc}>{aula.descricao}</Text> : null}

          {!aula.videoUrl ? (
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
  desc: { color: Colors.textSecondary, marginTop: 12, lineHeight: 20 },
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
