// app/langchoose.tsx  (أو أي مسار تحطه في مشروعك)
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLang, Lang } from '../context/Languagecontext'; // ← عدّل المسار
export default function LangChoose() {
  const router = useRouter();
  const { setLang } = useLang();
  const [selected, setSelected] = useState<Lang>('ar');

  const handleContinue = () => {
    setLang(selected);                        // ← بيحفظ اللغة في الـ context
    router.push('/Doctor/RoleChoose');            // ← بيروح لصفحة اختيار الدور
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
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>راحتي  •  Rahati</Text>
      </View>

      {/* ── Heading ── */}
      <View style={styles.headingWrap}>
        <Text style={styles.title}>🌐 اختر لغتك{'\n'}Choose Your Language</Text>
        <Text style={styles.subtitle}>يمكنك تغييرها لاحقاً من الإعدادات{'\n'}You can change it later from settings</Text>
      </View>

      {/* ── Language Cards ── */}
      <View style={styles.cardsCol}>

        {/* Arabic */}
        <TouchableOpacity
          style={[styles.card, selected === 'ar' && styles.cardActive]}
          onPress={() => setSelected('ar')}
          activeOpacity={0.8}
        >
          <Text style={styles.flag}>🇸🇦</Text>
          <View style={styles.cardTextCol}>
            <Text style={[styles.cardTitle, selected === 'ar' && styles.cardTitleActive]}>
              العربية
            </Text>
            <Text style={[styles.cardSub, selected === 'ar' && styles.cardSubActive]}>
              Arabic
            </Text>
          </View>
          {selected === 'ar' && (
            <Ionicons name="checkmark-circle" size={26} color="#7C5CBF" />
          )}
        </TouchableOpacity>

        {/* English */}
        <TouchableOpacity
          style={[styles.card, selected === 'en' && styles.cardActive]}
          onPress={() => setSelected('en')}
          activeOpacity={0.8}
        >
          <Text style={styles.flag}>🇬🇧</Text>
          <View style={styles.cardTextCol}>
            <Text style={[styles.cardTitle, selected === 'en' && styles.cardTitleActive]}>
              English
            </Text>
            <Text style={[styles.cardSub, selected === 'en' && styles.cardSubActive]}>
              الإنجليزية
            </Text>
          </View>
          {selected === 'en' && (
            <Ionicons name="checkmark-circle" size={26} color="#7C5CBF" />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Continue Button ── */}
      <TouchableOpacity
        style={styles.continueBtn}
        onPress={handleContinue}
        activeOpacity={0.8}
      >
        <Text style={styles.continueBtnText}>
          {selected === 'ar' ? 'متابعة' : 'Continue'}
        </Text>
        <Ionicons
          name={selected === 'ar' ? 'arrow-back' : 'arrow-forward'}
          size={18}
          color="#fff"
        />
      </TouchableOpacity>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 84,
    height: 84,
    marginBottom: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#7C5CBF',
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2d2d2d',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardsCol: {
    width: '100%',
    gap: 14,
    marginBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  cardActive: {
    borderColor: '#7C5CBF',
    backgroundColor: '#F8F4FF',
  },
  flag: {
    fontSize: 36,
  },
  cardTextCol: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2d2d2d',
  },
  cardTitleActive: {
    color: '#7C5CBF',
  },
  cardSub: {
    fontSize: 13,
    color: '#aaa',
  },
  cardSubActive: {
    color: '#9B7ED0',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    backgroundColor: '#7C5CBF',
    borderRadius: 50,
    paddingVertical: 16,
    shadowColor: '#7C5CBF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});