import { Linking, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import {
  PRIVACY_PAGE_URL,
  SUPPORT_PAGE_URL,
  TERMS_PAGE_URL,
} from '../../constants/legal';
import { Button } from '../ui/Button';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';

type Props = {
  onLogout: () => void;
};

export function AccountComplianceLinks({ onLogout }: Props) {
  const { confirmDeleteAccount, deleting } = useDeleteAccount();

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Conta e legal</Text>
      <Button
        label="Ajuda e suporte"
        variant="outline"
        onPress={() => void Linking.openURL(SUPPORT_PAGE_URL)}
      />
      <Button
        label="Termos de uso"
        variant="outline"
        onPress={() => void Linking.openURL(TERMS_PAGE_URL)}
      />
      <Button
        label="Política de privacidade"
        variant="outline"
        onPress={() => void Linking.openURL(PRIVACY_PAGE_URL)}
      />
      <Button label="Sair da conta" variant="outline" onPress={onLogout} />
      <Button
        label="Excluir minha conta"
        variant="outline"
        loading={deleting}
        onPress={confirmDeleteAccount}
        style={styles.dangerBtn}
      />
      <Text style={styles.hint}>
        Excluir remove permanentemente seus dados pessoais (exigência das lojas e LGPD).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12, marginTop: 8 },
  section: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    alignSelf: 'flex-start',
  },
  dangerBtn: { borderColor: Colors.danger },
  hint: {
    color: Colors.textPrimary,
    opacity: 0.7,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
});
