// components/RahatiLogo.tsx
// Matches the uploaded logo: purple rounded-square bg, dark figure with raised arm, green leaf
import React from 'react';
import Svg, {
  Path, Circle, G, Defs, LinearGradient, Stop, Rect, Ellipse,
} from 'react-native-svg';
import { View } from 'react-native';

interface Props {
  size?: number;
  showBackground?: boolean; // false = transparent (for use on colored backgrounds)
}

export default function RahatiLogo({ size = 80, showBackground = true }: Props) {
  const r = size / 100; // scale ratio

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#9B7DD4" />
            <Stop offset="100%" stopColor="#5A3D9A" />
          </LinearGradient>
          <LinearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#7BCF6A" />
            <Stop offset="100%" stopColor="#3DAF57" />
          </LinearGradient>
        </Defs>

        {/* ── Rounded square background ── */}
        {showBackground && (
          <Rect x="0" y="0" width="100" height="100" rx="22" ry="22" fill="url(#bgGrad)" />
        )}

        {/* ── Figure body – dark silhouette ── */}
        {/* Head */}
        <Circle cx="50" cy="22" r="9" fill="#1A1030" />

        {/* Torso */}
        <Path d="M42 32 Q50 28 58 32 L60 56 Q50 60 40 56 Z" fill="#1A1030" />

        {/* Left arm – raised up-right */}
        <Path
          d="M56 36 Q66 26 72 20"
          stroke="#1A1030"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Right arm – down */}
        <Path
          d="M44 36 Q36 44 34 52"
          stroke="#1A1030"
          strokeWidth="4.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Left leg */}
        <Path
          d="M47 56 Q44 68 42 78"
          stroke="#1A1030"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Right leg */}
        <Path
          d="M53 56 Q56 68 58 78"
          stroke="#1A1030"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
        />

        {/* ── Green leaf near raised hand ── */}
        {/* Leaf body */}
        <Path
          d="M68 22 C72 16 82 18 80 28 C78 34 70 32 68 22 Z"
          fill="url(#leafGrad)"
        />
        {/* Leaf vein */}
        <Path
          d="M68 22 Q74 28 80 28"
          stroke="#2A8A3A"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity="0.6"
        />
      </Svg>
    </View>
  );
}
