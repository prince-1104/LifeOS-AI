import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Image } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Colors } from "@/constants/Theme";

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

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Image
        source={require("@/assets/images/icon.png")}
        style={styles.loadingLogo}
        resizeMode="contain"
      />
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.loadingText}>Loading Cortexa AI…</Text>
    </View>
  );
}

/**
 * Inner layout that waits for Clerk to initialize.
 * Shows a branded splash screen instead of a blank white/grey screen.
 */
function ClerkGatedLayout() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <LoadingScreen />;
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
      <ClerkGatedLayout />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 16,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
});
