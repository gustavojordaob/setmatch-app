import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import { listarTorneiosDoClube, type Torneio } from '../../services/torneios';
import { abrirOuCriarConversaAmigo, enviarMensagem } from '../../services/mensagens';
import { abrirWhatsApp } from '../../utils/whatsapp';

type Inscrito = { uid: string; nome: string; telefone?: string };

export default function TorneioMensagensScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [torneioId, setTorneioId] = useState<string>();
  const [inscritos, setInscritos] = useState<Inscrito[]>([]);
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const clubes = await listarClubesDoDono(user.uid);
      if (!clubes[0]) {
        setTorneios([]);
        return;
      }
      const list = await listarTorneiosDoClube(clubes[0].id);
      setTorneios(list);
      setTorneioId((prev) => prev ?? list[0]?.id);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!torneioId) {
      setInscritos([]);
      return;
    }
    void (async () => {
      const snap = await getDocs(collection(db, 'torneios', torneioId, 'inscritos'));
      setInscritos(
        snap.docs.map((d) => {
          const raw = d.data();
          return {
            uid: d.id,
            nome: String(raw.nome ?? 'Jogador'),
            telefone: raw.telefone ? String(raw.telefone) : undefined,
          };
        })
      );
    })();
  }, [torneioId]);

  async function enviarTodos() {
    if (!user || !perfil || !texto.trim() || !torneioId) return;
    if (inscritos.length === 0) {
      Alert.alert('Mensagens', 'Este torneio ainda não tem inscritos.');
      return;
    }
    setSending(true);
    try {
      let ok = 0;
      const falhas: string[] = [];
      for (const i of inscritos) {
        try {
          const conversaId = await abrirOuCriarConversaAmigo({
            uidA: user.uid,
            nomeA: perfil.nome,
            uidB: i.uid,
            nomeB: i.nome,
          });
          await enviarMensagem({
            conversaId,
            deUid: user.uid,
            deNome: perfil.nome,
            texto: texto.trim(),
          });
          ok += 1;
        } catch {
          falhas.push(i.nome);
        }
      }
      Alert.alert(
        'Mensagens',
        `Enviado no app para ${ok} inscrito(s).` +
          (falhas.length ? `\nFalhou: ${falhas.join(', ')}` : '')
      );
      if (ok > 0) setTexto('');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  }

  async function enviarWhatsAppTodos() {
    if (!texto.trim()) {
      Alert.alert('WhatsApp', 'Escreva a mensagem primeiro.');
      return;
    }
    const comTel = inscritos.filter((i) => i.telefone);
    if (comTel.length === 0) {
      Alert.alert('WhatsApp', 'Nenhum inscrito com telefone cadastrado.');
      return;
    }
    // Abre o primeiro; admin pode repetir — evita spam automático
    await abrirWhatsApp(comTel[0].telefone!, texto.trim());
    Alert.alert(
      'WhatsApp',
      `Abrindo chat com ${comTel[0].nome}. Há ${comTel.length} inscrito(s) com telefone.`
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Msg inscritos</Text>
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.body}
          >
            <Text style={styles.label}>Torneio</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
              style={styles.chipsScroll}
            >
              {torneios.length === 0 ? (
                <Text style={styles.meta}>Nenhum torneio criado.</Text>
              ) : (
                torneios.map((item) => {
                  const on = item.id === torneioId;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setTorneioId(item.id)}
                    >
                      <Text style={[styles.chipTxt, on && styles.chipTxtOn]} numberOfLines={1}>
                        {item.nome}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <Text style={styles.meta}>{inscritos.length} inscrito(s)</Text>

            <TextInput
              style={styles.input}
              multiline
              placeholder="Mensagem para todos os inscritos…"
              placeholderTextColor={Colors.textSecondary}
              value={texto}
              onChangeText={setTexto}
            />

            <Button
              label="Enviar no app (chat)"
              onPress={enviarTodos}
              loading={sending}
              disabled={!texto.trim() || inscritos.length === 0}
            />
            <Button
              label="Abrir WhatsApp (1º com telefone)"
              variant="outline"
              onPress={() => void enviarWhatsAppTodos()}
              disabled={!texto.trim() || inscritos.length === 0}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  label: { color: Colors.textPrimary, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 12 },
  chipsScroll: { flexGrow: 0, maxHeight: 44 },
  chipsRow: { gap: 8, alignItems: 'center', paddingVertical: 2 },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 220,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  chipTxtOn: { color: Colors.textOnAccent },
  input: {
    minHeight: 120,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    color: Colors.textPrimary,
    textAlignVertical: 'top',
    fontSize: 15,
  },
});
