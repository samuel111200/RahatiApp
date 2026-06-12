import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/Languagecontext';

const DOC_COLOR = '#7C5CBF';

export default function DocTabBar() {
  const pathname      = usePathname();
  const insets        = useSafeAreaInsets();
  const { t, isRTL } = useLang();
  const bottomPad     = Math.max(insets.bottom, 8);

  const TABS = [
    { label: t.home,              icon: 'home-outline'               as const, iconActive: 'home'               as const, route: '/Doctor/Dochome'      },
    { label: t.docChats,          icon: 'chatbubbles-outline'        as const, iconActive: 'chatbubbles'        as const, route: '/Doctor/Docchat'      },
    { label: t.infoTab,           icon: 'information-circle-outline' as const, iconActive: 'information-circle' as const, route: '/Doctor/DocInfo'      },
    { label: t.docMedicationInfo, icon: 'medkit-outline'             as const, iconActive: 'medkit'             as const, route: '/Doctor/DocMedication' },
    { label: t.more,              icon: 'grid-outline'               as const, iconActive: 'grid'               as const, route: '/Doctor/Docmore'      },
  ];

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      {/* elevation layer — gives rounded shadow on Android */}
      <View style={styles.shadow}>
        {/* overflow:hidden layer — clips background to borderRadius on Android */}
        <View style={[styles.pill, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          {TABS.map((tab) => {
            const isActive = pathname.startsWith(tab.route);
            return (
              <TouchableOpacity
                key={tab.route}
                style={styles.tab}
                onPress={() => !isActive && router.push(tab.route as any)}
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
    paddingHorizontal: 16,
  },
  shadow: {
    borderRadius: 28,
    backgroundColor: '#fff',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    marginBottom: 8,
  },
  pill: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#fff',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 191, 0.3)',
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconWrapActive: {
    backgroundColor: DOC_COLOR,
  },
  label:       { fontSize: 9,  fontWeight: '600', color: '#B0BEC5' },
  labelActive: { fontSize: 9,  fontWeight: '700', color: DOC_COLOR },
});
