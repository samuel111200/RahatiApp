// components/RahatiLogo.tsx
import React from "react";
import { Image, View } from "react-native";

export default function RahatiLogo() {
  return (
    <View style={{ marginTop: 20 }}>
      <Image
        source={require("../assets/images/logo.png")}
        style={{ width: 125, height: 125 }}
        resizeMode="contain"
      />
    </View>
  );
}
