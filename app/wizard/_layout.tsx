import { Stack } from 'expo-router';
import { Colors } from '../../constants/colors';

export default function WizardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
