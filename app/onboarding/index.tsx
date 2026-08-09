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
import { useT } from '../../hooks/useI18n';
import { LanguageGate } from '../../components/onboarding/LanguageGate';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const t = useT();
  const [langReady, setLangReady] = useState(false);
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

          {!isOverlay && item.line1Key != null && (
            <View style={styles.textBlock}>
              <Text style={styles.headline}>{t(item.line1Key)}</Text>
              <Text style={styles.headlineAccent}>
                {item.highlightKey ? t(item.highlightKey) : ''}
              </Text>
              <Text style={styles.headline}>
                {item.line2Key ? t(item.line2Key) : ''}
              </Text>
            </View>
          )}

          {isOverlay && item.centerKey != null && (
            <View style={styles.centerBlock}>
              <Text style={styles.centerText}>{t(item.centerKey)}</Text>
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
                <Text style={styles.ctaLabel}>{t('onboarding.start')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ImageBackground>
      </View>
    );
  }

  if (!langReady) {
    return <LanguageGate onContinue={() => setLangReady(true)} />;
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
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    alignItems: 'stretch',
  },
  ctaBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    height: 56,
    width: '100%',
    alignSelf: 'stretch',
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
