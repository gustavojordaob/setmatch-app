import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';
import {
  criarSolicitacaoAcesso,
  type TipoSolicitacaoAcesso,
} from '../../services/solicitacoesAcesso';
import { telefoneSalvoValido } from '../../utils/telefoneInternacional';
import { abrirWhatsApp } from '../../utils/whatsapp';
import { formatarTelefoneInternacional } from '../../utils/telefoneInternacional';

const SETMATCH_WA = '5519989632897';

export default function SolicitarAcessoScreen() {
  const router = useRouter();
  const t = useT();
  const { user, perfil } = useAuth();
  const params = useLocalSearchParams<{ tipo?: string }>();
  const initialTipo: TipoSolicitacaoAcesso =
    params.tipo === 'admin_clube' ? 'admin_clube' : 'professor';

  const [tipo, setTipo] = useState<TipoSolicitacaoAcesso>(initialTipo);
  const [nome, setNome] = useState(perfil?.nome ?? '');
  const [email, setEmail] = useState(perfil?.email ?? user?.email ?? '');
  const [telefone, setTelefone] = useState(perfil?.telefone ?? '');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [esporte, setEsporte] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [loading, setLoading] = useState(false);

  async function enviar() {
    if (!nome.trim() || !email.trim()) {
      Alert.alert(t('auth.requestTitle'), t('auth.requestFillRequired'));
      return;
    }
    if (!telefoneSalvoValido(telefone)) {
      Alert.alert(t('auth.requestTitle'), t('auth.requestPhoneInvalid'));
      return;
    }
    setLoading(true);
    try {
      await criarSolicitacaoAcesso({
        tipo,
        nome,
        email,
        telefone,
        cidade,
        esporte,
        mensagem,
        uid: user?.uid ?? null,
      });

      const tipoLabel = tipo === 'professor' ? 'professor' : 'admin de clube';
      const waMsg =
        `Olá Rally Up! Solicitei acesso de *${tipoLabel}* pelo app.\n\n` +
        `Nome: ${nome.trim()}\n` +
        `E-mail: ${email.trim()}\n` +
        `WhatsApp: ${formatarTelefoneInternacional(telefone)}\n` +
        `Cidade: ${cidade.trim() || '—'}\n` +
        `Esporte: ${esporte.trim() || '—'}\n` +
        (mensagem.trim() ? `Msg: ${mensagem.trim()}\n` : '');

      Alert.alert(t('auth.requestSentTitle'), t('auth.requestSentBody'), [
        {
          text: t('auth.requestWhatsApp'),
          onPress: () => void abrirWhatsApp(SETMATCH_WA, waMsg),
        },
        {
          text: 'OK',
          onPress: () => router.replace('/(auth)/admin-login'),
        },
      ]);
    } catch (e: unknown) {
      Alert.alert(
        t('auth.requestTitle'),
        e instanceof Error ? e.message : t('auth.requestFailed')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="never"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>{t('auth.requestTitle')}</Text>
          <Text style={styles.sub}>{t('auth.requestSubtitle')}</Text>

          <View style={styles.tipoRow}>
            <TouchableOpacity
              style={[styles.tipoBtn, tipo === 'professor' && styles.tipoOn]}
              onPress={() => setTipo('professor')}
            >
              <Text style={[styles.tipoTxt, tipo === 'professor' && styles.tipoTxtOn]}>
                {t('auth.requestAsProfessor')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tipoBtn, tipo === 'admin_clube' && styles.tipoOn]}
              onPress={() => setTipo('admin_clube')}
            >
              <Text style={[styles.tipoTxt, tipo === 'admin_clube' && styles.tipoTxtOn]}>
                {t('auth.requestAsAdmin')}
              </Text>
            </TouchableOpacity>
          </View>

          <Input label={t('auth.requestName')} value={nome} onChangeText={setNome} />
          <Input
            label={t('auth.email')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <PhoneInput
            label={t('auth.requestPhone')}
            value={telefone}
            onChangeValue={setTelefone}
          />
          <Text style={styles.hint}>{t('auth.requestPhoneHint')}</Text>
          <Input
            label={t('auth.requestCity')}
            value={cidade}
            onChangeText={setCidade}
            placeholder={t('auth.requestCityPlaceholder')}
          />
          <Input
            label={t('auth.requestSport')}
            value={esporte}
            onChangeText={setEsporte}
            placeholder={t('auth.requestSportPlaceholder')}
          />
          <Input
            label={t('auth.requestMessage')}
            value={mensagem}
            onChangeText={setMensagem}
            placeholder={t('auth.requestMessagePlaceholder')}
          />

          <Button label={t('auth.requestSubmit')} onPress={() => void enviar()} loading={loading} />
          <Text style={styles.back} onPress={() => router.back()}>
            {t('nav.back')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 24, gap: 14, paddingBottom: 40 },
  title: { color: Colors.accent, fontSize: 26, fontWeight: 'bold' },
  sub: { color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  tipoRow: { flexDirection: 'row', gap: 8 },
  tipoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  tipoOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tipoTxt: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  tipoTxtOn: { color: Colors.textOnAccent },
  hint: { color: Colors.textSecondary, fontSize: 12, marginTop: -6 },
  back: { color: Colors.accent, textAlign: 'center', marginTop: 8, fontWeight: '600' },
});
