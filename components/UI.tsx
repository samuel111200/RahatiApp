// components/UI.tsx – Shared UI building blocks
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { Colors, Spacing, Radius, FontSize } from '../constants/Theme';

// ── Primary Button ────────────────────────────────────────────────────────────
export function PrimaryButton({
  title, onPress, loading, style, disabled, color,
}: {
  title: string; onPress: () => void; loading?: boolean;
  style?: any; disabled?: boolean; color?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[styles.primaryBtn, { backgroundColor: color || Colors.primary },
        (disabled || loading) && { opacity: 0.6 }, style]}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={styles.primaryBtnText}>{title}</Text>}
    </TouchableOpacity>
  );
}

// ── Outline Button ────────────────────────────────────────────────────────────
export function OutlineButton({ title, onPress, style }: { title: string; onPress: () => void; style?: any }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}
      style={[styles.outlineBtn, style]}>
      <Text style={styles.outlineBtnText}>{title}</Text>
    </TouchableOpacity>
  );
}

// ── Input Field ───────────────────────────────────────────────────────────────
export function InputField({
  label, placeholder, value, onChangeText, secureTextEntry,
  keyboardType, error, rtl = true, rightIcon, ...rest
}: {
  label?: string; placeholder?: string; value: string;
  onChangeText: (v: string) => void; secureTextEntry?: boolean;
  keyboardType?: any; error?: string; rtl?: boolean; rightIcon?: React.ReactNode; [key: string]: any;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputWrapper}>
      {label ? <Text style={[styles.label, { textAlign: rtl ? 'right' : 'left' }]}>{label}</Text> : null}
      <View style={[styles.inputBox, focused && styles.inputBoxFocused, error && styles.inputBoxError]}>
        <TextInput
          style={[styles.input, { textAlign: rtl ? 'right' : 'left' }]}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          textContentType="none"
          {...rest}
        />
        {rightIcon && <View style={{ marginLeft: 8 }}>{rightIcon}</View>}
      </View>
      {error ? <Text style={[styles.errorText, { textAlign: rtl ? 'right' : 'left' }]}>{error}</Text> : null}
    </View>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Gender Picker ─────────────────────────────────────────────────────────────
export function GenderPicker({
  value, onChange, maleLabel, femaleLabel, rtl,
}: { value: string; onChange: (v: string) => void; maleLabel: string; femaleLabel: string; rtl: boolean }) {
  return (
    <View style={[styles.genderRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
      {[{ k: 'male', l: maleLabel }, { k: 'female', l: femaleLabel }].map(({ k, l }) => (
        <TouchableOpacity key={k} onPress={() => onChange(k)} activeOpacity={0.8}
          style={[styles.genderOpt, value === k && styles.genderOptActive]}>
          <Text style={[styles.genderOptText, value === k && styles.genderOptTextActive]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Progress Step Bar ─────────────────────────────────────────────────────────
export function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.stepBarRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.stepBarItem, i < current && styles.stepBarItemActive]} />
      ))}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  primaryBtn: {
    borderRadius: Radius.xl, paddingVertical: 17,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  primaryBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '700', letterSpacing: 0.3 },
  outlineBtn: {
    borderRadius: Radius.xl, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1.5, borderColor: Colors.primary,
  },
  outlineBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  inputWrapper: { marginBottom: 14 },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: 6 },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.inputBg, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.base, minHeight: 54,
  },
  inputBoxFocused: { borderColor: Colors.primary, backgroundColor: '#fff' },
  inputBoxError: { borderColor: Colors.danger },
  input: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
  errorText: { color: Colors.danger, fontSize: FontSize.xs, marginTop: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.pill, backgroundColor: Colors.primaryUltraLight, marginHorizontal: 4 },
  chipActive: { backgroundColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.primary },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  genderRow: { gap: 12 },
  genderOpt: { flex: 1, paddingVertical: 14, borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.inputBorder, alignItems: 'center', backgroundColor: Colors.inputBg },
  genderOptActive: { backgroundColor: Colors.primaryUltraLight, borderColor: Colors.primary },
  genderOptText: { fontSize: FontSize.base, fontWeight: '500', color: Colors.textSecondary },
  genderOptTextActive: { color: Colors.primary, fontWeight: '700' },
  stepBarRow: { flexDirection: 'row', gap: 6 },
  stepBarItem: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  stepBarItemActive: { backgroundColor: Colors.primary },
});
