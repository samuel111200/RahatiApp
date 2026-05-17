// app/(tabs)/startup.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

function Butterfly({ style, opacity = 1 }: { style?: any; opacity?: number }) {
  return (
    <View style={[{ opacity }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 14, height: 10, borderRadius: 7, backgroundColor: "#E8A4D0", transform: [{ rotate: "-25deg" }] }} />
        <View style={{ width: 2, height: 14, backgroundColor: "#9B7FC7", borderRadius: 1 }} />
        <View style={{ width: 14, height: 10, borderRadius: 7, backgroundColor: "#E8A4D0", transform: [{ rotate: "25deg" }] }} />
      </View>
    </View>
  );
}

export default function StartupScreen() {
  const insets = useSafeAreaInsets();

  const fadeIn     = useRef(new Animated.Value(0)).current;
  const butterflyX = useRef(new Animated.Value(0)).current;
  const butterflyY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // كل حاجة بتظهر مع بعض في animation واحدة
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(butterflyX, { toValue: 18,  duration: 1800, useNativeDriver: true }),
        Animated.timing(butterflyY, { toValue: -10, duration: 900,  useNativeDriver: true }),
        Animated.timing(butterflyX, { toValue: -8,  duration: 1600, useNativeDriver: true }),
        Animated.timing(butterflyY, { toValue: 6,   duration: 900,  useNativeDriver: true }),
        Animated.timing(butterflyX, { toValue: 0,   duration: 1400, useNativeDriver: true }),
        Animated.timing(butterflyY, { toValue: 0,   duration: 900,  useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <ImageBackground
      source={require("../assets/images/background.png")}
      style={styles.root}
      resizeMode="cover"
    >
      {/* ── Butterfly ── */}
      <Animated.View style={[styles.butterfly, { transform: [{ translateX: butterflyX }, { translateY: butterflyY }] }]}>
        <Butterfly />
      </Animated.View>

      {/* ── Small butterfly ── */}
      <View style={styles.butterflySmall}>
        <Butterfly opacity={0.5} style={{ transform: [{ scale: 0.65 }] }} />
      </View>

      {/* ── Sparkle ── */}
      <Text style={styles.sparkle}>✦</Text>

      {/* ── Content ── */}
      <Animated.View style={[styles.content, { opacity: fadeIn, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>

        {/* Top text */}
        <View style={{ alignItems: "center" }}>
          <Text style={styles.greetSmall}>مرحباً بك في</Text>
          <Text style={styles.appName}>راحتي</Text>
          <Text style={styles.tagline}>رفيقك في إدارة طاقتك</Text>
          <Text style={styles.tagline2}>كل يوم خطوة نحو حياة</Text>
          <Text style={styles.tagline3}>افضل 💜</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA Button */}
        <View style={{ width: "100%", paddingHorizontal: 28 }}>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.replace("/langchoose")}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["#7C5CBF", "#7C5CBF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>ابدأ يومك</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            أجل رحلة بناء عاداتك اليومية وتحقيق طاقة حياتك
          </Text>
        </View>

      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  butterfly: {
    position: "absolute",
    top: height * 0.38,
    right: width * 0.14,
  },
  butterflySmall: {
    position: "absolute",
    top: height * 0.33,
    right: width * 0.3,
    opacity: 0.6,
  },
  sparkle: {
    position: "absolute",
    bottom: 36,
    right: 30,
    fontSize: 22,
    color: "rgba(255,255,255,0.7)",
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },

  greetSmall: {
    fontSize: 28,
    color: "#000",
    marginTop: 48,
    fontWeight: "600",
    textAlign: "center",
  },
  appName: {
    fontSize: 60,
    fontWeight: "bold",
    color: "#52408d",
    textAlign: "center",
  },
  tagline: {
    fontSize: 24,
    color: "#000",
    marginTop: 32,
    textAlign: "center",
    fontWeight: "bold",
  },
  tagline2: {
    fontSize: 16,
    marginTop: 30,
    color: "#000",
    textAlign: "center",
    fontWeight: "bold",
  },
  tagline3: {
    fontSize: 16,
    marginTop: 16,
    color: "#000",
    textAlign: "center",
    fontWeight: "bold",
  },

  ctaBtn: {
    borderRadius: 50,
    overflow: "hidden",
    shadowColor: "#7C5CBF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 14,
  },
  ctaGradient: {
    paddingVertical: 17,
    alignItems: "center",
    borderRadius: 50,
  },
  ctaText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footerNote: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center",
    fontWeight: "bold",
  },
});