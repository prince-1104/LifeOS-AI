import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { Colors } from "@/constants/Theme";

export default function IndexScreen() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.text}>Loading…</Text>
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)/chat" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  text: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
});
