import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      {/* elevation layer — gives rounded shadow on Android */}
      <View style={styles.shadow}>
        {/* overflow:hidden layer — clips background to borderRadius on Android */}
        <View style={[styles.pill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {TABS.map((tab) => {
            const isActive = pathname === tab.route || pathname.startsWith(tab.route + '/');
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => !isActive && router.push(tab.route as any)}
                activeOpacity={0.7}
                style={styles.tabItem}
              >
                <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={20}
                    color={isActive ? '#fff' : '#B0BEC5'}
                  />
                </View>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                  {labels[tab.key]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: Spacing.base,
    paddingTop: 8,
  },
  shadow: {
    borderRadius: 25,
    backgroundColor: Colors.white,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  pill: {
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: Colors.white,
    paddingVertical: 8,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 191, 0.3)',
  },
  tabItem:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap:     { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  iconWrapActive: { backgroundColor: Colors.primary },
  tabLabel:     { fontSize: 9, fontWeight: '600', color: '#B0BEC5' },
  tabLabelActive: { fontSize: 9, fontWeight: '700', color: Colors.primary },
});
