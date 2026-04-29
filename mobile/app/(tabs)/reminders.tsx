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
  getReminders,
  deleteReminder,
  markReminderDone,
  snoozeReminder,
  type ReminderRow,
} from "@/lib/api";

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
    case "done":
      return Colors.success;
    case "missed":
      return Colors.danger;
    case "snoozed":
      return Colors.info;
    default:
      return Colors.textMuted;
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "pending":
      return "alarm-outline";
    case "done":
    case "fired":
      return "checkmark-circle-outline";
    case "snoozed":
      return "time-outline";
    case "missed":
      return "alert-circle-outline";
    default:
      return "ellipse-outline";
  }
}

function ReminderCard({
  item,
  onDelete,
  onMarkDone,
  onSnooze,
}: {
  item: ReminderRow;
  onDelete: (id: string) => void;
  onMarkDone: (id: string) => void;
  onSnooze: (id: string) => void;
}) {
  const statusColor = getStatusColor(item.status);
  const isPending = item.status === "pending";
  const isDone = item.status === "done" || item.status === "fired";

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isPending
                ? "rgba(245,158,11,0.12)"
                : isDone
                ? "rgba(16,185,129,0.12)"
                : item.status === "snoozed"
                ? "rgba(14,165,233,0.12)"
                : "rgba(244,63,94,0.12)",
            },
          ]}
        >
          <Ionicons
            name={getStatusIcon(item.status) as any}
            size={20}
            color={statusColor}
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
            {item.snooze_count > 0 && (
              <Text style={styles.snoozeCount}>
                · snoozed {item.snooze_count}x
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.cardActions}>
        {isPending && (
          <>
            <TouchableOpacity
              onPress={() => onMarkDone(item.id)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={Colors.success}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSnooze(item.id)}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="time-outline"
                size={20}
                color={Colors.info}
              />
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.actionBtn}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.textDark} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RemindersScreen() {
  const { getToken, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const hasDataRef = useRef(false);

  const fetchData = useCallback(
    async (showLoader = true) => {
      if (!isLoaded) return;
      if (showLoader && !hasDataRef.current) setLoading(true);
      try {
        const items = await getReminders(getTokenRef.current);
        setReminders(items);
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

  const handleMarkDone = useCallback(
    async (id: string) => {
      try {
        await markReminderDone(getToken, id);
        setReminders((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: "done" } : r
          )
        );
      } catch {
        Alert.alert("Error", "Failed to mark reminder as done.");
      }
    },
    [getToken]
  );

  const handleSnooze = useCallback(
    async (id: string) => {
      try {
        await snoozeReminder(getToken, id);
        setReminders((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, status: "snoozed", snooze_count: (r.snooze_count || 0) + 1 }
              : r
          )
        );
      } catch {
        Alert.alert("Error", "Failed to snooze reminder.");
      }
    },
    [getToken]
  );

  // Apply both tab filter and date filter
  const filteredReminders = reminders.filter((r) => {
    // Tab filter
    if (filter === "pending" && r.status !== "pending") return false;
    if (filter === "done" && r.status !== "done" && r.status !== "fired") return false;
    // Date filter (from calendar click)
    if (selectedDate) {
      const d = new Date(r.reminder_time);
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (dateKey !== selectedDate) return false;
    }
    return true;
  });

  const pendingCount = reminders.filter((r) => r.status === "pending").length;
  const doneCount = reminders.filter(
    (r) => r.status === "done" || r.status === "fired"
  ).length;

  // ── Calendar helpers ─────────────────────────────────────────────
  const reminderDates = new Set(
    reminders.map((r) => {
      const d = new Date(r.reminder_time);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const daysInMonth = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfWeek = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth(),
    1
  ).getDay();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === calendarMonth.getFullYear() &&
    today.getMonth() === calendarMonth.getMonth();

  const monthLabel = calendarMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

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
          data={filteredReminders}
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
          ListHeaderComponent={
            <>
              {/* ── Calendar ──────────────────────────────────── */}
              <View style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                  <TouchableOpacity
                    onPress={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() - 1,
                          1
                        )
                      )
                    }
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="chevron-back"
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                  <Text style={styles.calendarMonthText}>{monthLabel}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() + 1,
                          1
                        )
                      )
                    }
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {/* Day labels */}
                <View style={styles.calendarWeekRow}>
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <Text key={d} style={styles.calendarWeekLabel}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Calendar grid */}
                <View style={styles.calendarGrid}>
                  {calendarDays.map((day, i) => {
                    if (day === null)
                      return <View key={`empty-${i}`} style={styles.calendarCell} />;

                    const dateKey = `${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-${day}`;
                    const hasReminder = reminderDates.has(dateKey);
                    const isToday = isCurrentMonth && day === today.getDate();
                    const isSelected = selectedDate === dateKey;

                    return (
                      <TouchableOpacity
                        key={`day-${day}`}
                        style={[
                          styles.calendarCell,
                          isToday && styles.calendarCellToday,
                          isSelected && styles.calendarCellSelected,
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedDate(null);
                          } else {
                            setSelectedDate(dateKey);
                          }
                        }}
                        activeOpacity={0.6}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isToday && styles.calendarDayToday,
                            isSelected && styles.calendarDaySelected,
                          ]}
                        >
                          {day}
                        </Text>
                        {hasReminder && <View style={[styles.calendarDot, isSelected && { backgroundColor: '#fff' }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Show selected date indicator */}
                {selectedDate && (
                  <TouchableOpacity
                    onPress={() => setSelectedDate(null)}
                    style={styles.clearDateBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={14} color={Colors.accent} />
                    <Text style={styles.clearDateText}>
                      Showing {selectedDate.split('-')[2]} {monthLabel.split(' ')[0]} only — tap to clear
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* ── Filter tabs ──────────────────────────────── */}
              <View style={styles.filterRow}>
                {(
                  [
                    { key: "all", label: "All", count: reminders.length },
                    { key: "pending", label: "Upcoming", count: pendingCount },
                    { key: "done", label: "Completed", count: doneCount },
                  ] as const
                ).map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[
                      styles.filterChip,
                      filter === f.key && styles.filterChipActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        filter === f.key && styles.filterTextActive,
                      ]}
                    >
                      {f.label} ({f.count})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          renderItem={({ item }) => (
            <ReminderCard
              item={item}
              onDelete={handleDelete}
              onMarkDone={handleMarkDone}
              onSnooze={handleSnooze}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>⏰</Text>
              <Text style={styles.emptyTitle}>No reminders</Text>
              <Text style={styles.emptyText}>
                Tell Cortexa AI to remind you about anything, like "Remind me to call
                mom at 5pm" or "kal subah 7 baje meeting"
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
    flexWrap: "wrap",
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
  snoozeCount: {
    fontSize: FontSize.xs,
    color: Colors.textDark,
  },

  // Actions
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: Spacing.sm,
  },
  actionBtn: {
    padding: 6,
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

  // Calendar
  calendarCard: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  calendarMonthText: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  calendarWeekRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  calendarWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: FontSize.xs,
    fontWeight: "600",
    color: Colors.textDark,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    alignItems: "center",
    paddingVertical: 6,
    position: "relative",
  },
  calendarCellToday: {
    backgroundColor: "rgba(99,102,241,0.15)",
    borderRadius: 8,
  },
  calendarCellSelected: {
    backgroundColor: Colors.accent,
    borderRadius: 8,
  },
  calendarDayText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  calendarDayToday: {
    color: Colors.accent,
    fontWeight: "700",
  },
  calendarDaySelected: {
    color: "#fff",
    fontWeight: "700",
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.accent,
    marginTop: 2,
  },
  clearDateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    paddingVertical: 6,
  },
  clearDateText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
  },

  // Filters
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    alignItems: "center",
  },
  filterChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
});
