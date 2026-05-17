import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLang, Lang } from '../context/Languagecontext';

export default function LangChoose() {
  const { setLang } = useLang();
  const router = useRouter();

  const handleSelect = async (lang: Lang) => {
    await AsyncStorage.setItem('app_language', lang);
    setLang(lang);
    router.replace('/auth/sign-in');
  };

  return (
    <LinearGradient
      colors={['#ffffff', '#EDE6F8', '#7C5CBF']}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Logo ── */}
      <View style={styles.logoSection}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appNameAr}>راحتي</Text>
        <Text style={styles.appNameEn}>My Energy Buddy</Text>
      </View>

      {/* ── Buttons ── */}
      <View style={styles.buttonsSection}>
        {/* Arabic */}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => handleSelect('ar')}
          activeOpacity={0.75}
        >
          <Text style={styles.flag}>🇪🇬</Text>
          <Text style={styles.btnLabel}>العربية</Text>
        </TouchableOpacity>

        {/* English */}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => handleSelect('en')}
          activeOpacity={0.75}
        >
          <Text style={styles.flag}>🇺🇸</Text>
          <Text style={styles.btnLabel}>English</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 18,
  },
  appNameAr: {
    fontSize: 38,
    fontWeight: '700',
    color: '#7C5CBF',
    marginBottom: 6,
  },
  appNameEn: {
    fontSize: 15,
    color: '#999',
    letterSpacing: 0.4,
  },
  buttonsSection: {
    width: '100%',
    gap: 14,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  flag: {
    fontSize: 26,
    marginRight: 14,
  },
  btnLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: '#2d2d2d',
    marginRight: 40,
  },
});