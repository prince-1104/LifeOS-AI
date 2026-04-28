import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import { processInput, type ProcessResponse, type ProcessType } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────
type ChatRow = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  assistant?: {
    success: boolean;
    type: string;
    response: string;
    data: any;
  };
  timestamp: number;
};

// ── Helpers ─────────────────────────────────────────────────────────────
function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getTypeIcon(type: string): string {
  switch (type) {
    case "finance": return "💰";
    case "memory": return "🧠";
    case "reminder": return "⏰";
    case "query": return "🔍";
    case "error": return "❌";
    default: return "💬";
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case "finance": return Colors.success;
    case "memory": return "#8b5cf6";
    case "reminder": return Colors.warning;
    case "query": return Colors.info;
    case "error": return Colors.danger;
    default: return Colors.textMuted;
  }
}

// ── Message Bubble ──────────────────────────────────────────────────────
function MessageBubble({ row }: { row: ChatRow }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (row.role === "user") {
    return (
      <Animated.View
        style={[
          styles.userBubble,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Text style={styles.userText}>{row.text}</Text>
        <Text style={styles.timeText}>{formatTime(row.timestamp)}</Text>
      </Animated.View>
    );
  }

  const a = row.assistant;
  if (!a) return null;

  return (
    <Animated.View
      style={[
        styles.assistantBubble,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.typeHeader}>
        <Text style={styles.typeIcon}>{getTypeIcon(a.type)}</Text>
        <Text style={[styles.typeLabel, { color: getTypeColor(a.type) }]}>
          {a.type.charAt(0).toUpperCase() + a.type.slice(1)}
        </Text>
      </View>
      <Text style={styles.assistantText}>{a.response}</Text>

      {/* Finance data card */}
      {a.type === "finance" && a.data && (
        <View style={styles.dataCard}>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Amount</Text>
            <Text
              style={[
                styles.dataValue,
                {
                  color:
                    a.data.transaction_type === "income"
                      ? Colors.income
                      : Colors.expense,
                },
              ]}
            >
              {a.data.transaction_type === "income" ? "+" : "-"}₹
              {a.data.amount}
            </Text>
          </View>
          {a.data.category && (
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Category</Text>
              <Text style={styles.dataValue}>{a.data.category}</Text>
            </View>
          )}
          {a.data.source && (
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Source</Text>
              <Text style={styles.dataValue}>{a.data.source}</Text>
            </View>
          )}
        </View>
      )}

      {/* Memory data card */}
      {a.type === "memory" && a.data?.tags && a.data.tags.length > 0 && (
        <View style={styles.tagContainer}>
          {a.data.tags.map((tag: string, i: number) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Reminder data card */}
      {a.type === "reminder" && a.data && (
        <View style={styles.dataCard}>
          {a.data.task && (
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Task</Text>
              <Text style={styles.dataValue}>{a.data.task}</Text>
            </View>
          )}
          {a.data.time && (
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Time</Text>
              <Text style={styles.dataValue}>{a.data.time}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.timeTextLeft}>{formatTime(row.timestamp)}</Text>
    </Animated.View>
  );
}

// ── Typing Indicator ────────────────────────────────────────────────────
function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      ).start();
    };
    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  return (
    <View style={styles.typingContainer}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.typingDot, { transform: [{ translateY: dot }] }]}
        />
      ))}
    </View>
  );
}

// ── Main Chat Screen ────────────────────────────────────────────────────
export default function ChatScreen() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<ChatRow[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    Keyboard.dismiss();
    const userMsg: ChatRow = {
      id: String(Date.now()) + "_u",
      role: "user",
      text: trimmed,
      timestamp: Date.now(),
    };
    setRows((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await processInput(getToken, {
        input: trimmed,
        userTimezone: tz,
      });
      const assistantRow: ChatRow = {
        id: String(Date.now()) + "_a",
        role: "assistant",
        assistant: {
          success: res.success,
          type: res.type,
          response: res.response,
          data: res.data,
        },
        timestamp: Date.now(),
      };
      setRows((prev) => [...prev, assistantRow]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      const errRow: ChatRow = {
        id: String(Date.now()) + "_e",
        role: "assistant",
        assistant: {
          success: false,
          type: "error",
          response: msg,
          data: null,
        },
        timestamp: Date.now(),
      };
      setRows((prev) => [...prev, errRow]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }, [input, loading, getToken]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cortexa AI</Text>
        <Text style={styles.headerSubtitle}>
          {user?.firstName ? `Hey, ${user.firstName}` : "Your day, understood."}
        </Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <MessageBubble row={item} />}
        ListEmptyComponent={null}
        ListFooterComponent={loading ? <TypingIndicator /> : null}
        onContentSizeChange={scrollToBottom}
      />

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View
          style={[
            styles.inputBar,
            { paddingBottom: Platform.OS === "ios" ? insets.bottom : Spacing.md },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask anything... Hindi bhi chalega!"
              placeholderTextColor={Colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline={false}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={send}
              disabled={!input.trim() || loading}
              style={[
                styles.sendButton,
                (!input.trim() || loading) && styles.sendButtonDisabled,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
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
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  // User bubble
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: Colors.accent,
    borderRadius: Radius.xl,
    borderBottomRightRadius: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: "80%",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  userText: {
    fontSize: FontSize.md,
    color: "#fff",
    lineHeight: 22,
  },
  timeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
    textAlign: "right",
  },
  // Assistant bubble
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderBottomLeftRadius: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  typeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  typeIcon: {
    fontSize: 14,
  },
  typeLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  assistantText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  timeTextLeft: {
    fontSize: 10,
    color: Colors.textDark,
    marginTop: 4,
  },
  // Data cards
  dataCard: {
    marginTop: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dataLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  dataValue: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  // Tags
  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.sm,
  },
  tag: {
    backgroundColor: "rgba(99,102,241,0.12)",
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.accentLight,
    fontWeight: "500",
  },
  // Typing
  typingContainer: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 4,
    marginTop: Spacing.sm,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  // Empty state
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  suggestionContainer: {
    marginTop: Spacing.xxl,
    gap: Spacing.sm,
    width: "100%",
  },
  suggestion: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  suggestionText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  // Input bar
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
    backgroundColor: "rgba(10,10,10,0.95)",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: Radius.full,
    paddingLeft: Spacing.xl,
    paddingRight: Spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
  },
  sendButton: {
    backgroundColor: Colors.accent,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
