import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/Languagecontext';

const DOC_COLOR = '#4A90D9';

export default function DocTabBar() {
  const pathname  = usePathname();
  const insets    = useSafeAreaInsets();
  const { t, isRTL } = useLang();
  const bottomPad = Math.max(insets.bottom, 8);

  const TABS = [
    { label: t.home,            icon: 'home-outline'            as const, iconActive: 'home'            as const, route: '/Doctor/Dochome'      },
    { label: t.docChats,        icon: 'chatbubbles-outline'     as const, iconActive: 'chatbubbles'     as const, route: '/Doctor/Docchat'      },
    { label: t.infoTab,         icon: 'information-circle-outline' as const, iconActive: 'information-circle' as const, route: '/Doctor/DocInfo'  },
    { label: t.docMedicationInfo, icon: 'medkit-outline'        as const, iconActive: 'medkit'          as const, route: '/Doctor/DocMedication' },
    { label: t.more,            icon: 'grid-outline'            as const, iconActive: 'grid'            as const, route: '/Doctor/Docmore'      },
  ];

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <View style={[styles.container, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.route);
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tab}
              onPress={() => !isActive && router.replace(tab.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={20}
                  color={isActive ? '#fff' : '#B0BEC5'}
                />
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
    shadowColor: DOC_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
    borderWidth: 0.5,
    borderColor: '#E8DFFA',
    marginBottom: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: DOC_COLOR,
    shadowColor: DOC_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  label: { fontSize: 9, fontWeight: '600', color: '#B0BEC5' },
  labelActive: { color: DOC_COLOR, fontWeight: '700' },
});
