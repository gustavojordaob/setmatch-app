import { useEffect, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Button } from '../components/ui/Button';
import {
  getDeferredInstallPrompt,
  isStandalonePwa,
  promptInstallPwa,
} from '../utils/pwaInstall';

/**
 * Landing do link compartilhável — instala o Setmatch como PWA (sem loja).
 * Ex.: https://setmatch-app-fabrica.web.app/baixar
 */
export default function BaixarPwaScreen() {
  const router = useRouter();
  const [canInstall, setCanInstall] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setStandalone(isStandalonePwa());
    setCanInstall(Boolean(getDeferredInstallPrompt()));
    const onBip = () => setCanInstall(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('pwa-bip', onBip);
      return () => window.removeEventListener('pwa-bip', onBip);
    }
  }, []);

  async function instalar() {
    setBusy(true);
    setMsg('');
    try {
      const r = await promptInstallPwa();
      if (r === 'accepted') {
        setMsg('Pronto! Abra o Setmatch pela tela inicial.');
        setCanInstall(false);
      } else if (r === 'dismissed') {
        setMsg('Instalação cancelada. Você pode tentar de novo.');
      } else {
        setMsg(
          Platform.OS === 'web'
            ? 'No iPhone: Safari → Compartilhar → “Adicionar à Tela de Início”. No Android/Chrome: menu ⋮ → “Instalar app” ou “Adicionar à tela inicial”.'
            : 'Abra este link no Chrome ou Safari do celular para instalar.'
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brand}>SETMATCH</Text>
        <Text style={styles.title}>Instale o app pelo link</Text>
        <Text style={styles.sub}>
          Sem App Store e sem Play Store. O Setmatch abre como app na sua tela
          inicial — desafios, rankings, aulas e torneios.
        </Text>

        {standalone ? (
          <View style={styles.okBox}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.accent} />
            <Text style={styles.okTxt}>Já está instalado neste aparelho.</Text>
            <Button
              label="Abrir Setmatch"
              onPress={() => router.replace('/')}
              style={{ marginTop: 12, alignSelf: 'stretch' }}
            />
          </View>
        ) : (
          <>
            <Button
              label={canInstall ? 'Instalar Setmatch' : 'Como instalar'}
              loading={busy}
              onPress={() => void instalar()}
            />
            {msg ? <Text style={styles.hint}>{msg}</Text> : null}

            <View style={styles.steps}>
              <Text style={styles.stepTitle}>Android (Chrome)</Text>
              <Text style={styles.stepTxt}>
                1. Abra este link no Chrome{'\n'}
                2. Toque em Instalar / Adicionar à tela inicial{'\n'}
                3. Confirme — o ícone aparece na home
              </Text>
              <Text style={[styles.stepTitle, { marginTop: 16 }]}>iPhone (Safari)</Text>
              <Text style={styles.stepTxt}>
                1. Abra este link no Safari{'\n'}
                2. Compartilhar → Adicionar à Tela de Início{'\n'}
                3. Toque em Adicionar
              </Text>
            </View>
          </>
        )}

        <TouchableOpacity onPress={() => router.replace('/')} style={styles.link}>
          <Text style={styles.linkTxt}>Continuar no navegador</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
    alignItems: 'center',
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: 16,
  },
  brand: {
    color: Colors.accent,
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 2,
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 22,
    marginTop: 20,
    textAlign: 'center',
  },
  sub: {
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 28,
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 14,
  },
  steps: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    marginTop: 28,
  },
  stepTitle: { color: Colors.accent, fontWeight: '800', fontSize: 14 },
  stepTxt: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  okBox: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  okTxt: { color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  link: { marginTop: 28, padding: 12 },
  linkTxt: { color: Colors.accent, fontWeight: '700' },
});
