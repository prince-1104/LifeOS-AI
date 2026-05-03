import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Dimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import { processInput, type ProcessResponse, type ProcessType } from "@/lib/api";
import { useVoice } from "@/lib/useVoice";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Floating Orbs Background ────────────────────────────────────────────
type Orb = {
  x: Animated.Value;
  y: Animated.Value;
  scale: Animated.Value;
  opacity: Animated.Value;
  size: number;
  color: string;
};

function FloatingOrbsBackground() {
  const orbsRef = useRef<Orb[]>([]);

  if (orbsRef.current.length === 0) {
    const colors = [
      "rgba(99,102,241,0.12)",  // indigo
      "rgba(139,92,246,0.10)",  // violet
      "rgba(59,130,246,0.08)",  // blue
      "rgba(168,85,247,0.09)",  // purple
      "rgba(99,102,241,0.06)",  // faint indigo
    ];
    orbsRef.current = Array.from({ length: 6 }, (_, i) => ({
      x: new Animated.Value(Math.random() * SCREEN_W),
      y: new Animated.Value(Math.random() * SCREEN_H),
      scale: new Animated.Value(0.6 + Math.random() * 0.4),
      opacity: new Animated.Value(0.3 + Math.random() * 0.4),
      size: 80 + Math.random() * 160,
      color: colors[i % colors.length],
    }));
  }

  useEffect(() => {
    const animations = orbsRef.current.map((orb) => {
      const drift = (val: Animated.Value, min: number, max: number) => {
        const to = min + Math.random() * (max - min);
        return Animated.timing(val, {
          toValue: to,
          duration: 6000 + Math.random() * 8000,
          useNativeDriver: true,
        });
      };

      const pulse = () =>
        Animated.sequence([
          Animated.timing(orb.opacity, {
            toValue: 0.15 + Math.random() * 0.35,
            duration: 3000 + Math.random() * 4000,
            useNativeDriver: true,
          }),
          Animated.timing(orb.opacity, {
            toValue: 0.1 + Math.random() * 0.2,
            duration: 3000 + Math.random() * 4000,
            useNativeDriver: true,
          }),
        ]);

      const loopDrift = () => {
        Animated.parallel([
          drift(orb.x, -orb.size * 0.5, SCREEN_W - orb.size * 0.5),
          drift(orb.y, -orb.size * 0.5, SCREEN_H - orb.size * 0.5),
          pulse(),
          Animated.timing(orb.scale, {
            toValue: 0.5 + Math.random() * 0.5,
            duration: 5000 + Math.random() * 5000,
            useNativeDriver: true,
          }),
        ]).start(() => loopDrift());
      };

      loopDrift();
      return () => {};
    });

    return () => {
      orbsRef.current.forEach((orb) => {
        orb.x.stopAnimation();
        orb.y.stopAnimation();
        orb.scale.stopAnimation();
        orb.opacity.stopAnimation();
      });
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {orbsRef.current.map((orb, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: orb.size,
            height: orb.size,
            borderRadius: orb.size / 2,
            backgroundColor: orb.color,
            transform: [
              { translateX: orb.x },
              { translateY: orb.y },
              { scale: orb.scale },
            ],
            opacity: orb.opacity,
          }}
        />
      ))}
      {/* Subtle radial gradient overlay */}
      <View
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "transparent",
          borderWidth: 0,
          // Top glow
          shadowColor: "#6366f1",
          shadowOffset: { width: 0, height: -100 },
          shadowOpacity: 0.03,
          shadowRadius: 120,
        }}
      />
    </View>
  );
}

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

// ── Typewriter Animation ────────────────────────────────────────────────
function TypewriterText({ text, style, speed = 18 }: { text: string; style?: any; speed?: number }) {
  const [displayedText, setDisplayedText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) return;
    let idx = 0;
    setDisplayedText("");
    setDone(false);
    const timer = setInterval(() => {
      idx++;
      if (idx >= text.length) {
        setDisplayedText(text);
        setDone(true);
        clearInterval(timer);
      } else {
        setDisplayedText(text.substring(0, idx));
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <Text style={style}>{done ? text : displayedText}▍</Text>;
}

// ── Message Bubble ──────────────────────────────────────────────────────
function MessageBubble({ row }: { row: ChatRow }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  // Messages created in last 2 seconds get typewriter effect
  const isNew = useRef(Date.now() - row.timestamp < 2000).current;

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
      {isNew ? (
        <TypewriterText text={a.response} style={styles.assistantText} />
      ) : (
        <Text style={styles.assistantText}>{a.response}</Text>
      )}

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
  const { voiceState, recordingDuration, startRecording, stopRecording, cancelRecording, playAudioBase64, stopPlayback } = useVoice(getToken);
  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // Auto-scroll when keyboard shows (fixes Android keyboard overlap)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, () => {
      scrollToBottom();
    });
    return () => sub.remove();
  }, [scrollToBottom]);

  // Shuffle suggestion texts on each mount/render
  const allSuggestions = [
    "☕ 30 rupees chai",
    "⏰ Kal subah 7 baje uthna hai",
    "🧠 My WiFi password is home123",
    "💰 Show today's expenses",
    "🍕 200 rupees pizza",
    "📝 Meeting at 3pm tomorrow",
    "🏠 Rent is 15000 per month",
    "🚕 Auto rickshaw 50 rupees",
    "💊 Medicine leni hai 6 baje",
    "📞 Call dentist at 11am",
    "🛒 Grocery list: milk, bread, eggs",
    "💳 Credit card bill 5000",
    "🎂 Rahul ka birthday 15 May",
    "🏋️ Gym membership 2000 rupees",
    "📚 Return library book by Friday",
  ];
  const shuffledSuggestions = useMemo(() => {
    const arr = [...allSuggestions];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 4);
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

  // ── Voice handler ──────────────────────────────────────────────────
  const handleVoicePress = useCallback(async () => {
    if (voiceState === "recording") {
      // Stop recording and process
      setLoading(true);
      const result = await stopRecording();
      if (result) {
        // Add user message (transcript)
        const userMsg: ChatRow = {
          id: String(Date.now()) + "_vu",
          role: "user",
          text: `🎙️ ${result.transcript}`,
          timestamp: Date.now(),
        };
        const assistantRow: ChatRow = {
          id: String(Date.now()) + "_va",
          role: "assistant",
          assistant: {
            success: result.success,
            type: result.type,
            response: result.response,
            data: result.data,
          },
          timestamp: Date.now(),
        };
        setRows((prev) => [...prev, userMsg, assistantRow]);
        scrollToBottom();
      } else {
        Alert.alert("Voice Error", "Could not process voice input. Please try again.");
      }
      setLoading(false);
    } else if (voiceState === "playing") {
      await stopPlayback();
    } else if (voiceState === "idle" && !loading) {
      const started = await startRecording();
      if (!started) {
        Alert.alert("Permission Needed", "Please allow microphone access to use voice input.");
      }
    }
  }, [voiceState, loading, startRecording, stopRecording, stopPlayback, scrollToBottom]);

  const handleCancelVoice = useCallback(async () => {
    await cancelRecording();
  }, [cancelRecording]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Animated background */}
        <FloatingOrbsBackground />

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
          contentContainerStyle={[
            styles.messageList,
            rows.length === 0 && { flex: 1, justifyContent: "center" },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          renderItem={({ item }) => <MessageBubble row={item} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>
                {user?.firstName ? `Hi ${user.firstName}!` : "Welcome!"}
              </Text>
              <Text style={styles.emptySubtitle}>
                Track expenses, set reminders, save memories — in English or Hindi.
              </Text>
              <View style={styles.suggestionContainer}>
                {shuffledSuggestions.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestion}
                    onPress={() => {
                      setInput(s.substring(2).trim());
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          ListFooterComponent={loading ? <TypingIndicator /> : null}
          onContentSizeChange={scrollToBottom}
        />

        {/* Voice Recording Overlay */}
        {voiceState === "recording" && (
          <View style={styles.voiceOverlay}>
            <View style={styles.voiceOverlayContent}>
              <Animated.View style={styles.voicePulseRing} />
              <View style={styles.voiceMicCircle}>
                <Ionicons name="mic" size={36} color="#fff" />
              </View>
              <Text style={styles.voiceTimer}>
                {Math.floor(recordingDuration / 60).toString().padStart(2, "0")}:
                {(recordingDuration % 60).toString().padStart(2, "0")}
              </Text>
              <Text style={styles.voiceHint}>Listening... auto-stops when you pause</Text>
              <TouchableOpacity onPress={handleCancelVoice} style={styles.voiceCancelBtn}>
                <Text style={styles.voiceCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input Bar */}
        <View
          style={[
            styles.inputBar,
            { paddingBottom: Platform.OS === "ios" ? insets.bottom : Spacing.md },
          ]}
        >
          <View style={styles.inputWrapper}>
            {/* Mic button */}
            <TouchableOpacity
              onPress={handleVoicePress}
              disabled={loading && voiceState !== "recording"}
              style={[
                styles.micButton,
                voiceState === "recording" && styles.micButtonRecording,
                voiceState === "processing" && styles.micButtonProcessing,
                voiceState === "playing" && styles.micButtonPlaying,
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={
                  voiceState === "recording" ? "stop"
                    : voiceState === "playing" ? "volume-high"
                    : voiceState === "processing" ? "hourglass"
                    : "mic"
                }
                size={20}
                color={
                  voiceState === "recording" ? "#fff"
                    : voiceState === "playing" ? Colors.accent
                    : Colors.textSecondary
                }
              />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Ask anything... Hindi bhi chalega!"
              placeholderTextColor={Colors.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={send}
              returnKeyType="send"
              multiline={false}
              editable={!loading && voiceState === "idle"}
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
      </View>
    </KeyboardAvoidingView>
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
    paddingLeft: Spacing.sm,
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
  // Voice styles
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  micButtonRecording: {
    backgroundColor: Colors.danger,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  micButtonProcessing: {
    opacity: 0.5,
  },
  micButtonPlaying: {
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  voiceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  voiceOverlayContent: {
    alignItems: "center",
    gap: Spacing.lg,
  },
  voicePulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "rgba(243,63,94,0.3)",
    top: -10,
  },
  voiceMicCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.danger,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  voiceTimer: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    color: Colors.textPrimary,
    fontVariant: ["tabular-nums"],
    marginTop: Spacing.md,
  },
  voiceHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  voiceCancelBtn: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
  },
  voiceCancelText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
});
