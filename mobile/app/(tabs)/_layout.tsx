import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Theme";
import { Platform } from "react-native";

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
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBg,
          borderTopColor: Colors.glassBorder,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 72,
          paddingBottom: Platform.OS === "ios" ? 28 : 12,
          paddingTop: 8,
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
