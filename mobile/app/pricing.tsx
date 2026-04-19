import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import {
  getPlans,
  getSubscriptionStatus,
  validatePromoCode,
  createSubscription,
  type PlanInfo,
  type ValidatePromoResponse,
} from "@/lib/api";

const SCREEN_WIDTH = Dimensions.get("window").width;

// ── Plan features helper ────────────────────────────────────────────────
function getPlanFeatures(plan: PlanInfo): string[] {
  const features: string[] = [
    `${plan.daily_requests} AI requests/day`,
    `${plan.memory_writes_per_day} memory writes/day`,
    `${plan.memory_storage_limit} memories stored`,
    `${plan.reminders_per_day} reminders/day`,
  ];
  if (plan.voice_input) features.push("Voice Input");
  if (plan.premium_tts) features.push("Premium TTS");
  if (plan.long_term_reminder) features.push("Long-term Reminders");
  return features;
}

// ── Plan Card ───────────────────────────────────────────────────────────
function PlanCard({
  plan,
  isCurrentPlan,
  cycle,
  discountPercent,
  isApplicable,
  onSelect,
  processing,
}: {
  plan: PlanInfo;
  isCurrentPlan: boolean;
  cycle: "monthly" | "yearly";
  discountPercent?: number;
  isApplicable: boolean;
  onSelect: () => void;
  processing: boolean;
}) {
  const isFree = plan.price_inr_monthly === 0;
  const basePrice = cycle === "monthly" ? plan.price_inr_monthly : plan.price_inr_yearly;
  const hasDiscount = isApplicable && discountPercent && discountPercent > 0 && !isFree;
  const finalPrice = hasDiscount
    ? Math.round(basePrice - (basePrice * discountPercent) / 100)
    : basePrice;

  const isPopular = plan.name === "pro_99" || plan.name === "standard_49";
  const features = getPlanFeatures(plan);

  return (
    <View
      style={[
        styles.planCard,
        isPopular && styles.planCardPopular,
        isCurrentPlan && styles.planCardCurrent,
      ]}
    >
      {isPopular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>POPULAR</Text>
        </View>
      )}

      {isCurrentPlan && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>CURRENT</Text>
        </View>
      )}

      <Text style={styles.planCardName}>{plan.display_name}</Text>

      <View style={styles.priceRow}>
        {hasDiscount ? (
          <>
            <Text style={styles.priceOriginal}>₹{basePrice}</Text>
            <Text style={styles.priceDiscounted}>₹{finalPrice}</Text>
          </>
        ) : (
          <Text style={styles.planCardPrice}>
            {isFree ? "Free" : `₹${basePrice}`}
          </Text>
        )}
        {!isFree && (
          <Text style={styles.planCardCycle}>
            / {cycle === "monthly" ? "mo" : "yr"}
          </Text>
        )}
      </View>

      {hasDiscount && (
        <View style={styles.discountTag}>
          <Text style={styles.discountTagText}>{discountPercent}% OFF</Text>
        </View>
      )}

      <View style={styles.featuresList}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureItem}>
            <Ionicons name="checkmark" size={14} color={Colors.success} />
            <Text style={styles.featureItemText}>{f}</Text>
          </View>
        ))}
      </View>

      {!isFree && !isCurrentPlan ? (
        <TouchableOpacity
          style={[
            styles.selectButton,
            isPopular && styles.selectButtonPopular,
            processing && styles.selectButtonDisabled,
          ]}
          onPress={onSelect}
          disabled={processing}
          activeOpacity={0.8}
        >
          {processing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.selectButtonText}>Subscribe</Text>
          )}
        </TouchableOpacity>
      ) : isCurrentPlan ? (
        <View style={styles.currentPlanIndicator}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.currentPlanText}>Your Plan</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Main Pricing Screen ─────────────────────────────────────────────────
export default function PricingScreen() {
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<ValidatePromoResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [plansData, statusData] = await Promise.all([
          getPlans(),
          getSubscriptionStatus(getToken).catch(() => null),
        ]);
        setPlans(plansData);
        if (statusData?.plan) {
          setCurrentPlan(statusData.plan.name);
        }
      } catch {
        setError("Failed to load plans.");
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim()) return;
    setPromoMessage("Validating...");
    try {
      const res = await validatePromoCode(getToken, {
        promo_code: promoCode.trim(),
      });
      setAppliedPromo(res);
      setPromoMessage(res.message);
    } catch {
      setAppliedPromo(null);
      setPromoMessage("Invalid or expired promo code.");
    }
  }, [getToken, promoCode]);

  const handleSelectPlan = useCallback(
    async (planId: string) => {
      setProcessing(true);
      setProcessingPlan(planId);
      setError("");
      try {
        const res = await createSubscription(getToken, {
          plan_id: planId,
          billing_cycle: cycle,
          return_url: "https://cortexa.doptonin.online/billing?status=success",
          promo_code: appliedPromo?.valid ? promoCode.trim() : undefined,
        });

        // Open payment link in system browser
        if (res.authorization_link) {
          await WebBrowser.openBrowserAsync(res.authorization_link);

          // After user returns, check subscription status
          try {
            const newStatus = await getSubscriptionStatus(getToken);
            if (newStatus.plan.name !== "free" && newStatus.is_active) {
              Alert.alert(
                "Success! 🎉",
                `Your ${newStatus.plan.display_name} plan is now active!`,
                [{ text: "OK", onPress: () => router.back() }]
              );
              setCurrentPlan(newStatus.plan.name);
            }
          } catch {
            // Status check failed silently
          }
        } else {
          setError("No payment link received. Please try again.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to initiate payment");
      } finally {
        setProcessing(false);
        setProcessingPlan(null);
      }
    },
    [getToken, cycle, appliedPromo, promoCode, router]
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Choose Your Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Subscription Plans</Text>
          <Text style={styles.pageSubtitle}>
            Choose the capacity for your AI assistant
          </Text>
        </View>

        {/* Cycle Toggle */}
        <View style={styles.cycleToggle}>
          <TouchableOpacity
            style={[styles.cycleBtn, cycle === "monthly" && styles.cycleBtnActive]}
            onPress={() => setCycle("monthly")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.cycleBtnText,
                cycle === "monthly" && styles.cycleBtnTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cycleBtn, cycle === "yearly" && styles.cycleBtnActive]}
            onPress={() => setCycle("yearly")}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.cycleBtnText,
                cycle === "yearly" && styles.cycleBtnTextActive,
              ]}
            >
              Yearly
            </Text>
            <View style={styles.saveTag}>
              <Text style={styles.saveTagText}>-20%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Promo Code */}
        <View style={styles.promoContainer}>
          <View style={styles.promoInputRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="Enter Promo Code"
              placeholderTextColor={Colors.textDark}
              value={promoCode}
              onChangeText={(t) => setPromoCode(t.toUpperCase())}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.promoButton}
              onPress={handleApplyPromo}
              disabled={!promoCode.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.promoButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {promoMessage ? (
            <Text
              style={[
                styles.promoMsg,
                { color: appliedPromo?.valid ? Colors.success : Colors.danger },
              ]}
            >
              {promoMessage}
            </Text>
          ) : null}
          {appliedPromo?.valid &&
            appliedPromo.applicable_plans &&
            appliedPromo.applicable_plans.length > 0 && (
              <Text style={styles.promoApplicable}>
                Valid for:{" "}
                {appliedPromo.applicable_plans
                  .map((p) => p.replace("_", " ").toUpperCase())
                  .join(", ")}
              </Text>
            )}
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Plan Cards */}
        {plans.map((plan) => {
          const isApplicable =
            !appliedPromo?.valid ||
            !appliedPromo.applicable_plans ||
            appliedPromo.applicable_plans.length === 0 ||
            appliedPromo.applicable_plans.includes(plan.name);

          return (
            <PlanCard
              key={plan.name}
              plan={plan}
              isCurrentPlan={plan.name === currentPlan}
              cycle={cycle}
              discountPercent={appliedPromo?.valid ? appliedPromo.discount_percent : undefined}
              isApplicable={isApplicable}
              onSelect={() => handleSelectPlan(plan.name)}
              processing={processingPlan === plan.name}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDeep },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Header
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

  // Title
  titleSection: { alignItems: "center", paddingVertical: Spacing.md },
  pageTitle: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: "center",
  },

  // Cycle toggle
  cycleToggle: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.bgElevated,
    overflow: "hidden",
  },
  cycleBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: 6,
  },
  cycleBtnActive: {
    backgroundColor: Colors.accent,
  },
  cycleBtnText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  cycleBtnTextActive: {
    color: "#fff",
  },
  saveTag: {
    backgroundColor: "rgba(16,185,129,0.2)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.success,
  },

  // Promo
  promoContainer: { gap: Spacing.sm },
  promoInputRow: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    backgroundColor: Colors.bgElevated,
    overflow: "hidden",
  },
  promoInput: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  promoButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: Spacing.xl,
    justifyContent: "center",
  },
  promoButtonText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  promoMsg: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    textAlign: "center",
  },
  promoApplicable: {
    fontSize: FontSize.xs,
    color: "rgba(16,185,129,0.7)",
    textAlign: "center",
  },

  // Error
  errorBanner: {
    backgroundColor: "rgba(244,63,94,0.1)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.2)",
    padding: Spacing.md,
  },
  errorText: {
    color: Colors.dangerLight,
    fontSize: FontSize.sm,
    textAlign: "center",
  },

  // Plan cards
  planCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
  planCardPopular: {
    borderColor: "rgba(99,102,241,0.4)",
    shadowColor: Colors.accent,
    shadowOpacity: 0.15,
  },
  planCardCurrent: {
    borderColor: "rgba(16,185,129,0.3)",
  },
  popularBadge: {
    position: "absolute",
    top: -1,
    right: 20,
    backgroundColor: Colors.accent,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  currentBadge: {
    position: "absolute",
    top: -1,
    right: 20,
    backgroundColor: Colors.success,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  planCardName: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: Spacing.sm,
  },
  planCardPrice: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  priceOriginal: {
    fontSize: FontSize.lg,
    fontWeight: "500",
    color: Colors.textDark,
    textDecorationLine: "line-through",
  },
  priceDiscounted: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.success,
  },
  planCardCycle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  discountTag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16,185,129,0.12)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: Spacing.sm,
  },
  discountTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.success,
  },
  featuresList: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  featureItemText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  selectButton: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  selectButtonPopular: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  selectButtonDisabled: {
    opacity: 0.6,
  },
  selectButtonText: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: "#fff",
  },
  currentPlanIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  currentPlanText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.success,
  },
});
