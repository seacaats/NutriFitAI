import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { useSkeletonsShowing } from "@/shared/state/skeletonTracker";
import OfflineBanner from "@/shared/components/ui/OfflineBanner";
import { useReloadOnReconnect, useScrollToErrors, withScreenAlert } from "@/shared/components/ui/ScreenAlert";
import { canAccess, useAuth } from "@/shared/context/AuthContext";
import { usePullRefreshState } from "@/shared/context/PullRefreshContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { getChipTint } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// insets to avoid overlapping with device

// Bottom bar: two tabs either side of the menu in the middle
const TABS_LEFT = [
  { name: "Home", icon: "home", route: "/dashboard" },
  { name: "Notifications", icon: "notifications", route: "/notifications" },
];
const TABS_RIGHT = [
  { name: "Profile", icon: "person", route: "/profile" },
  { name: "Settings", icon: "settings", route: "/settings" },
];

// Everything else lives in the ☰ menu, same set as the web sidebar
// `tint`: each tile's colour (chipTints in the theme)
const MENU_ITEMS = [
  { name: "Food Scanner", icon: "camera", route: "/food-scanner", tint: "green" },
  { name: "Workouts", icon: "barbell", route: "/workouts", tint: "orange" },
  { name: "Steps", icon: "footsteps", route: "/steps", tint: "blue" },
  { name: "Water", icon: "water", route: "/water", tint: "cyan" },
  { name: "Progress", icon: "bar-chart", route: "/progress", tint: "rose" },
  { name: "AI Coach", icon: "hardware-chip", route: "/ai-coach", tint: "purple" },
];

// Small links under the grid: the landing page and the terms
const INFO_LINKS = [
  { name: "About NutriFitAI", icon: "globe-outline", route: "/?from=app" },
  { name: "Terms of Service", icon: "document-text-outline", route: "/terms" },
];

// Nested screens count too, e.g. /workouts/history lights up Workouts
const isOn = (pathname, route) => pathname === route || pathname.startsWith(`${route}/`);

// Opens the ☰ menu from inside a screen, for ScreenHeader on screens without
// the bottom bar. null outside a DashboardLayout
const MenuContext = createContext(null);
export const useOpenMenu = () => useContext(MenuContext);

// `pullToRefresh` false for screens with their own scroller and refresh
// `screenAlert` false for screens that place <ScreenAlert /> themselves
export default function DashboardLayout({ children, hideTabBar = false, scrollable = true, pullToRefresh = true, screenAlert = true }) {
  const router = useRouter();
  const pathname = usePathname();
  const { shell: c, darkMode } = useTheme();
  const { role } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const horizontalPadding = width < 360 ? 12 : width >= 768 ? 24 : 16;
  // Unread count for the Notifications tab's dot
  const { unread } = useNotifications({ limit: 1 });
  const [menuOpen, setMenuOpen] = useState(false);
  // The Modal stays mounted until the close animation ends
  const [menuMounted, setMenuMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Backdrop fades in place while only the sheet slides up, instead of the
  // whole dimmed overlay sliding in with it
  useEffect(() => {
    if (menuOpen) setMenuMounted(true);
    Animated.timing(anim, {
      toValue: menuOpen ? 1 : 0,
      duration: menuOpen ? 240 : 180,
      easing: menuOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !menuOpen) setMenuMounted(false);
    });
  }, [menuOpen, anim]);

  // Same rules as the route guards, so nobody sees a link they'd be refused on
  const menuItems = MENU_ITEMS.filter((item) => canAccess(role, item.route));
  const menuActive = menuItems.some((item) => isOn(pathname, item.route));

  // Pull down to reload whatever this screen's data hooks registered
  const pull = usePullRefreshState();
  // New error: back to the top, where the alert is
  const scrollRef = useRef(null);
  useScrollToErrors(scrollRef);

  // The screen you're already on refreshes instead of opening again
  const go = (route) => {
    setMenuOpen(false);
    if (pathname === route) {
      scrollRef.current?.scrollTo?.({ y: 0, animated: true });
      pull?.refresh();
      return;
    }
    router.push(route);
  };

  // Without the bottom bar, screens scroll to the device edge; keep the last
  // card clear of the home indicator / gesture bar
  const bottomPad = hideTabBar ? insets.bottom + 24 : 24;
  const contentStyle = [styles.content, { paddingTop: insets.top + 16, paddingBottom: bottomPad, paddingHorizontal: horizontalPadding }];

  useReloadOnReconnect();
  // No scrollbar while the screen is still skeletons
  const skeletons = useSkeletonsShowing();
  const body = screenAlert ? withScreenAlert(children) : children;
  // Always the same element: adding or removing it remounts the screen
  const refreshControl = pullToRefresh && pull
    ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.refresh} tintColor={c.primary} colors={[c.primary]} />
    : undefined;

  const content = scrollable ? (
    <ScrollView ref={scrollRef} style={styles.flex1} contentContainerStyle={contentStyle} refreshControl={refreshControl} showsVerticalScrollIndicator={!skeletons}>
      {body}
    </ScrollView>
  ) : (
    <View style={[styles.flex1, { paddingTop: insets.top + 16, paddingHorizontal: horizontalPadding }]}>
      <View style={styles.nonScrollableContent}>{body}</View>
    </View>
  );

  const tabButton = (name, icon, active, onPress, dot = false) => {
    const color = active ? c.primary : c.inactiveNavText;
    return (
      <Pressable key={name} style={styles.tabBtn} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}>
        <View>
          <Ionicons name={active ? icon : `${icon}-outline`} size={22} color={color} />
          {dot && <View style={[styles.dot, { backgroundColor: c.danger }]} />}
        </View>
        <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>{name}</Text>
      </Pressable>
    );
  };

  const renderTab = (tab) =>
    tabButton(tab.name, tab.icon, isOn(pathname, tab.route), () => go(tab.route), tab.route === "/notifications" && unread > 0);

  return (
    <MenuContext.Provider value={() => setMenuOpen(true)}>
    <View style={[styles.outer, { backgroundColor: c.shellBg }]}>
      {/* Clear of the status bar; screens pad themselves below it */}
      <OfflineBanner style={{ paddingTop: insets.top + 6 }} />
      {content}

      {/* Same background as the page, set off by a hairline, like the web shell */}
      {!hideTabBar && (
        <View style={[styles.tabBarShell, { backgroundColor: c.shellBg, borderTopColor: c.shellBorder, paddingBottom: 8 + insets.bottom }]}>
          <View style={styles.tabBar}>
            {TABS_LEFT.map(renderTab)}
            {/* Always there: the menu also holds the About and Terms links */}
            {tabButton("Menu", "menu", menuActive || menuOpen, () => setMenuOpen((o) => !o))}
            {TABS_RIGHT.map(renderTab)}
          </View>
        </View>
      )}

      {/* ☰ menu: a bottom sheet listing the rest of the app */}
      <Modal visible={menuMounted} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]}>
          <Pressable style={styles.flex1} onPress={() => setMenuOpen(false)} accessibilityLabel="Close menu" />
        </Animated.View>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: c.shellBg, borderColor: c.shellBorder, paddingBottom: 16 + insets.bottom },
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.shellBorder }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: c.sidebarText }]}>Menu</Text>
            <Pressable onPress={() => setMenuOpen(false)} hitSlop={10} accessibilityLabel="Close menu">
              <Ionicons name="close" size={22} color={c.inactiveNavText} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {menuItems.map((item) => {
              const active = isOn(pathname, item.route);
              const tint = getChipTint(item.tint, darkMode);
              return (
                <Pressable
                  key={item.route}
                  onPress={() => go(item.route)}
                  style={[
                    styles.menuItem,
                    // Tinted tile, label in its colour; the open screen's gets a coloured border
                    { backgroundColor: tint.backgroundColor, borderColor: active ? tint.icon : "transparent" },
                  ]}
                >
                  <Ionicons name={item.icon} size={22} color={tint.icon} />
                  <Text style={[styles.menuLabel, { color: tint.icon }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.infoRow, { borderTopColor: c.shellBorder }]}>
            {INFO_LINKS.map((link) => (
              <Pressable key={link.route} onPress={() => go(link.route)} hitSlop={6} style={styles.infoLink}>
                <Ionicons name={link.icon} size={15} color={c.inactiveNavText} />
                <Text style={[styles.infoText, { color: c.inactiveNavText }]}>{link.name}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Modal>
    </View>
    </MenuContext.Provider>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  flex1: { flex: 1 },
  content: { width: "100%", maxWidth: 900, alignSelf: "center", paddingBottom: 24 },
  nonScrollableContent: { flex: 1, width: "100%", maxWidth: 900, alignSelf: "center" },

  tabBarShell: {
    borderTopWidth: 1,
  },
  tabBar: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    flexDirection: "row",
    paddingTop: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 2 },
  dot: { position: "absolute", right: -3, top: -1, width: 8, height: 8, borderRadius: 4 },
  tabLabel: { fontSize: 11, fontWeight: "600" },

  backdrop: { backgroundColor: "rgba(0,0,0,0.35)" },
  // Pinned to the bottom over the fading backdrop
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  // Three per row
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  menuItem: {
    width: "31%",
    flexGrow: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 16,
    borderWidth: 1,
    borderRadius: 14,
  },
  menuLabel: { fontSize: 12, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  infoLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 12, fontWeight: "600" },
});