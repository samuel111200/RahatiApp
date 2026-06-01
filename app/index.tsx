import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../utils/firebaseConfig";
import { useLang } from "../context/Languagecontext";

SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get("window");
const FIRST_LAUNCH_KEY = "hasLaunchedBefore";

export default function Index() {
  const [done, setDone] = useState(false);
  const { setLang } = useLang();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.75)).current;
  const screenFade  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function init() {
      await SplashScreen.hideAsync(); // ← شيل AsyncStorage.clear() تماماً

      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(logoScale,   { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.timing(screenFade, { toValue: 0, duration: 400, useNativeDriver: true })
          .start(async () => {
            setDone(true);

            const hasLaunched = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);

            if (!hasLaunched) {
              await AsyncStorage.setItem(FIRST_LAUNCH_KEY, "true");
              router.replace("/startup");
              return;
            }

            const savedLang = await AsyncStorage.getItem("app_language") as "ar" | "en" | null;
            if (savedLang) setLang(savedLang);

            const savedRole = await AsyncStorage.getItem("app_role");

            // Check Firebase auth state once — signed-in users go straight to home
            const unsub = onAuthStateChanged(auth, (user) => {
              unsub();
              if (user) {
                if (savedRole === "doctor") {
                  router.replace("/Doctor/Dochome");
                } else {
                  router.replace("/tabs/home");
                }
              } else {
                if (savedRole === "doctor") {
                  router.replace("/Doctor/Docsignin");
                } else if (savedRole === "patient") {
                  router.replace("/auth/sign-in");
                } else {
                  router.replace("/langchoose");
                }
              }
            });
          });
      }, 3000);
    }

    init();
  }, []);

  if (done) return null;

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