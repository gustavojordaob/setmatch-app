import { useRef, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { KEYBOARD_DONE_NATIVE_ID } from '../ui/KeyboardDoneBar';

const ITEM_WIDTH = 56;
const { width: SCREEN_W } = Dimensions.get('window');

export interface ScrollPickerProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
}

export function ScrollPicker({ min, max, value, onChange }: ScrollPickerProps) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const listRef = useRef<FlatList<number>>(null);
  const pad = (SCREEN_W - ITEM_WIDTH) / 2;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  useEffect(() => {
    const idx = value - min;
    listRef.current?.scrollToOffset({ offset: idx * ITEM_WIDTH, animated: false });
  }, []);

  function scrollToValue(v: number) {
    const idx = v - min;
    listRef.current?.scrollToOffset({ offset: idx * ITEM_WIDTH, animated: true });
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH);
    const v = values[Math.min(Math.max(idx, 0), values.length - 1)];
    if (v !== value) onChange(v);
  }

  function commitText() {
    const parsed = parseInt(text, 10);
    const clamped = Number.isNaN(parsed)
      ? value
      : Math.min(Math.max(parsed, min), max);
    setText(String(clamped));
    setEditing(false);
    if (clamped !== value) onChange(clamped);
    scrollToValue(clamped);
  }

  return (
    <View style={styles.wrap}>
      {editing ? (
        <TextInput
          style={styles.hero}
          value={text}
          onChangeText={setText}
          onBlur={commitText}
          onSubmitEditing={commitText}
          keyboardType="number-pad"
          inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
          maxLength={3}
          autoFocus
          selectionColor={Colors.accent}
        />
      ) : (
        <TouchableOpacity
          onPress={() => {
            setText(String(value));
            setEditing(true);
          }}
        >
          <Text style={styles.hero}>{value}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.tapHint}>toque no número para digitar</Text>
      <FlatList
        ref={listRef}
        data={values}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: pad }}
        onMomentumScrollEnd={onScroll}
        keyExtractor={(n) => String(n)}
        getItemLayout={(_, i) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * i, index: i })}
        renderItem={({ item }) => {
          const selected = item === value;
          return (
            <TouchableOpacity
              style={[styles.item, selected && styles.itemSelected]}
              activeOpacity={0.85}
              onPress={() => {
                Keyboard.dismiss();
                setEditing(false);
                setText(String(item));
                if (item !== value) onChange(item);
                scrollToValue(item);
              }}
            >
              <Text style={[styles.num, selected && styles.numSelected]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 24 },
  hero: {
    color: Colors.accent,
    fontSize: 72,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 160,
  },
  tapHint: {
    color: Colors.textPrimary,
    opacity: 0.6,
    fontSize: 12,
    marginBottom: 16,
  },
  item: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    borderRadius: ITEM_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemSelected: {
    borderColor: Colors.accent,
  },
  num: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
    opacity: 0.7,
  },
  numSelected: {
    fontSize: 24,
    fontWeight: 'bold',
    opacity: 1,
  },
});
