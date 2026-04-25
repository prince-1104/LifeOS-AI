import { useEffect, useState, useCallback, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Image, TouchableOpacity } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, useAuth } from "@clerk/expo";
import * as SecureStore from "expo-secure-store";
import { Colors } from "@/constants/Theme";

// ── Clerk token cache using expo-secure-store ───────────────────────────
// Manual implementation for guaranteed compatibility.
const tokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      try { await SecureStore.deleteItemAsync(key); } catch {}
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {}
  },
};

// Helper to clear all Clerk-related tokens from SecureStore
async function clearClerkTokens() {
  const keysToDelete = [
    "__clerk_client_jwt",
    "__clerk_client_uat",
    "__clerk_session_id",
    "__clerk_publishable_key",
  ];
  for (const key of keysToDelete) {
    try { await SecureStore.deleteItemAsync(key); } catch {}
  }
}

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

/**
 * Inner layout that waits for Clerk to initialize.
 * Has a 12-second timeout — if Clerk doesn't load, it clears
 * potentially stale tokens and offers a retry button.
 */
function ClerkGatedLayout() {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLoaded) {
      // Clerk loaded successfully — clear any pending timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setTimedOut(false);
      return;
    }

    // Not loaded yet — start timeout
    setTimedOut(false);
    timerRef.current = setTimeout(() => {
      setTimedOut(true);
    }, 12000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoaded, retryCount]);

  const handleRetry = useCallback(async () => {
    // Clear stale tokens that may be causing Clerk to hang
    await clearClerkTokens();
    setTimedOut(false);
    setRetryCount((c) => c + 1);
  }, []);

  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <Image
          source={require("@/assets/images/icon.png")}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        {!timedOut ? (
          <>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading Cortexa AI…</Text>
          </>
        ) : (
          <>
            <Text style={styles.errorText}>
              Connection issue. Please check your internet and try again.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
              activeOpacity={0.7}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </>
        )}
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
    paddingHorizontal: 32,
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
  errorText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
