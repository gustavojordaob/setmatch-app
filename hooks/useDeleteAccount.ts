import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { deleteMyAccount } from '../services/account';
import { useAuth } from './useAuth';

export function useDeleteAccount() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  function confirmDeleteAccount() {
    Alert.alert(
      'Excluir minha conta',
      'Isso apagará permanentemente seu perfil, partidas, mensagens, matrículas e dados associados. Se você for dono de clube, o clube e conteúdos ligados também serão removidos. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir permanentemente',
          style: 'destructive',
          onPress: () => void runDelete(),
        },
      ]
    );
  }

  async function runDelete() {
    setDeleting(true);
    try {
      const result = await deleteMyAccount();
      if (!result.ok) {
        Alert.alert('Erro', result.error || 'Não foi possível excluir a conta.');
        return;
      }

      try {
        await signOut();
      } catch {
        // Usuário já removido no Auth — ignorar.
      }
      router.replace('/onboarding');
      Alert.alert('Conta excluída', 'Seus dados foram removidos com sucesso.');
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível excluir a conta.');
    } finally {
      setDeleting(false);
    }
  }

  return { confirmDeleteAccount, deleting };
}
