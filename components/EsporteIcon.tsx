import { StyleSheet, Text, View } from 'react-native';
import type { EsporteId } from '../constants/esportes';

type Props = {
  id: EsporteId;
  size?: number;
  /** Compat — ícones coloridos não dependem da cor do tema */
  color?: string;
};

/**
 * Ícones coloridos por esporte:
 * - Tênis / Beach: emoji (desenhos coloridos nativos)
 * - Padel / Raquetinha: ilustração colorida (não há emoji correto)
 */
export function EsporteIcon({ id, size = 28 }: Props) {
  if (id === 'tenis') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Text style={{ fontSize: size * 0.92, lineHeight: size }}>{'🎾'}</Text>
      </View>
    );
  }

  if (id === 'beachtennis') {
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <Text style={{ fontSize: size * 0.78, lineHeight: size * 0.9 }}>{'🎾'}</Text>
        <Text
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            fontSize: size * 0.42,
          }}
        >
          {'🏖️'}
        </Text>
      </View>
    );
  }

  if (id === 'padel') {
    const headW = size * 0.62;
    const headH = size * 0.72;
    const hole = Math.max(3, size * 0.1);
    return (
      <View style={[styles.box, { width: size, height: size }]}>
        <View
          style={{
            width: headW,
            height: headH,
            borderRadius: headW * 0.35,
            backgroundColor: '#4FC3F7',
            alignItems: 'center',
            justifyContent: 'center',
            gap: hole * 0.35,
            borderWidth: 2,
            borderColor: '#0288D1',
          }}
        >
          <View style={{ flexDirection: 'row', gap: hole * 0.4 }}>
            <View style={[styles.hole, { width: hole, height: hole, borderRadius: hole / 2 }]} />
            <View style={[styles.hole, { width: hole, height: hole, borderRadius: hole / 2 }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: hole * 0.4 }}>
            <View style={[styles.hole, { width: hole, height: hole, borderRadius: hole / 2 }]} />
            <View style={[styles.hole, { width: hole, height: hole, borderRadius: hole / 2 }]} />
          </View>
        </View>
        <View
          style={{
            width: size * 0.16,
            height: size * 0.28,
            marginTop: -2,
            borderRadius: 4,
            backgroundColor: '#FF8A65',
          }}
        />
      </View>
    );
  }

  // raquetinha
  const head = size * 0.58;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: head,
          height: head * 1.1,
          borderRadius: head * 0.45,
          borderWidth: Math.max(3, size * 0.1),
          borderColor: '#AB47BC',
          backgroundColor: '#E1BEE7',
        }}
      />
      <View
        style={{
          width: size * 0.14,
          height: size * 0.32,
          marginTop: -2,
          borderRadius: 3,
          backgroundColor: '#FFD54F',
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.05,
          top: size * 0.08,
          width: size * 0.22,
          height: size * 0.22,
          borderRadius: size * 0.11,
          backgroundColor: '#FF7043',
          borderWidth: 1,
          borderColor: '#E64A19',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  hole: { backgroundColor: 'rgba(255,255,255,0.9)' },
});
