import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import {
  atualizarAulaPublicada,
  criarAulaPublicada,
  excluirAulaPublicada,
  listarAulasDoDono,
  tornarAulasOnlineGratuitas,
  type AulaPublicada,
  type ModoAula,
} from '../../services/aulasPublicadas';
import { uploadVideoAula } from '../../utils/uploadVideoAula';

export default function AulasPublicarScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [modo, setModo] = useState<ModoAula>('online');
  const [lista, setLista] = useState<AulaPublicada[]>([]);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [modulo, setModulo] = useState('Módulo 1');
  const [ordem, setOrdem] = useState('1');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoLocalUri, setVideoLocalUri] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string | null>(null);
  const [videoNome, setVideoNome] = useState('');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [local, setLocal] = useState('');
  const [valor, setValor] = useState('');
  const [esporte, setEsporte] = useState<EsporteId>('tenis');
  const [busy, setBusy] = useState(false);
  const [origemId, setOrigemId] = useState('');
  const [origemNome, setOrigemNome] = useState(perfil?.nome ?? '');

  const carregar = useCallback(async () => {
    if (!user) return;
    const clubes = await listarClubesDoDono(user.uid);
    if (clubes[0]) {
      setOrigemId(clubes[0].id);
      setOrigemNome(clubes[0].nome);
    } else {
      setOrigemId(user.uid);
      setOrigemNome(perfil?.nome ?? 'Professor');
    }
    await tornarAulasOnlineGratuitas(user.uid);
    setLista(await listarAulasDoDono(user.uid));
  }, [user, perfil?.nome]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function escolherVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Vídeo',
        'O Rally Up usa a galeria para você enviar o vídeo da aula, por exemplo ao publicar uma aula online.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
      videoMaxDuration: 60 * 45,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setVideoLocalUri(asset.uri);
    setVideoMime(asset.mimeType ?? null);
    setVideoNome(asset.fileName ?? `video_${Date.now()}.mp4`);
    setVideoUrl('');
  }

  async function salvar() {
    if (!user || !titulo.trim()) {
      Alert.alert('Aula', 'Informe o título.');
      return;
    }
    if (modo === 'online' && !videoLocalUri && !videoUrl.trim()) {
      Alert.alert('Aula', 'Envie um vídeo (upload) ou informe uma URL.');
      return;
    }

    setBusy(true);
    try {
      const origemTipo =
        perfil?.role === 'professor' || !origemId || origemId === user.uid
          ? 'professor'
          : 'clube';

      let finalVideoUrl = modo === 'online' ? videoUrl.trim() : '';
      let videoStoragePath = '';

      if (modo === 'online' && videoLocalUri) {
        const up = await uploadVideoAula(videoLocalUri, { mimeType: videoMime });
        finalVideoUrl = up.url;
        videoStoragePath = up.path;
      }

      await criarAulaPublicada({
        origemTipo,
        origemId: origemId || user.uid,
        origemNome: origemNome || perfil?.nome || 'Instrutor',
        donoUid: user.uid,
        modo,
        esporte,
        titulo,
        descricao,
        modulo: modo === 'online' ? modulo : '',
        ordem: Number(ordem) || 0,
        videoUrl: finalVideoUrl,
        videoStoragePath,
        pago: false,
        valorOnline: 0,
        cidade: modo === 'presencial' ? cidade : '',
        local: modo === 'presencial' ? local : '',
        valorMensal:
          modo === 'presencial' ? Number(String(valor).replace(',', '.')) || 0 : 0,
      });
      setTitulo('');
      setDescricao('');
      setVideoUrl('');
      setVideoLocalUri(null);
      setVideoMime(null);
      setVideoNome('');
      await carregar();
      Alert.alert('Aula', 'Publicada com sucesso!');
    } catch (e: unknown) {
      Alert.alert('Aula', e instanceof Error ? e.message : 'Falha ao publicar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Publicar aulas</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={lista}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <View style={styles.form}>
            <View style={styles.toggle}>
              {(['online', 'presencial'] as ModoAula[]).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.toggleBtn, modo === m && styles.toggleOn]}
                  onPress={() => setModo(m)}
                >
                  <Text style={[styles.toggleTxt, modo === m && styles.toggleTxtOn]}>
                    {m.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Esporte</Text>
            <View style={styles.chips}>
              {ESPORTES.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.chip, esporte === e.id && styles.chipOn]}
                  onPress={() => setEsporte(e.id)}
                >
                  <Text style={[styles.chipTxt, esporte === e.id && styles.chipTxtOn]}>
                    {e.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input title="Título" value={titulo} onChangeText={setTitulo} />
            <Input title="Descrição" value={descricao} onChangeText={setDescricao} />

            {modo === 'online' ? (
              <>
                <Input title="Módulo" value={modulo} onChangeText={setModulo} />
                <Input
                  title="Ordem"
                  value={ordem}
                  onChangeText={setOrdem}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>Vídeo da aula</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={() => void escolherVideo()}>
                  <Ionicons name="cloud-upload-outline" size={22} color={Colors.textOnAccent} />
                  <Text style={styles.uploadTxt}>
                    {videoNome ? `Selecionado: ${videoNome}` : 'Enviar vídeo (galeria)'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.hint}>Máx. 200 MB. Upload vai para o Storage Rally Up.</Text>

                <Input
                  title="Ou URL externa (só demo / YouTube)"
                  value={videoUrl}
                  onChangeText={(t) => {
                    setVideoUrl(t);
                    if (t.trim()) {
                      setVideoLocalUri(null);
                      setVideoNome('');
                    }
                  }}
                  autoCapitalize="none"
                  placeholder="https://..."
                />
              </>
            ) : (
              <>
                <Input title="Cidade" value={cidade} onChangeText={setCidade} />
                <Input title="Local / quadra" value={local} onChangeText={setLocal} />
                <Input
                  title="Valor mensal (R$)"
                  value={valor}
                  onChangeText={setValor}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <Button label="Publicar" loading={busy} onPress={() => void salvar()} />
            <Text style={styles.section}>Publicadas</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma aula ainda.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.titulo}</Text>
              <Text style={styles.rowSub}>
                {item.modo} · {item.modulo || item.cidade || item.esporte}
                {item.videoStoragePath ? ' · upload' : item.videoUrl ? ' · link' : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                void atualizarAulaPublicada(item.id, { ativo: !item.ativo }).then(carregar)
              }
            >
              <Ionicons
                name={item.ativo ? 'eye' : 'eye-off'}
                size={22}
                color={Colors.accent}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Excluir', 'Remover esta aula?', [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: () => void excluirAulaPublicada(item.id).then(carregar),
                  },
                ])
              }
            >
              <Ionicons name="trash-outline" size={22} color={Colors.danger} />
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
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
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold' },
  form: { gap: 8, marginBottom: 8 },
  toggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: 60, padding: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 60, alignItems: 'center' },
  toggleOn: { backgroundColor: Colors.accent },
  toggleTxt: { color: Colors.textPrimary, fontWeight: '800', fontSize: 12 },
  toggleTxtOn: { color: Colors.textOnAccent },
  label: { color: Colors.textSecondary, marginTop: 8, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 60,
    backgroundColor: Colors.surface,
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: Colors.textOnAccent },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  uploadTxt: { color: Colors.textOnAccent, fontWeight: '800', flex: 1, fontSize: 14 },
  hint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16 },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginTop: 16 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  rowTitle: { color: Colors.textPrimary, fontWeight: '700' },
  rowSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
});
