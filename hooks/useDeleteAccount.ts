import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { deleteMyAccount } from '../services/account';
import { useAuth } from './useAuth';
import { useT } from './useI18n';

export function useDeleteAccount() {
  const router = useRouter();
  const { signOut } = useAuth();
  const t = useT();
  const [deleting, setDeleting] = useState(false);

  function confirmDeleteAccount() {
    Alert.alert(t('legal.deleteConfirmTitle'), t('legal.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('legal.deletePermanently'),
        style: 'destructive',
        onPress: () => void runDelete(),
      },
    ]);
  }

  async function runDelete() {
    setDeleting(true);
    try {
      const result = await deleteMyAccount();
      if (!result.ok) {
        Alert.alert(t('common.error'), result.error || t('legal.deleteFailed'));
        return;
      }

      try {
        await signOut();
      } catch {
        // Usuário já removido no Auth — ignorar.
      }
      router.replace('/onboarding');
      Alert.alert(t('legal.deletedTitle'), t('legal.deletedBody'));
    } catch (e: unknown) {
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : t('legal.deleteFailed')
      );
    } finally {
      setDeleting(false);
    }
  }

  return { confirmDeleteAccount, deleting };
}
