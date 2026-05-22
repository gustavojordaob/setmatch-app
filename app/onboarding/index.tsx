import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { LOGO_ICON, ONBOARDING_SLIDES, type OnboardingSlideConfig } from '../../constants/onboarding';
import { Radius } from '../../constants/radius';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList<OnboardingSlideConfig>>(null);

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  }

  function renderSlide({ item }: { item: OnboardingSlideConfig }) {
    const isOverlay = Boolean(item.overlay);

    return (
      <View style={styles.slide}>
        <ImageBackground source={item.image} style={styles.bg} resizeMode="cover">
          {isOverlay ? (
            <View style={styles.overlayFull} />
          ) : (
            <View style={styles.overlayBottom} />
          )}

          {!isOverlay && item.linha1 != null && (
            <View style={styles.textBlock}>
              <Text style={styles.headline}>{item.linha1}</Text>
              <Text style={styles.headlineAccent}>{item.destaque}</Text>
              <Text style={styles.headline}>{item.linha2}</Text>
            </View>
          )}

          {isOverlay && item.textoCenter != null && (
            <View style={styles.centerBlock}>
              <Text style={styles.centerText}>{item.textoCenter}</Text>
            </View>
          )}

          <View
            style={[
              styles.dots,
              { bottom: item.showButton ? 140 : 80 },
            ]}
          >
            {ONBOARDING_SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          {item.showLogo && (
            <View style={styles.logoRow}>
              <Image source={LOGO_ICON} style={styles.logoIcon} />
              <Text style={styles.logoText}>SETMATCH</Text>
            </View>
          )}

          {item.showButton && (
            <View style={styles.ctaWrap}>
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaLabel}>
                  {item.buttonLabel ?? 'VAMOS COMEÇAR'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ImageBackground>
      </View>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={ONBOARDING_SLIDES}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(_, i) => String(i)}
      renderItem={renderSlide}
      onMomentumScrollEnd={onMomentumScrollEnd}
      getItemLayout={(_, index) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
      })}
    />
  );
}

const styles = StyleSheet.create({
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  bg: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 320,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  textBlock: {
    position: 'absolute',
    bottom: 120,
    left: 32,
    right: 32,
  },
  headline: {
    color: Colors.textPrimary,
    fontSize: 40,
    fontWeight: 'bold',
    lineHeight: 46,
  },
  headlineAccent: {
    color: Colors.accent,
    fontSize: 40,
    fontWeight: 'bold',
    lineHeight: 46,
  },
  centerBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  centerText: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  dots: {
    position: 'absolute',
    left: 32,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 20,
    backgroundColor: Colors.accent,
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  logoRow: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
  },
  logoText: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  ctaWrap: {
    position: 'absolute',
    bottom: 60,
    left: 32,
    right: 32,
  },
  ctaBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaLabel: {
    color: Colors.textOnAccent,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
