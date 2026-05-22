import { StyleSheet, View, type ViewStyle } from 'react-native';

export interface ButtonFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Área inferior com padding horizontal — mantém CTAs centralizados (web e native). */
export function ButtonFooter({ children, style }: ButtonFooterProps) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'stretch',
  },
});
