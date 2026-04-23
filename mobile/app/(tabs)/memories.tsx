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
import { useAuth } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing, Radius, FontSize } from "@/constants/Theme";
import { getMemories, deleteMemory, type MemoryRow } from "@/lib/api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MemoryCard({
  item,
  onDelete,
}: {
  item: MemoryRow;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconWrap}>
          <Text style={styles.cardIcon}>🧠</Text>
        </View>
        <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
        <TouchableOpacity
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.textDark} />
        </TouchableOpacity>
      </View>

      <Text style={styles.cardContent}>{item.content}</Text>

      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagRow}>
          {item.tags.map((tag, i) => (
            <View key={i} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function MemoriesScreen() {
  const { getToken, isLoaded } = useAuth();
  const insets = useSafeAreaInsets();

  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(
    async (showLoader = true) => {
      if (!isLoaded) return;
      if (showLoader) setLoading(true);
      try {
        const items = await getMemories(getToken);
        setMemories(items);
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
      Alert.alert("Delete Memory", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMemory(getToken, id);
              setMemories((prev) => prev.filter((m) => m.id !== id));
            } catch {
              Alert.alert("Error", "Failed to delete memory.");
            }
          },
        },
      ]);
    },
    [getToken]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memories</Text>
        <Text style={styles.headerSubtitle}>
          {memories.length} memor{memories.length !== 1 ? "ies" : "y"} stored
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={memories}
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
            <MemoryCard item={item} onDelete={handleDelete} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🧠</Text>
              <Text style={styles.emptyTitle}>No memories yet</Text>
              <Text style={styles.emptyText}>
                Tell Cortexa AI something to remember, like "My wifi password is abc123"
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
  list: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 40 },
  // Card
  card: {
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
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(139,92,246,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardIcon: { fontSize: 16 },
  cardDate: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  cardContent: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.md,
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
