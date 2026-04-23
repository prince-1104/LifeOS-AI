import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import { getProfile, updateProfile, getSubscriptionStatus, type UserProfile, type SubscriptionStatus } from "@/lib/api";

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function ProfileScreen() {
  const { getToken, signOut } = useAuth();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [hobbies, setHobbies] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [p, sub] = await Promise.all([
          getProfile(getToken),
          getSubscriptionStatus(getToken).catch(() => null),
        ]);
        setProfile(p);
        setSubscription(sub);
        setFirstName(p.first_name || "");
        setLastName(p.last_name || "");
        setAge(p.age != null ? String(p.age) : "");
        setGender(p.gender || "");
        setAddress(p.address || "");
        setHobbies(p.hobbies || "");
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const updated = await updateProfile(getToken, {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        age: age ? parseInt(age) : undefined,
        gender: gender || undefined,
        address: address.trim() || undefined,
        hobbies: hobbies.trim() || undefined,
      });
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [getToken, firstName, lastName, age, gender, address, hobbies]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }, [signOut]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  const planName = subscription?.plan?.display_name || "Free";
  const isActive = subscription?.is_active ?? true;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Text style={styles.headerSubtitle}>Manage your account</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* User Avatar & Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {(firstName || user?.firstName || "C").charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>
            {firstName || user?.firstName || ""}{" "}
            {lastName || user?.lastName || ""}
          </Text>
          <Text style={styles.userEmail}>
            {profile?.email || user?.primaryEmailAddress?.emailAddress || ""}
          </Text>
        </View>

        {/* Quick Links */}
        <View style={styles.linksCard}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push("/billing" as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: "rgba(16,185,129,0.12)" }]}>
              <Ionicons name="card-outline" size={18} color={Colors.success} />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Billing & Subscription</Text>
              <Text style={styles.linkSubtitle}>
                {planName} · {isActive ? "Active" : "Expired"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textDark} />
          </TouchableOpacity>

          <View style={styles.linkDivider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push("/memories" as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: "rgba(139,92,246,0.12)" }]}>
              <Ionicons name="bulb-outline" size={18} color="#8b5cf6" />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Memories</Text>
              <Text style={styles.linkSubtitle}>View & manage saved memories</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textDark} />
          </TouchableOpacity>

          <View style={styles.linkDivider} />

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push("/pricing" as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.linkIcon, { backgroundColor: "rgba(99,102,241,0.12)" }]}>
              <Ionicons name="diamond-outline" size={18} color={Colors.accent} />
            </View>
            <View style={styles.linkInfo}>
              <Text style={styles.linkTitle}>Upgrade Plan</Text>
              <Text style={styles.linkSubtitle}>View all pricing tiers</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textDark} />
          </TouchableOpacity>
        </View>

        {/* Identity Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>IDENTITY</Text>

          {/* Read-only email */}
          {profile?.email && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{profile.email}</Text>
              </View>
            </View>
          )}

          {profile?.phone && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>{profile.phone}</Text>
              </View>
            </View>
          )}

          {/* Editable fields */}
          <View style={styles.nameRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={Colors.textDark}
              />
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={Colors.textDark}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              placeholder="Your age"
              placeholderTextColor={Colors.textDark}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderPill, gender === g && styles.genderPillActive]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.genderText, gender === g && styles.genderTextActive]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Additional Info Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>ADDITIONAL INFORMATION</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your address..."
              placeholderTextColor={Colors.textDark}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Hobbies / Interests</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={hobbies}
              onChangeText={setHobbies}
              placeholder="Reading, gaming, cooking..."
              placeholderTextColor={Colors.textDark}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Status Messages */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ Profile saved successfully!</Text>
          </View>
        ) : null}

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDeep },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 60, gap: Spacing.lg },

  // Avatar
  avatarSection: { alignItems: "center", paddingVertical: Spacing.lg },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  avatarLetter: {
    fontSize: 34,
    fontWeight: "700",
    color: "#fff",
  },
  userName: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },

  // Quick Links
  linksCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  linkInfo: { flex: 1 },
  linkTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  linkSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  linkDivider: {
    height: 1,
    backgroundColor: Colors.glassBorder,
    marginLeft: 68,
  },

  // Section card
  sectionCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.textDark,
    letterSpacing: 1.5,
    marginBottom: Spacing.lg,
  },

  // Fields
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: Colors.textMuted,
    marginBottom: 6,
  },
  readOnlyField: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
  },
  readOnlyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  multilineInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  nameRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },

  // Gender pills
  genderRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  genderPill: {
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  genderPillActive: {
    borderColor: "rgba(99,102,241,0.5)",
    backgroundColor: "rgba(99,102,241,0.1)",
  },
  genderText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  genderTextActive: {
    color: Colors.accentLight,
  },

  // Status
  errorBanner: {
    backgroundColor: "rgba(244,63,94,0.1)",
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  errorText: { color: Colors.dangerLight, fontSize: FontSize.sm },
  successBanner: {
    backgroundColor: "rgba(16,185,129,0.1)",
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  successText: { color: Colors.successLight, fontSize: FontSize.sm },

  // Save
  saveButton: {
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
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "600",
  },

  // Sign out
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  signOutText: {
    color: Colors.danger,
    fontSize: FontSize.md,
    fontWeight: "600",
  },
});
