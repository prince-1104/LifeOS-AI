import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Theme";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const tabs: {
  name: string;
  title: string;
  icon: IoniconsName;
  iconOutline: IoniconsName;
}[] = [
  { name: "chat", title: "Chat", icon: "chatbubble-ellipses", iconOutline: "chatbubble-ellipses-outline" },
  { name: "dashboard", title: "Dashboard", icon: "grid", iconOutline: "grid-outline" },
  { name: "finance", title: "Finance", icon: "wallet", iconOutline: "wallet-outline" },
  { name: "reminders", title: "Reminders", icon: "alarm", iconOutline: "alarm-outline" },
  { name: "profile", title: "Profile", icon: "person-circle", iconOutline: "person-circle-outline" },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // On Android, insets.bottom accounts for the system nav bar (gesture bar / 3-button nav)
  const bottomPad = Platform.OS === "ios" ? Math.max(insets.bottom, 16) : Math.max(insets.bottom, 6);
  const tabBarHeight = Platform.OS === "ios" ? 56 + bottomPad : 56 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBg,
          borderTopColor: Colors.glassBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomPad,
          paddingTop: 6,
          elevation: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
        },
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
        },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.icon : tab.iconOutline}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
      {/* Hide the old memories tab file if it still exists */}
      <Tabs.Screen
        name="memories"
        options={{
          href: null, // hide from tab bar
        }}
      />
    </Tabs>
  );
}
