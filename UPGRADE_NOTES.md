# RahatiApp — Upgraded to Expo SDK 54

## What changed

### package.json
| Package | Old (SDK 52) | New (SDK 54) |
|---|---|---|
| expo | ~52.0.46 | ~54.0.8 |
| expo-blur | ~14.0.3 | ~15.0.7 |
| expo-constants | ~17.0.8 | ~18.0.9 |
| expo-font | ~13.0.4 | ~14.0.8 |
| expo-haptics | ~14.0.1 | ~15.0.7 |
| expo-linear-gradient | ~14.0.2 | ~15.0.7 |
| expo-linking | ~7.0.5 | ~8.0.8 |
| expo-router | ~4.0.20 | ~6.0.8 |
| expo-splash-screen | ~0.29.22 | ~31.0.10 |
| expo-status-bar | ~2.0.1 | ~3.0.8 |
| expo-symbols | ~0.2.2 | ~1.0.7 |
| expo-system-ui | ~4.0.9 | ~6.0.7 |
| expo-web-browser | ~14.0.2 | ~15.0.7 |
| @expo/vector-icons | ~14.0.4 | ^15.0.2 |
| react | 18.3.1 | 19.1.0 |
| react-dom | 18.3.1 | 19.1.0 |
| react-native | 0.76.9 | 0.81.4 |
| react-native-gesture-handler | ~2.20.2 | ~2.28.0 |
| react-native-reanimated | ~3.16.1 | ~4.1.0 |
| react-native-safe-area-context | 4.12.0 | ~5.6.0 |
| react-native-screens | ~4.4.0 | ~4.16.0 |
| react-native-svg | 15.8.0 | ~15.11.2 |
| react-native-web | ~0.19.13 | ^0.21.0 |
| @types/react | ~18.3.12 | ~19.0.0 |
| **react-native-worklets** | *(not present)* | **~0.4.0 (NEW — required by Reanimated v4)** |

### babel.config.js
- Removed `react-native-reanimated/plugin` — **Reanimated v4 no longer requires this Babel plugin**.

### app.json
- Added `sdkVersion: "54.0.0"` explicitly.
- Added `android.targetSdkVersion: 36` (Android 16 / API 36 is now the target in SDK 54).

---

## How to install

```bash
# 1. Delete old node_modules and lock file
rm -rf node_modules package-lock.json

# 2. Install all updated dependencies
npm install

# 3. Verify everything is compatible
npx expo-doctor

# 4. Start the app
npx expo start
```

## Important SDK 54 notes

- **React 19**: The app now uses React 19.1.0. This is a major version — if you add new packages, ensure they support React 19.
- **Reanimated v4**: No Babel plugin needed. If you see errors about `react-native-worklets`, run `npx expo install react-native-worklets`.
- **Android edge-to-edge**: Edge-to-edge layout is always enabled on Android 16 (API 36). The custom tab bar uses `paddingBottom` for safe area — verify it looks correct on device.
- **expo-router v6**: Upgraded from v4. The routing API is backwards compatible for your current screens.
