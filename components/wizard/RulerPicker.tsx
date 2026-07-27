import { useRef, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Colors } from '../../constants/colors';

const TICK_W = 12;
const { width: SCREEN_W } = Dimensions.get('window');

export interface RulerPickerProps {
  values: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  unitLeft?: string;
  unitRight?: string;
}

export function RulerPicker({
  values,
  value,
  onChange,
  format = (v) => String(v),
  unitLeft,
  unitRight,
}: RulerPickerProps) {
  const listRef = useRef<FlatList<number>>(null);
  const pad = (SCREEN_W - TICK_W) / 2;
  const idx = values.indexOf(value);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (idx >= 0) {
      listRef.current?.scrollToOffset({ offset: idx * TICK_W, animated: false });
    }
  }, []);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / TICK_W);
    const v = values[Math.min(Math.max(i, 0), values.length - 1)];
    if (v !== value) onChange(v);
  }

  function commitText() {
    const parsed = parseInt(text, 10);
    const min = values[0];
    const max = values[values.length - 1];
    const clamped = Number.isNaN(parsed)
      ? value
      : Math.min(Math.max(parsed, min), max);
    setText(String(clamped));
    setEditing(false);
    if (clamped !== value) onChange(clamped);
    const newIdx = values.indexOf(clamped);
    if (newIdx >= 0) {
      listRef.current?.scrollToOffset({ offset: newIdx * TICK_W, animated: true });
    }
  }

  const left = values[Math.max(0, idx - 5)];
  const right = values[Math.min(values.length - 1, idx + 5)];

  return (
    <View style={styles.wrap}>
      <View style={styles.sideLabels}>
        <Text style={styles.side}>{unitLeft ?? format(left)}</Text>
        {editing ? (
          <View style={styles.centerCircle}>
            <TextInput
              style={styles.centerInput}
              value={text}
              onChangeText={setText}
              onBlur={commitText}
              onSubmitEditing={commitText}
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
              selectionColor={Colors.accent}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.centerCircle}
            onPress={() => {
              setText(String(value));
              setEditing(true);
            }}
          >
            <Text style={styles.centerVal}>{format(value)}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.side}>{unitRight ?? format(right)}</Text>
      </View>
      <View style={styles.centerLine} />
      <FlatList
        ref={listRef}
        data={values}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={TICK_W}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: pad }}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(n) => String(n)}
        getItemLayout={(_, i) => ({ length: TICK_W, offset: TICK_W * i, index: i })}
        renderItem={({ item }) => {
          const on = item === value;
          return (
            <View style={styles.tickWrap}>
              <View style={[styles.tick, on && styles.tickOn]} />
            </View>
          );
        }}
      />
    </View>
  );
}

export interface UnitToggleProps {
  left: string;
  right: string;
  active: 'left' | 'right';
  onChange: (side: 'left' | 'right') => void;
}

export function UnitToggle({ left, right, active, onChange }: UnitToggleProps) {
  return (
    <View style={styles.toggle}>
      <TouchableOpacity
        style={[styles.toggleBtn, active === 'left' ? styles.toggleOn : styles.toggleIdle]}
        onPress={() => onChange('left')}
      >
        <Text style={[styles.toggleTxt, active === 'left' && styles.toggleTxtOn]}>{left}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, active === 'right' ? styles.toggleOn : styles.toggleIdle]}
        onPress={() => onChange('right')}
      >
        <Text style={[styles.toggleTxt, active === 'right' && styles.toggleTxtOn]}>{right}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 32 },
  sideLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  side: { color: Colors.textPrimary, fontSize: 14, opacity: 0.8 },
  centerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerVal: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
  },
  centerInput: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    width: 76,
    padding: 0,
  },
  centerLine: {
    alignSelf: 'center',
    width: 3,
    height: 48,
    backgroundColor: Colors.accent,
    marginBottom: -24,
    zIndex: 2,
  },
  tickWrap: {
    width: TICK_W,
    height: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tick: {
    width: 2,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  tickOn: {
    height: 28,
    backgroundColor: Colors.accent,
    width: 3,
  },
  toggle: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 30,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 26,
  },
  toggleOn: { backgroundColor: Colors.accent },
  toggleIdle: { backgroundColor: 'transparent' },
  toggleTxt: { color: Colors.textPrimary, fontWeight: 'bold' },
  toggleTxtOn: { color: Colors.textOnAccent },
});
