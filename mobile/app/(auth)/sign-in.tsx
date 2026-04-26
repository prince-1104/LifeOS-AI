import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useSignIn, useSSO, useClerk } from "@clerk/expo";
import { useRouter, Link } from "expo-router";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import * as WebBrowser from "expo-web-browser";

// Required for OAuth redirects in Expo
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  // @clerk/expo v3 / @clerk/react v6 new API:
  //   useSignIn() → { signIn: { create(), password(), ... }, errors, fetchStatus }
  //   setActive comes from useClerk()
  const { signIn } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { setActive } = useClerk();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Google SSO Sign In ──────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    console.log("GOOGLE SIGN IN PRESSED");
    setError("");
    setGoogleLoading(true);

    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: "oauth_google",
      });

      console.log("SSO flow completed. Session:", createdSessionId);

      if (createdSessionId) {
        const activator = ssoSetActive || setActive;
        await activator({ session: createdSessionId });
        console.log("Google session activated. Navigating...");
        router.replace("/(tabs)/chat");
      } else {
        console.log("No session created — may need additional verification.");
        setError("Sign in incomplete. Please try email/password or try again.");
      }
    } catch (err: any) {
      console.log("GOOGLE SSO ERROR:", err);

      const msg = err?.message || "";
      if (msg.includes("cancel") || msg.includes("dismiss")) {
        console.log("User cancelled Google sign-in");
      } else {
        setError(
          err?.errors?.[0]?.longMessage ||
            err?.message ||
            "Google sign-in failed. Please try again."
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [startSSOFlow, setActive, router]);

  // ── Email / Password Sign In ────────────────────────────────────────
  const handleSignIn = useCallback(async () => {
    console.log("EMAIL SIGN IN PRESSED");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // New @clerk/react v6 API:
      //   signIn.create() is a gated method that auto-waits for Clerk to load
      //   It returns a SignInResource with status + createdSessionId
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      console.log("Clerk response status:", result.status);

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        console.log("Email session activated. Navigating...");
        router.replace("/(tabs)/chat");
      } else {
        console.log("Login incomplete. Status:", result.status);
        setError("Sign-in incomplete. Please verify your email.");
      }
    } catch (err: any) {
      console.log("LOGIN ERROR:", JSON.stringify(err, null, 2));
      setError(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err?.message ||
          "Sign-in failed. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, setActive, router]);

  const isAnyLoading = loading || googleLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/hero_brand.jpg")}
              style={styles.heroImage}
              resizeMode="contain"
            />
            <Text style={styles.title}>Cortexa AI</Text>
            <Text style={styles.subtitle}>Your day, understood.</Text>
          </View>

          {/* Google SSO Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            disabled={isAnyLoading}
            activeOpacity={0.8}
          >
            {googleLoading ? (
              <ActivityIndicator color={Colors.textPrimary} size="small" />
            ) : (
              <View style={styles.googleButtonInner}>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email / Password Form */}
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!isAnyLoading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!isAnyLoading}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, isAnyLoading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={isAnyLoading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  heroImage: {
    width: 200,
    height: 114,
    borderRadius: 16,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  // Google SSO
  googleButton: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  googleButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4285F4",
  },
  googleButtonText: {
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.glassBorder,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginHorizontal: Spacing.md,
  },
  // Form
  form: {
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Platform.OS === "ios" ? 16 : 14,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  error: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    textAlign: "center",
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: Spacing.sm,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: FontSize.lg,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: Spacing.xxl,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  footerLink: {
    color: Colors.accentLight,
    fontSize: FontSize.sm,
    fontWeight: "600",
  },
});
