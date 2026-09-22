import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';
import { useWizard } from '../../contexts/WizardContext';
import { uploadFotoPerfil } from '../../utils/uploadFoto';

export default function WizardFotoScreen() {
  const router = useRouter();
  const t = useT();
  const { user, saveWizardProfile } = useAuth();
  const { draft, resetDraft } = useWizard();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function escolherFoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.permission'), t('wizard.photoPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setPreviewUri(uri);
    setFotoUrl(null);
    // Upload imediato — a pessoa já vê o resultado aqui.
    setUploading(true);
    try {
      const url = await uploadFotoPerfil(uri);
      setFotoUrl(url);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String((e as { message: unknown }).message)
            : 'Não foi possível enviar a foto.';
      setPreviewUri(null);
      Alert.alert('Upload', msg);
    } finally {
      setUploading(false);
    }
  }

  async function avancar() {
    if (!user) return;
    setSalvando(true);
    try {
      await saveWizardProfile({
        ...draft,
        fotoUrl: fotoUrl ?? user.photoURL ?? '',
      });
      resetDraft();
      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.concludeFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSalvando(false);
    }
  }

  const continueLabel = uploading ? 'Enviando...' : 'Avançar';

  return (
    <WizardLayout
      title={t('wizard.photoTitle')}
      continueLabel={continueLabel}
      onContinue={avancar}
      continueDisabled={uploading}
      loading={salvando}
    >
      <TouchableOpacity
        style={styles.cameraWrap}
        onPress={escolherFoto}
        disabled={uploading}
      >
        <View style={styles.cameraCircle}>
          {previewUri ? (
            <>
              <Image source={{ uri: previewUri }} style={styles.preview} />
              {uploading ? (
                <View style={styles.overlay}>
                  <ActivityIndicator color={Colors.accent} size="large" />
                </View>
              ) : fotoUrl ? (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={22} color={Colors.textOnAccent} />
                </View>
              ) : null}
            </>
          ) : (
            <Ionicons name="camera" size={48} color={Colors.accent} />
          )}
        </View>
      </TouchableOpacity>

      <Text style={styles.link} onPress={escolherFoto}>
        {previewUri ? 'Trocar imagem' : 'Selecionar imagem no dispositivo'}
      </Text>

      {fotoUrl ? (
        <Text style={styles.done}>Foto enviada com sucesso ✓</Text>
      ) : null}
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  cameraWrap: { alignItems: 'center', marginTop: 48 },
  cameraCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: { width: '100%', height: '100%' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 24,
    textDecorationLine: 'underline',
    fontSize: 15,
  },
  done: {
    color: Colors.accent,
    textAlign: 'center',
    marginTop: 12,
    fontWeight: 'bold',
  },
});
