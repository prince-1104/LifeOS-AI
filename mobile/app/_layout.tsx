import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { Colors } from "@/constants/Theme";

// ── Clerk token cache using expo-secure-store ───────────────────────────
const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // silently fail
    }
  },
};

// 🔑 Clerk publishable key (production — same Clerk app as the web frontend)
const CLERK_PUBLISHABLE_KEY =
  "pk_live_Y2xlcmsuZG9wdG9uaW4ub25saW5lJA";

function AuthGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)/chat");
    }
  }, [isSignedIn, isLoaded, segments]);

  return null;
}

function RootLayoutNav() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <>
      <AuthGate />
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bgDeep },
          animation: "fade",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="billing"
          options={{
            animation: "slide_from_right",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="pricing"
          options={{
            animation: "slide_from_right",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="memories"
          options={{
            animation: "slide_from_right",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="+not-found"
          options={{ headerShown: true, title: "Not Found" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={tokenCache}
    >
      <RootLayoutNav />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
    justifyContent: "center",
    alignItems: "center",
  },
});
