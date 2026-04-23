import { useEffect, useState, useRef } from "react";
import { View, ActivityIndicator, StyleSheet, Text, Image, TouchableOpacity } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
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

function LoadingScreen({ timedOut, onRetry }: { timedOut: boolean; onRetry: () => void }) {
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
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

/**
 * Inner layout that waits for Clerk to initialize.
 * Has a timeout safety net — if Clerk doesn't load within 15 seconds,
 * shows a retry button instead of spinning forever.
 */
function ClerkGatedLayout() {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Reset timeout on each retry
    setTimedOut(false);

    if (!isLoaded) {
      timerRef.current = setTimeout(() => {
        setTimedOut(true);
      }, 15000); // 15 second timeout
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoaded, retryKey]);

  // Clear timeout when loaded
  useEffect(() => {
    if (isLoaded && timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <LoadingScreen
        timedOut={timedOut}
        onRetry={() => {
          // Clear token cache and retry — stale tokens can cause Clerk to hang
          try {
            tokenCache.deleteToken("__clerk_client_jwt");
          } catch {}
          setRetryKey((k) => k + 1);
        }}
      />
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
