// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/Theme';
import { useLang } from '../../context/Languagecontext';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// ─── الـ screens اللي مش المفروض تظهر في الـ tab bar ───────
const HIDDEN_ROUTES = ['startup', 'notification'];

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { t, isRTL } = useLang();

  const tabConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; iconActive: keyof typeof Ionicons.glyphMap; label: string }> = {
    home:      { icon: 'home-outline',             iconActive: 'home',             label: t.home },
    tasks:     { icon: 'checkmark-circle-outline', iconActive: 'checkmark-circle', label: t.tasks },
    exercises: { icon: 'fitness-outline',          iconActive: 'fitness',          label: t.exercisesTab },
    more:      { icon: 'grid-outline',             iconActive: 'grid',             label: t.more },
  };

  const visibleRoutes = state.routes.filter(r => !HIDDEN_ROUTES.includes(r.name));
  if (state.routes[state.index]?.name === 'startup') return null;

  return (
    <View style={styles.container}>
      <View style={[styles.bar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {visibleRoutes.map((route, visualIndex) => {
          const realIndex = state.routes.findIndex(r => r.key === route.key);
          const focused = state.index === realIndex;
          const cfg = tabConfig[route.name];

          const elements = [];
          if (visualIndex === 2) {
            elements.push(
              <TouchableOpacity
                key="fab"
                style={styles.fabWrap}
                onPress={() => navigation.navigate('tasks')}
                activeOpacity={0.85}
              >
                <View style={styles.fab}>
                  <Ionicons name="add" size={30} color={Colors.white} />
                </View>
              </TouchableOpacity>
            );
          }

          // ✅ لو الـ route مش موجود في tabConfig، مش بنرسمه
          if (!cfg) return elements.length > 0 ? elements : null;

          elements.push(
            <TouchableOpacity
              key={route.key}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View style={[styles.tabInner, focused && styles.tabInnerActive]}>
                <Ionicons
                  name={focused ? cfg.iconActive : cfg.icon}
                  size={22}
                  color={focused ? Colors.primary : Colors.textMuted}
                />
                {cfg.label ? (
                  <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
                    {cfg.label}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
          return elements;
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="startup" />
      <Tabs.Screen name="home" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="exercises" />
      <Tabs.Screen name="more" />
      <Tabs.Screen name="notification" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.base,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  bar: {
    backgroundColor: Colors.white,
    borderRadius: 25,
    paddingVertical: 8,
    justifyContent: 'space-around',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  tabItem: { alignItems: 'center', paddingHorizontal: 4 },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  tabInnerActive: { backgroundColor: Colors.primaryUltraLight, borderRadius: 100 },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 1,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  fabWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 100,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
});