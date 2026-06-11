import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/Languagecontext';
import { Colors, Spacing } from '../constants/Theme';

const TABS = [
  { key: 'home',      icon: 'home-outline'               as const, iconActive: 'home'               as const, route: '/tabs/home'      },
  { key: 'tasks',     icon: 'checkmark-circle-outline'   as const, iconActive: 'checkmark-circle'   as const, route: '/tabs/tasks'     },
  { key: 'info',      icon: 'information-circle-outline' as const, iconActive: 'information-circle' as const, route: '/tabs/info'      },
  { key: 'exercises', icon: 'fitness-outline'            as const, iconActive: 'fitness'            as const, route: '/tabs/exercises' },
  { key: 'more',      icon: 'grid-outline'               as const, iconActive: 'grid'               as const, route: '/tabs/more'      },
];

export default function PatientTabBar() {
  const pathname      = usePathname();
  const insets        = useSafeAreaInsets();
  const { t, isRTL } = useLang();
  const bottomPad     = Math.max(insets.bottom, 12);

  const labels: Record<string, string> = {
    home:      t.home,
    tasks:     t.tasks,
    info:      t.infoTab,
    exercises: t.exercisesTab,
    more:      t.more,
  };

  return (
    <View style={[styles.container, { paddingBottom: bottomPad }]}>
      <View style={[styles.bar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.route || pathname.startsWith(tab.route + '/');
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => !isActive && router.replace(tab.route as any)}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View style={[styles.tabInner, isActive && styles.tabInnerActive]}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={22}
                  color={isActive ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                  {labels[tab.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.base,
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
  tabInnerActive: {
    backgroundColor: Colors.primaryUltraLight,
    borderRadius: 100,
  },
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
});
