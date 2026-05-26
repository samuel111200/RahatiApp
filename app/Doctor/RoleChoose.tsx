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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLang } from '../../context/Languagecontext'; // ← عدّل المسار لو مختلف

type Role = 'doctor' | 'patient';

export default function RoleChoose() {
  const router = useRouter();
  const { t, isRTL } = useLang();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleContinue = async () => {
    if (!selectedRole) return;
    await AsyncStorage.setItem("app_role", selectedRole);
    console.log("Role saved:", selectedRole);
    console.log(
      "Going to:",
      selectedRole === "doctor" ? "/Doctor/Docsignin" : "/auth/sign-in",
    );
    if (selectedRole === "doctor") {
      router.replace("/Doctor/Docsignin");
    } else {
      router.replace("/auth/sign-in");
    }
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
        <Text style={styles.appNameAr}>{t.appName}</Text>
        <Text style={styles.appNameEn}>{t.appTagline}</Text>
      </View>

      {/* ── Heading ── */}
      <View style={styles.headingWrap}>
        <Text style={styles.title}>{t.docRoleTitle}</Text>
        <Text style={styles.subtitle}>{t.docRoleSubtitle}</Text>
      </View>

      {/* ── Role Cards ── */}
      <View style={styles.rolesCol}>

        {/* Doctor */}
        <TouchableOpacity
          style={[styles.roleCard, selectedRole === 'doctor' && styles.roleCardActive]}
          onPress={() => setSelectedRole('doctor')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconWrap, selectedRole === 'doctor' && styles.roleIconWrapActive]}>
            <Text style={styles.roleIcon}>🩺</Text>
          </View>
          <View style={[styles.roleTextCol, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={[styles.roleTitle, { textAlign: isRTL ? 'right' : 'left' }, selectedRole === 'doctor' && styles.roleTitleActive]}>
              {t.docRoleDoctor}
            </Text>
            <Text style={[styles.roleSub, { textAlign: isRTL ? 'right' : 'left' }, selectedRole === 'doctor' && styles.roleSubActive]}>
              {t.docRoleDoctorSub}
            </Text>
          </View>
          {selectedRole === 'doctor' && (
            <Ionicons name="checkmark-circle" size={26} color="#7C5CBF" />
          )}
        </TouchableOpacity>

        {/* Patient */}
        <TouchableOpacity
          style={[styles.roleCard, selectedRole === 'patient' && styles.roleCardActive]}
          onPress={() => setSelectedRole('patient')}
          activeOpacity={0.8}
        >
          <View style={[styles.roleIconWrap, selectedRole === 'patient' && styles.roleIconWrapActive]}>
            <Text style={styles.roleIcon}>🧑‍⚕️</Text>
          </View>
          <View style={[styles.roleTextCol, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={[styles.roleTitle, { textAlign: isRTL ? 'right' : 'left' }, selectedRole === 'patient' && styles.roleTitleActive]}>
              {t.docRolePatient}
            </Text>
            <Text style={[styles.roleSub, { textAlign: isRTL ? 'right' : 'left' }, selectedRole === 'patient' && styles.roleSubActive]}>
              {t.docRolePatientSub}
            </Text>
          </View>
          {selectedRole === 'patient' && (
            <Ionicons name="checkmark-circle" size={26} color="#7C5CBF" />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Continue Button ── */}
      <TouchableOpacity
        style={[styles.continueBtn, !selectedRole && styles.continueBtnDisabled]}
        onPress={handleContinue}
        activeOpacity={selectedRole ? 0.8 : 1}
        disabled={!selectedRole}
      >
        <Text style={styles.continueBtnText}>{t.docContinue}</Text>
        <Ionicons
          name={isRTL ? 'arrow-back' : 'arrow-forward'}
          size={18}
          color={selectedRole ? '#fff' : '#bbb'}
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
  appNameAr: {
    fontSize: 34,
    fontWeight: '700',
    color: '#7C5CBF',
    marginBottom: 4,
  },
  appNameEn: {
    fontSize: 14,
    color: '#999',
    letterSpacing: 0.4,
  },
  headingWrap: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2d2d2d',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  rolesCol: {
    width: '100%',
    gap: 14,
    marginBottom: 32,
  },
  roleCard: {
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
  roleCardActive: {
    borderColor: '#7C5CBF',
    backgroundColor: '#F8F4FF',
  },
  roleIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconWrapActive: {
    backgroundColor: '#EDE6F8',
  },
  roleIcon: {
    fontSize: 28,
  },
  roleTextCol: {
    flex: 1,
    gap: 4,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2d2d2d',
  },
  roleTitleActive: {
    color: '#7C5CBF',
  },
  roleSub: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 18,
  },
  roleSubActive: {
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
  continueBtnDisabled: {
    backgroundColor: '#D8D0EC',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
});