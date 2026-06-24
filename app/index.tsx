import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLang } from "../context/Languagecontext";
import { useAuth } from "../context/AuthContext";

SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get("window");

export default function Index() {
  const [animDone, setAnimDone] = useState(false);
  const { setLang } = useLang();
  const { user, isAuthenticated, isLoading } = useAuth();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.75)).current;
  const screenFade  = useRef(new Animated.Value(1)).current;

  // Step 1 — run the splash animation once on mount
  useEffect(() => {
    async function init() {
      await SplashScreen.hideAsync();

      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(logoScale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.timing(screenFade, { toValue: 0, duration: 400, useNativeDriver: true })
            .start(() => setAnimDone(true));
      }, 3000);
    }
    init();
  }, []);

  // Step 2 — once animation is done AND AuthContext has finished loading, route
  useEffect(() => {
    if (!animDone || isLoading) return; // wait for both

    async function route() {
      const savedRole = await AsyncStorage.getItem("app_role");

      // No role = onboarding never completed → show startup
      if (!savedRole) {
        router.replace("/startup");
        return;
      }

      const savedLang = await AsyncStorage.getItem("app_language") as "ar" | "en" | null;
      if (savedLang) setLang(savedLang);

      if (isAuthenticated && user) {
        // AuthContext already has the real role from Firestore — use it, not the cache
        if (user.role === "doctor") {
          router.replace("/Doctor/Dochome");
        } else {
          // Mirror the same energy-date check AuthGuard does so a patient who
          // closes and reopens the app on a new day still hits the energy screen.
          const uid = user.uid;
          const savedDate  = await AsyncStorage.getItem(`energy_date_${uid}`);
          const d = new Date();
          const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (savedDate !== today) {
            router.replace("/energy");
          } else {
            router.replace("/tabs/home");
          }
        }
      } else {
        // Not logged in — always go to RoleChoose so the user picks
        // their role explicitly. This prevents a logged-out doctor's
        // saved app_role from auto-routing a new patient to the wrong portal.
        router.replace("/Doctor/RoleChoose");
      }
    }

    route();
  }, [animDone, isLoading, isAuthenticated]);

  if (animDone) return null;

  return (
      <Animated.View style={[styles.wrapper, { opacity: screenFade }]}>
        <LinearGradient
            colors={["#7C5CBF", "#ffffff"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
          <Animated.Image
              source={require("../assets/images/logo.png")}
              style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
              resizeMode="contain"
          />
        </LinearGradient>
      </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  gradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: width * 0.55,
    height: width * 0.55,
  },
});