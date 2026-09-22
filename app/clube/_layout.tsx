import { Slot } from 'expo-router';
import { Platform } from 'react-native';
import { AdminDesktopShell } from '../../components/admin-web/AdminDesktopShell';
import { useAuth } from '../../hooks/useAuth';

/**
 * Na web, admins usam shell desktop (sidebar + topbar).
 * No app nativo, telas /clube/* continuam full-screen mobile.
 */
export default function ClubeLayout() {
  const { isAdminClube } = useAuth();

  if (Platform.OS === 'web' && isAdminClube) {
    return (
      <AdminDesktopShell>
        <Slot />
      </AdminDesktopShell>
    );
  }

  return <Slot />;
}
