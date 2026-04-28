import { useState, useCallback, useEffect } from "react";
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
import * as AuthSession from "expo-auth-session";

// Required for OAuth redirects in Expo
WebBrowser.maybeCompleteAuthSession();

// Preloads the browser for Android devices to reduce authentication load time
// See: https://docs.expo.dev/guides/authentication/#improving-user-experience
const useWarmUpBrowser = () => {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

export default function SignInScreen() {
  useWarmUpBrowser();

  const { signIn } = useSignIn();
  const { startSSOFlow } = useSSO();
  const { setActive } = useClerk();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Client-trust verification state
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // ── Google SSO Sign In ──────────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    console.log("GOOGLE SIGN IN PRESSED");
    setError("");
    setGoogleLoading(true);

    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: "cortexa",
        path: "oauth-native-callback",
      });
      console.log("OAuth redirect URL:", redirectUrl);

      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
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

  // ── Email / Password Sign In (Clerk v3 API) ────────────────────────
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
      // Clerk v3 / @clerk/expo v3 uses signIn.password() instead of signIn.create()
      // signIn.create({identifier, password}) is LEGACY and returns needs_first_factor
      const result = await (signIn as any).password({
        emailAddress: email.trim(),
        password,
      });

      console.log("Clerk sign-in status:", (signIn as any).status);

      const status = (signIn as any).status;

      if (status === "complete") {
        // Finalize and set session active
        await (signIn as any).finalize({
          navigate: ({ session }: any) => {
            if (session?.currentTask) {
              console.log("Session task:", session.currentTask);
              return;
            }
            router.replace("/(tabs)/chat");
          },
        });
      } else if (status === "needs_client_trust") {
        // Client trust enabled — need email verification code
        console.log("Needs client trust verification");
        try {
          const emailCodeFactor = (signIn as any).supportedSecondFactors?.find(
            (f: any) => f.strategy === "email_code"
          );
          if (emailCodeFactor) {
            await (signIn as any).mfa.sendEmailCode();
          }
        } catch (e) {
          console.log("Failed to send verification code, may already be sent:", e);
        }
        setNeedsVerification(true);
      } else if (status === "needs_second_factor") {
        console.log("MFA required");
        setError("Multi-factor authentication required. Please use the web app.");
      } else {
        console.log("Unexpected status:", status);
        setError(`Sign-in returned status: ${status}. Please try again.`);
      }
    } catch (err: any) {
      console.log("LOGIN ERROR:", JSON.stringify(err, null, 2));

      // Fallback to legacy create() if password() doesn't exist
      if (err?.message?.includes("password is not a function") ||
          err?.message?.includes("signIn.password")) {
        try {
          const result = await (signIn as any).create({
            identifier: email.trim(),
            password,
          });
          console.log("Legacy Clerk response status:", result.status);

          if (result.status === "complete" && result.createdSessionId) {
            await setActive({ session: result.createdSessionId });
            router.replace("/(tabs)/chat");
            return;
          } else if (result.status === "needs_first_factor") {
            // Attempt first factor with password
            const firstFactorResult = await (signIn as any).attemptFirstFactor({
              strategy: "password",
              password,
            });
            if (firstFactorResult.status === "complete" && firstFactorResult.createdSessionId) {
              await setActive({ session: firstFactorResult.createdSessionId });
              router.replace("/(tabs)/chat");
              return;
            }
          }
          setError("Sign-in incomplete. Status: " + result.status);
        } catch (fallbackErr: any) {
          console.log("FALLBACK LOGIN ERROR:", JSON.stringify(fallbackErr, null, 2));
          setError(
            fallbackErr?.errors?.[0]?.longMessage ||
            fallbackErr?.errors?.[0]?.message ||
            fallbackErr?.message ||
            "Sign-in failed. Please check your credentials."
          );
        }
      } else {
        setError(
          err?.errors?.[0]?.longMessage ||
            err?.errors?.[0]?.message ||
            err?.message ||
            "Sign-in failed. Please check your credentials."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, setActive, router]);

  // ── Verify email code (client trust) ───────────────────────────────
  const handleVerifyCode = useCallback(async () => {
    if (!verificationCode.trim()) {
      setError("Please enter the verification code.");
      return;
    }
    setVerifying(true);
    setError("");

    try {
      await (signIn as any).mfa.verifyEmailCode({ code: verificationCode.trim() });

      if ((signIn as any).status === "complete") {
        await (signIn as any).finalize({
          navigate: ({ session }: any) => {
            if (session?.currentTask) {
              console.log("Session task:", session.currentTask);
              return;
            }
            router.replace("/(tabs)/chat");
          },
        });
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.longMessage ||
          err?.message ||
          "Verification failed. Please check your code."
      );
    } finally {
      setVerifying(false);
    }
  }, [verificationCode, signIn, router]);

  const isAnyLoading = loading || googleLoading;

  // ── Verification Code Screen ───────────────────────────────────────
  if (needsVerification) {
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
            <View style={styles.logoContainer}>
              <Text style={styles.title}>Verify Your Account</Text>
              <Text style={styles.subtitle}>
                We sent a verification code to your email.
              </Text>
            </View>

            <TextInput
              style={styles.input}
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Enter verification code"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              autoFocus
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.signInButton, verifying && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={verifying}
              activeOpacity={0.8}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Verify</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setNeedsVerification(false);
                setVerificationCode("");
                setError("");
              }}
              style={{ paddingVertical: 12, alignItems: "center" }}
            >
              <Text style={{ color: Colors.accent, fontSize: FontSize.sm }}>
                ← Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

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
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.googleInner}>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleText}>Continue with Google</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email */}
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isAnyLoading}
          />

          {/* Password */}
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            editable={!isAnyLoading}
          />

          {/* Error */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInButton, isAnyLoading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={isAnyLoading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Sign Up Link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={styles.linkHighlight}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDeep },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  inner: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.lg,
  },

  // Logo
  logoContainer: { alignItems: "center", marginBottom: Spacing.lg },
  heroImage: {
    width: 120,
    height: 120,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
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
    marginTop: 4,
  },

  // Google button
  googleButton: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: "center",
  },
  googleInner: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  googleIcon: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: "#4285F4",
  },
  googleText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.glassBorder },
  dividerText: { fontSize: FontSize.sm, color: Colors.textDark },

  // Input
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

  // Error
  errorText: {
    color: Colors.dangerLight || "#f87171",
    fontSize: FontSize.sm,
    textAlign: "center",
  },

  // Sign in button
  signInButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  signInButtonText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "700",
  },

  // Link
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  linkText: { fontSize: FontSize.sm, color: Colors.textMuted },
  linkHighlight: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.accent,
    textDecorationLine: "underline",
  },
});
