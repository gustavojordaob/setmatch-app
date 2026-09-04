import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { PRIVACY_PAGE_URL, TERMS_PAGE_URL } from '../../constants/legal';
import { Button } from '../ui/Button';
import { useDeleteAccount } from '../../hooks/useDeleteAccount';
import { useT } from '../../hooks/useI18n';
import { LanguagePicker } from './LanguagePicker';

type Props = {
  onLogout: () => void;
};

export function AccountComplianceLinks({ onLogout }: Props) {
  const router = useRouter();
  const { confirmDeleteAccount, deleting } = useDeleteAccount();
  const t = useT();

  return (
    <View style={styles.wrap}>
      <LanguagePicker />
      <Text style={styles.section}>{t('legal.accountSection')}</Text>
      <Button
        label={t('legal.helpSupport')}
        variant="outline"
        onPress={() => router.push('/ajuda')}
      />
      <Button
        label={t('legal.termsOfUse')}
        variant="outline"
        onPress={() => void Linking.openURL(TERMS_PAGE_URL)}
      />
      <Button
        label={t('legal.privacyPolicy')}
        variant="outline"
        onPress={() => void Linking.openURL(PRIVACY_PAGE_URL)}
      />
      <Button label={t('legal.logout')} variant="outline" onPress={onLogout} />
      <Button
        label={t('legal.deleteAccount')}
        variant="outline"
        loading={deleting}
        onPress={confirmDeleteAccount}
        style={styles.dangerBtn}
      />
      <Text style={styles.hint}>{t('legal.deleteHint')}</Text>
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
