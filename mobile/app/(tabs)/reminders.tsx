import { useState, useEffect, useCallback } from "react";
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
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import { getReminders, deleteReminder, type ReminderRow } from "@/lib/api";

function formatReminderTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isPast = d < now;

  const timeStr = d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return isPast ? `${timeStr} (past)` : timeStr;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return Colors.warning;
    case "fired":
      return Colors.success;
    case "missed":
      return Colors.danger;
    default:
      return Colors.textMuted;
  }
}

function ReminderCard({
  item,
  onDelete,
}: {
  item: ReminderRow;
  onDelete: (id: string) => void;
}) {
  const statusColor = getStatusColor(item.status);
  const isPending = item.status === "pending";

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isPending
                ? "rgba(245,158,11,0.12)"
                : "rgba(16,185,129,0.12)",
            },
          ]}
        >
          <Ionicons
            name={isPending ? "alarm-outline" : "checkmark-circle-outline"}
            size={20}
            color={isPending ? Colors.warning : Colors.success}
          />
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTask} numberOfLines={2}>
            {item.task}
          </Text>
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.cardTime}>
              {formatReminderTime(item.reminder_time)}
            </Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.deleteBtn}
      >
        <Ionicons name="trash-outline" size={16} color={Colors.textDark} />
      </TouchableOpacity>
    </View>
  );
}

export default function RemindersScreen() {
  const { getToken, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (showLoader = true) => {
      if (!isLoaded) return;
      if (showLoader) setLoading(true);
      try {
        const items = await getReminders(getToken);
        setReminders(items);
      } catch {
        // silent
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isLoaded, getToken]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert("Delete Reminder", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReminder(getToken, id);
              setReminders((prev) => prev.filter((r) => r.id !== id));
            } catch {
              Alert.alert("Error", "Failed to delete reminder.");
            }
          },
        },
      ]);
    },
    [getToken]
  );

  const pendingCount = reminders.filter((r) => r.status === "pending").length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Reminders</Text>
        <Text style={styles.headerSubtitle}>
          {pendingCount} pending · {reminders.length} total
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={reminders}
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
            <ReminderCard item={item} onDelete={handleDelete} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⏰</Text>
              <Text style={styles.emptyTitle}>No reminders</Text>
              <Text style={styles.emptyText}>
                Tell Cortexa AI to remind you about anything, like "Remind me to call
                mom at 5pm"
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
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: { flex: 1 },
  cardTask: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  cardTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  deleteBtn: {
    padding: 8,
    marginLeft: Spacing.sm,
  },
  // States
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.lg },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: "center",
    paddingHorizontal: Spacing.xxl,
    lineHeight: 20,
  },
});
