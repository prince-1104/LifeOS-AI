import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { LineChart, PieChart } from "react-native-chart-kit";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import {
  getDashboard,
  type DashboardPayload,
  type ActivityItem,
} from "@/lib/api";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PERIODS = [
  { key: "day", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];

function formatInr(amount: string): string {
  const n = Number(amount);
  if (isNaN(n)) return amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

// ── Stat Card ───────────────────────────────────────────────────────────
function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

// ── Period Picker ───────────────────────────────────────────────────────
function PeriodPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.periodRow}>
      {PERIODS.map((p) => (
        <TouchableOpacity
          key={p.key}
          onPress={() => onChange(p.key)}
          style={[
            styles.periodChip,
            value === p.key && styles.periodChipActive,
          ]}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.periodText,
              value === p.key && styles.periodTextActive,
            ]}
          >
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { getToken, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  const [period, setPeriod] = useState("day");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to avoid dependency churn — getToken is unstable (new ref every render)
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const hasDataRef = useRef(false);

  // Stable fetch function — no deps that change every render
  const fetchData = useCallback(
    async (targetPeriod: string, showLoader = true) => {
      if (!isLoaded) return;
      if (showLoader && !hasDataRef.current) setLoading(true);
      if (showLoader && hasDataRef.current) setSwitching(true);
      setError(null);
      try {
        const d = await getDashboard(getTokenRef.current, targetPeriod);
        setData(d);
        hasDataRef.current = true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        setLoading(false);
        setSwitching(false);
        setRefreshing(false);
      }
    },
    [isLoaded]
  );

  // Fetch when period changes or on first load
  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData(period, false);
  }, [period, fetchData]);


  // Prepare chart data
  const lineLabels =
    data?.weekly_series.map((p) => {
      const parts = p.date.split("-");
      return `${parts[2]}/${parts[1]}`;
    }) ?? [];

  const lineValues = data?.weekly_series.map((p) => Number(p.amount)) ?? [];

  const pieData =
    data?.category_breakdown.map((c, i) => ({
      name: c.category,
      amount: Number(c.amount),
      color: Colors.chartColors[i % Colors.chartColors.length],
      legendFontColor: Colors.textMuted,
      legendFontSize: 12,
    })) ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <Text style={styles.headerSubtitle}>
          Spending and activity at a glance.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        <PeriodPicker value={period} onChange={setPeriod} />

        {loading && !data ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : error && !data ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : data ? (
          <View style={switching ? { opacity: 0.5 } : undefined}>
            {switching && (
              <View style={styles.switchingOverlay}>
                <ActivityIndicator size="small" color={Colors.accent} />
              </View>
            )}
            {/* Stat Cards */}
            <View style={styles.statsRow}>
              <StatCard
                title="Income"
                value={formatInr(data.total_income)}
                color={Colors.income}
              />
              <StatCard
                title="Spent"
                value={formatInr(data.total_spent)}
                color={Colors.expense}
              />
            </View>
            <View style={{ height: Spacing.lg }} />
            <StatCard
              title="Net Balance"
              value={
                (Number(data.net_balance) > 0 ? "+" : "") +
                formatInr(data.net_balance)
              }
              color={
                Number(data.net_balance) >= 0
                  ? Colors.balance
                  : Colors.expense
              }
            />

            {/* Line Chart */}
            {lineValues.length > 0 && (
              <View style={[styles.chartCard, { marginTop: Spacing.lg }]}>
                <Text style={styles.chartTitle}>Last 7 Days</Text>
                <LineChart
                  data={{
                    labels: lineLabels,
                    datasets: [{ data: lineValues.length > 0 ? lineValues : [0] }],
                  }}
                  width={SCREEN_WIDTH - 64}
                  height={200}
                  yAxisLabel="₹"
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: Colors.bgElevated,
                    backgroundGradientFrom: Colors.bgElevated,
                    backgroundGradientTo: Colors.bgElevated,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(99,102,241,${opacity})`,
                    labelColor: () => Colors.textMuted,
                    propsForDots: {
                      r: "4",
                      strokeWidth: "2",
                      stroke: Colors.accent,
                    },
                    propsForBackgroundLines: {
                      strokeDasharray: "5,5",
                      stroke: "rgba(255,255,255,0.06)",
                    },
                  }}
                  bezier
                  style={{ borderRadius: Radius.lg }}
                />
              </View>
            )}

            {/* Pie Chart */}
            {pieData.length > 0 && (
              <View style={[styles.chartCard, { marginTop: Spacing.lg }]}>
                <Text style={styles.chartTitle}>By Category</Text>
                <PieChart
                  data={pieData}
                  width={SCREEN_WIDTH - 64}
                  height={200}
                  chartConfig={{
                    color: () => Colors.textMuted,
                  }}
                  accessor="amount"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  hasLegend={true}
                />
              </View>
            )}

            {/* Recent Activity */}
            <View style={[styles.activityCard, { marginTop: Spacing.lg }]}>
              <Text style={styles.chartTitle}>Recent Activity</Text>
              {data.recent_activity.length === 0 ? (
                <Text style={styles.emptyText}>
                  No activity yet — chat with Cortexa AI to see history here.
                </Text>
              ) : (
                data.recent_activity.slice(0, 10).map((a, i) => (
                  <View key={`${a.created_at}-${i}`} style={styles.activityItem}>
                    <View style={styles.activityDot} />
                    <View style={styles.activityContent}>
                      <Text style={styles.activityQuery} numberOfLines={1}>
                        {a.query}
                      </Text>
                      <Text style={styles.activityType}>
                        {a.result_type.replace(/_/g, " ")}
                      </Text>
                    </View>
                    <Text style={styles.activityTime}>
                      {new Date(a.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDeep },
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
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 40 },

  // Period picker
  periodRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  periodChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center",
  },
  periodChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  periodText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  periodTextActive: {
    color: "#fff",
  },

  // Stat cards
  statsRow: { flexDirection: "row", gap: Spacing.md },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  statTitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    marginTop: Spacing.sm,
    letterSpacing: -0.5,
  },

  // Charts
  chartCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  chartTitle: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },

  // Activity
  activityCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    gap: Spacing.md,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  activityContent: { flex: 1 },
  activityQuery: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  activityType: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textTransform: "capitalize",
    marginTop: 2,
  },
  activityTime: {
    fontSize: FontSize.xs,
    color: Colors.textDark,
  },

  // States
  loadingContainer: { paddingVertical: 80 },
  switchingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: "center",
    paddingTop: 20,
  },
  errorCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.2)",
    padding: Spacing.lg,
  },
  errorText: { color: Colors.dangerLight, fontSize: FontSize.sm },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: "center",
    paddingVertical: Spacing.xl,
  },
});
