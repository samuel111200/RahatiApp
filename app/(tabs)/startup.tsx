// app/(tabs)/startup.tsx
import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import RahatiLogo from '../../components/RahatiLogo';
import { PrimaryButton } from '../../components/UI';
import { Colors, Spacing, Radius, FontSize } from '../../constants/Theme';

export default function StartupScreen() {
  const { user } = useAuth();

  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeIn,   { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(slideUp,  { toValue: 0, useNativeDriver: true }),
        Animated.spring(logoScale,{ toValue: 1, friction: 5, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -14, duration: 1900, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0,   duration: 1900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Background orbs */}
      <View style={styles.orbTL} />
      <View style={styles.orbBR} />

      <View style={styles.container}>

        {/* Greeting */}
        <Animated.View style={[styles.greetBlock, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
          {user ? (
            <Text style={styles.greetName}>مرحباً، {user.firstName} 👋</Text>
          ) : null}
          <Text style={styles.welcomeTitle}>مرحباً بك في راحتي</Text>
          <Text style={styles.welcomeSub}>رفيقك اليومي للصحة والعافية</Text>
        </Animated.View>

        {/* Animated Logo */}
        <Animated.View style={[styles.logoWrap, { opacity: fadeIn, transform: [{ scale: logoScale }, { translateY: float }] }]}>
          {/* Shadow blur under logo */}
          <View style={styles.logoShadow} />
          <RahatiLogo size={180} showBackground />
        </Animated.View>

        {/* Feature pills */}
        <Animated.View style={[styles.pillsRow, { opacity: fadeIn }]}>
          {[
            { icon: '🧘', label: 'تأمل' },
            { icon: '🥗', label: 'تغذية' },
            { icon: '💪', label: 'تمارين' },
          ].map((item, i) => (
            <View key={i} style={styles.pill}>
              <Text style={styles.pillIcon}>{item.icon}</Text>
              <Text style={styles.pillLabel}>{item.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Dots */}
        <View style={styles.dotsRow}>
          {[0,1,2].map(i => (
            <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />
          ))}
        </View>

        {/* CTA */}
        <Animated.View style={[styles.btnWrap, { opacity: fadeIn }]}>
          <PrimaryButton title="ابدأ يومك" onPress={() => router.replace('/(tabs)/home')} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  orbTL: { position: 'absolute', top: -50, left: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.primaryMid, opacity: 0.3 },
  orbBR: { position: 'absolute', bottom: -60, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: Colors.accentSoft, opacity: 0.4 },

  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, paddingBottom: Spacing.xxxl + 20 },

  greetBlock: { alignItems: 'center' },
  greetName: { fontSize: FontSize.base, fontWeight: '500', color: Colors.primary, marginBottom: 4 },
  welcomeTitle: { fontSize: 30, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', lineHeight: 40 },
  welcomeSub: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', marginTop: 6 },

  logoWrap: { alignItems: 'center', justifyContent: 'center' },
  logoShadow: { position: 'absolute', bottom: -8, width: 130, height: 18, borderRadius: 65, backgroundColor: 'rgba(124,92,191,0.18)' },

  pillsRow: { flexDirection: 'row', gap: 14 },
  pill: {
    alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.xl,
    paddingVertical: 12, paddingHorizontal: 18,
    shadowColor: Colors.shadowDark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2,
  },
  pillIcon: { fontSize: 24, marginBottom: 4 },
  pillLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },

  dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 20, backgroundColor: Colors.primary, borderRadius: 4 },

  btnWrap: { width: '100%' },
});
