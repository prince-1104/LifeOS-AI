import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import {
  getTransactions,
  deleteTransaction,
  type TransactionRow,
} from "@/lib/api";

function formatInr(amount: string): string {
  const n = Number(amount);
  if (isNaN(n)) return amount;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TransactionItem({
  item,
  onDelete,
}: {
  item: TransactionRow;
  onDelete: (id: string) => void;
}) {
  const isExpense = item.type === "expense";

  return (
    <View style={styles.txCard}>
      <View style={styles.txLeft}>
        <View
          style={[
            styles.txIcon,
            { backgroundColor: isExpense ? "rgba(244,63,94,0.12)" : "rgba(16,185,129,0.12)" },
          ]}
        >
          <Ionicons
            name={isExpense ? "arrow-up" : "arrow-down"}
            size={18}
            color={isExpense ? Colors.expense : Colors.income}
          />
        </View>
        <View style={styles.txInfo}>
          <Text style={styles.txNote} numberOfLines={1}>
            {item.note || item.source || item.category || "Transaction"}
          </Text>
          <Text style={styles.txCategory}>
            {item.category || "uncategorized"} · {formatDate(item.event_time)}
          </Text>
        </View>
      </View>
      <View style={styles.txRight}>
        <Text
          style={[
            styles.txAmount,
            { color: isExpense ? Colors.expense : Colors.income },
          ]}
        >
          {isExpense ? "-" : "+"}
          {formatInr(item.amount)}
        </Text>
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.deleteBtn}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.textDark} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FinanceScreen() {
  const { getToken, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const hasDataRef = useRef(false);

  const fetchData = useCallback(
    async (showLoader = true) => {
      if (!isLoaded) return;
      if (showLoader && !hasDataRef.current) setLoading(true);
      try {
        const items = await getTransactions(getTokenRef.current);
        setTransactions(items);
        hasDataRef.current = true;
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLoaded]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Transaction", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(getToken, id);
              setTransactions((prev) => prev.filter((t) => t.id !== id));
            } catch {
              Alert.alert("Error", "Failed to delete transaction.");
            }
          },
        },
      ]);
    },
    [getToken]
  );

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Finance</Text>
        <Text style={styles.headerSubtitle}>
          {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {/* Summary strip */}
      <View style={styles.summaryStrip}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Income</Text>
          <Text style={[styles.summaryValue, { color: Colors.income }]}>
            {formatInr(String(totalIncome))}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Expense</Text>
          <Text style={[styles.summaryValue, { color: Colors.expense }]}>
            {formatInr(String(totalExpense))}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData(false);
              }}
              tintColor={Colors.accent}
            />
          }
          renderItem={({ item }) => (
            <TransactionItem item={item} onDelete={handleDelete} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💳</Text>
              <Text style={styles.emptyText}>
                No transactions yet. Tell Cortexa AI about your spending!
              </Text>
            </View>
          }
        />
      )}
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
  // Summary
  summaryStrip: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: Colors.glassBorder,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.glassBorder,
  },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    marginTop: 2,
  },
  // List
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  txCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  txLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: Spacing.md },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  txInfo: { flex: 1 },
  txNote: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  txCategory: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: "capitalize",
  },
  txRight: { alignItems: "flex-end", gap: Spacing.xs },
  txAmount: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  deleteBtn: {
    padding: 4,
  },
  // States
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.lg },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
  },
});
