import { useRef, useEffect } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Colors } from '../../constants/colors';

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

  useEffect(() => {
    const idx = value - min;
    listRef.current?.scrollToOffset({ offset: idx * ITEM_WIDTH, animated: false });
  }, []);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_WIDTH);
    const v = values[Math.min(Math.max(idx, 0), values.length - 1)];
    if (v !== value) onChange(v);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.hero}>{value}</Text>
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
            <View style={[styles.item, selected && styles.itemSelected]}>
              <Text style={[styles.num, selected && styles.numSelected]}>{item}</Text>
            </View>
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
