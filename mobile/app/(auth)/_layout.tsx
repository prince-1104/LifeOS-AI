import { Stack } from "expo-router";
import { Colors } from "@/constants/Theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bgDeep },
        animation: "slide_from_bottom",
      }}
    />
  );
}
