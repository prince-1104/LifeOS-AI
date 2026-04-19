import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import { getSubscriptionStatus, type SubscriptionStatus } from "@/lib/api";

// ── Usage Bar ───────────────────────────────────────────────────────────
function UsageBar({
  label,
  icon,
  used,
  total,
}: {
  label: string;
  icon: string;
  used: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(used / total, 1) : 0;
  const animWidth = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: pct,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const barColor =
    pct >= 0.9 ? Colors.danger : pct >= 0.7 ? Colors.warning : Colors.accent;

  return (
    <View style={styles.usageItem}>
      <View style={styles.usageHeader}>
        <View style={styles.usageLabelRow}>
          <Text style={styles.usageIcon}>{icon}</Text>
          <Text style={styles.usageLabel}>{label}</Text>
        </View>
        <Text style={styles.usageCount}>
          {used}
          <Text style={styles.usageTotal}> / {total}</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: barColor,
              width: animWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ── Feature Row ─────────────────────────────────────────────────────────
function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons
        name={enabled ? "checkmark-circle" : "close-circle"}
        size={18}
        color={enabled ? Colors.success : Colors.textDark}
      />
      <Text style={[styles.featureText, !enabled && styles.featureTextDisabled]}>
        {label}
      </Text>
    </View>
  );
}

export default function BillingScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getSubscriptionStatus(getToken);
        setStatus(data);
      } catch {
        setError("Failed to load billing status");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  if (error || !status) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerBarTitle}>Billing</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || "Could not load data"}</Text>
        </View>
      </View>
    );
  }

  const { plan, usage, is_active, plan_end_date } = status;
  const isFree = plan.price_inr_monthly === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Account & Billing</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Plan Overview Card */}
        <View style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <View>
              <Text style={styles.planSectionLabel}>CURRENT PLAN</Text>
              <Text style={styles.planName}>{plan.display_name}</Text>
              <Text style={styles.planPrice}>
                {isFree ? "₹0" : `₹${plan.price_inr_monthly}`}
                <Text style={styles.planPriceSuffix}> / month</Text>
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                { borderColor: is_active ? "rgba(16,185,129,0.3)" : "rgba(244,63,94,0.3)" },
                { backgroundColor: is_active ? "rgba(16,185,129,0.1)" : "rgba(244,63,94,0.1)" },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: is_active ? Colors.success : Colors.danger },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: is_active ? Colors.success : Colors.danger },
                ]}
              >
                {is_active ? "Active" : "Expired"}
              </Text>
            </View>
          </View>

          {!isFree && plan_end_date && (
            <View style={styles.renewalInfo}>
              <Ionicons name="refresh-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.renewalText}>
                Next renewal:{" "}
                {new Date(plan_end_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
          )}

          {isFree ? (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push("/pricing" as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="flash" size={16} color="#fff" />
              <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.managePlanButton}
              onPress={() => router.push("/pricing" as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.managePlanText}>Change Plan →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Usage Bars */}
        <View style={styles.usageCard}>
          <View style={styles.usageCardHeader}>
            <Text style={styles.usageCardTitle}>Daily Resource Allocation</Text>
            <Text style={styles.usageResetLabel}>RESETS DAILY</Text>
          </View>

          <UsageBar
            label="AI Generations"
            icon="⚡"
            used={usage.requests_today}
            total={plan.daily_requests}
          />
          <UsageBar
            label="Neural Storage"
            icon="🧠"
            used={usage.memory_writes_today}
            total={plan.memory_writes_per_day}
          />
          <UsageBar
            label="Reminders"
            icon="⏰"
            used={usage.reminders_today}
            total={plan.reminders_per_day}
          />
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresSectionTitle}>PLAN FEATURES</Text>
          <FeatureRow label="Voice Input" enabled={plan.voice_input} />
          <FeatureRow label="Premium Text-to-Speech" enabled={plan.premium_tts} />
          <FeatureRow label="Long-Term Reminders" enabled={plan.long_term_reminder} />
          <FeatureRow
            label={`${plan.memory_storage_limit} Memory Storage Limit`}
            enabled={true}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDeep },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  // Header bar
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
  },
  backBtn: { padding: Spacing.sm },
  headerBarTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },

  // Plan card
  planCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  planCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planSectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.textDark,
    letterSpacing: 1.5,
  },
  planName: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  planPrice: {
    fontSize: FontSize.lg,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  planPriceSuffix: {
    fontSize: FontSize.sm,
    fontWeight: "400",
    color: Colors.textMuted,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  renewalInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    paddingTop: Spacing.md,
  },
  renewalText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    marginTop: Spacing.lg,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: FontSize.md,
    fontWeight: "600",
  },
  managePlanButton: {
    backgroundColor: "rgba(99,102,241,0.1)",
    borderRadius: Radius.lg,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  managePlanText: {
    color: Colors.accentLight,
    fontSize: FontSize.sm,
    fontWeight: "600",
  },

  // Usage card
  usageCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.xl,
  },
  usageCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  usageCardTitle: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  usageResetLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textDark,
    letterSpacing: 1.5,
  },
  usageItem: { marginBottom: Spacing.lg },
  usageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  usageLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  usageIcon: { fontSize: 14 },
  usageLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  usageCount: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  usageTotal: {
    fontWeight: "400",
    color: Colors.textMuted,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Features
  featuresCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.xl,
  },
  featuresSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    color: Colors.textDark,
    letterSpacing: 1.5,
    marginBottom: Spacing.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  featureText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  featureTextDisabled: {
    color: Colors.textDark,
  },

  // Error
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  errorText: {
    color: Colors.dangerLight,
    fontSize: FontSize.sm,
    textAlign: "center",
  },
});
