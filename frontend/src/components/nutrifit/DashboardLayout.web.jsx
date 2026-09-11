import { useTheme } from "@context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, usePathname } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";


const MENU_ITEMS = [
  { name: "Dashboard", icon: "home-outline", route: "/dashboard" },
  { name: "Food Scanner", icon: "camera-outline", route: "/food-scanner" },
  { name: "Workouts", icon: "barbell-outline", route: "/workouts" },
  { name: "AI Coach", icon: "hardware-chip-outline", route: "/ai-coach" },
  { name: "Progress", icon: "bar-chart-outline", route: "/progress" },
  { name: "Steps", icon: "footsteps-outline", route: "/steps" },
  { name: "Profile", icon: "person-outline", route: "/profile" },
];

const PAGE_DESCRIPTIONS = {
  Dashboard: "Here's your overview for today.",
  "Food Scanner": "Scan your food and get personalized nutrition insights.",
  Workouts: "Stay active and reach your fitness goals.",
  "AI Coach": "Get personalized guidance from your AI fitness coach.",
  Progress: "Track your health and fitness progress.",
  Steps: "Follow your daily movement, goals, and walking streaks.",
  Profile: "Manage your personal information and preferences.",
};

export default function DashboardLayout({ children, logoSource = require("@/assets/images/nutrifit-logo.png") }) {
  const router = useRouter();
  const pathname = usePathname();
  const { darkMode, toggleTheme, tokens, shell: c } = useTheme();
  const { width } = useWindowDimensions();
  const { radii, spacing } = tokens;
  const styles = useMemo(() => createStyles(radii, spacing), [radii, spacing]);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const isMobile = width < 720;
  const isCompact = width >= 720 && width < 1100;

  const currentPage = MENU_ITEMS.find((item) => item.route === pathname)?.name || "Dashboard";

  const handleNavigation = (route) => {
    setShowProfileMenu(false);
    setShowNotifications(false);
    setShowMobileNav(false);
    router.push(route);
  };

  const handleLogout = () => {
    setShowProfileMenu(false);
    router.replace("/login");
  };

  const closeMenus = () => {
    setShowProfileMenu(false);
    setShowNotifications(false);
  };

  // opening one always closes the other,
  const toggleNotifications = () => {
    setShowNotifications((v) => !v);
    setShowProfileMenu(false);
  };

  const toggleProfileMenu = () => {
    setShowProfileMenu((v) => !v);
    setShowNotifications(false);
  };

  const anyMenuOpen = showNotifications || showProfileMenu;

  return (
    <View style={[styles.outer, { backgroundColor: c.shellBg }]}>
      <View style={[styles.shell, isMobile && styles.shellMobile, { backgroundColor: c.cardBg }]}>
        {/* Sidebar */}
        <View style={[styles.sidebar, isCompact && styles.sidebarCompact, isMobile && styles.sidebarMobile, isMobile && !showMobileNav && styles.hidden, { backgroundColor: c.sidebarBg }]}>
          <View style={[styles.logoRow, isCompact && styles.logoRowCompact]}>
            <Image source={logoSource} style={styles.logoImg} contentFit="contain" />
            {!isCompact && <Text style={[styles.logoText, { color: c.primary }]}>NutriFit AI</Text>}
            {isMobile && <Pressable accessibilityLabel="Close navigation" onPress={() => setShowMobileNav(false)} style={styles.closeNavBtn}><Ionicons name="close" size={24} color={c.sidebarText} /></Pressable>}
          </View>

          <View style={styles.nav}>
            {MENU_ITEMS.map((item) => {
              const active = currentPage === item.name;
              const hovered = hoveredNav === item.name;
              return (
                <Pressable
                  key={item.name}
                  onPress={() => handleNavigation(item.route)}
                  onHoverIn={() => setHoveredNav(item.name)}
                  onHoverOut={() => setHoveredNav(null)}
                  style={[
                    styles.navItem,
                    active
                      ? { backgroundColor: c.activeNavBg, borderLeftWidth: 2, borderLeftColor: c.primary }
                      : hovered
                      ? { backgroundColor: c.inactiveNavHoverBg }
                      : null,
                  ]}
                >
                  <Ionicons name={item.icon} size={20} color={active || hovered ? c.primary : c.inactiveNavText} />
                  {!isCompact && <Text style={[styles.navText, { color: active || hovered ? c.primary : c.inactiveNavText }]}>{item.name}</Text>}
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={handleLogout}
            onHoverIn={() => setHoveredNav("__logout")}
            onHoverOut={() => setHoveredNav(null)}
            style={[styles.logoutBtn, hoveredNav === "__logout" && { backgroundColor: c.logoutHoverBg }]}
          >
            <Ionicons name="log-out-outline" size={20} color={c.danger} />
            {!isCompact && <Text style={[styles.navText, { color: c.danger }]}>Log Out</Text>}
          </Pressable>
        </View>

        {/* Main Content */}
        <View style={[styles.content, { backgroundColor: c.contentBg }]}>
          <View style={[styles.header, (isCompact || isMobile) && styles.headerCompact, isMobile && styles.headerMobile]}>
            <View style={[styles.headerIntro, isMobile && styles.headerIntroMobile]}>
              {isMobile && <Pressable accessibilityLabel="Open navigation" onPress={() => setShowMobileNav(true)} style={styles.menuBtn}><Ionicons name="menu" size={24} color={c.sidebarText} /></Pressable>}
              <Text numberOfLines={1} style={[styles.greeting, isMobile && styles.greetingMobile, { color: c.sidebarText }]}>Good Morning, John! 👋</Text>
              <Text style={[styles.pageDesc, { color: c.headerDescText }]}>{PAGE_DESCRIPTIONS[currentPage]}</Text>
            </View>

            <View style={styles.headerRight}>
              {/* Notifications */}
              <View style={styles.triggerWrap}>
                <Pressable
                  onPress={toggleNotifications}
                  onHoverIn={() => setHoveredNav("__bell")}
                  onHoverOut={() => setHoveredNav(null)}
                  style={[styles.iconBtn, hoveredNav === "__bell" && { backgroundColor: c.notifHoverBg }]}
                >
                  <Ionicons name="notifications-outline" size={22} color={c.notifIcon} />
                </Pressable>
                <View style={[styles.badgeDot, { backgroundColor: c.danger }]} />

                {showNotifications && (
                  <View style={[styles.dropdown, styles.notifDropdown, { backgroundColor: c.dropdownBg, borderColor: c.dropdownBorder }]}>
                    <View style={styles.dropdownHeaderRow}>
                      <Text style={[styles.dropdownTitle, { color: c.sidebarText }]}>Notifications</Text>
                      <Pressable onPress={() => setShowNotifications(false)}>
                        <Ionicons name="close" size={16} color={c.sidebarText} />
                      </Pressable>
                    </View>

                    <View style={[styles.notifCard, { backgroundColor: c.notifGreenCard, marginTop: 12 }]}>
                      <Text style={[styles.notifTitle, { color: c.sidebarText }]}>Great job! 🎉</Text>
                      <Text style={styles.notifBody}>You're only 2,158 steps away from your daily goal.</Text>
                    </View>

                    <View style={[styles.notifCard, { backgroundColor: c.notifBlueCard, marginTop: 8 }]}>
                      <Text style={[styles.notifTitle, { color: c.sidebarText }]}>Hydration reminder 💧</Text>
                      <Text style={styles.notifBody}>Don't forget to drink some water.</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Profile */}
              {!isMobile && <View style={styles.triggerWrap}>
                <Pressable
                  onPress={toggleProfileMenu}
                  onHoverIn={() => setHoveredNav("__profile")}
                  onHoverOut={() => setHoveredNav(null)}
                  style={[styles.profileBtn, hoveredNav === "__profile" && { backgroundColor: c.notifHoverBg }]}
                >
                  <View style={[styles.avatar, { backgroundColor: c.avatarBg }]}>
                    <Ionicons name="person" size={20} color={c.white} />
                  </View>
                  {!isCompact && !isMobile && <Text style={[styles.profileName, { color: c.sidebarText }]}>John Lim</Text>}
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={c.headerDescText}
                    style={{ transform: [{ rotate: showProfileMenu ? "180deg" : "0deg" }] }}
                  />
                </Pressable>

                {showProfileMenu && (
                  <View style={[styles.dropdown, styles.profileDropdown, { backgroundColor: c.dropdownBg, borderColor: c.dropdownBorder }]}>
                    <Pressable
                      onPress={() => handleNavigation("/profile")}
                      onHoverIn={() => setHoveredNav("__pm_profile")}
                      onHoverOut={() => setHoveredNav(null)}
                      style={[styles.dropdownRow, hoveredNav === "__pm_profile" && { backgroundColor: c.notifHoverBg }]}
                    >
                      <Ionicons name="person-outline" size={18} color={c.primary} />
                      <View>
                        <Text style={[styles.dropdownRowTitle, { color: c.sidebarText }]}>Profile</Text>
                        <Text style={styles.dropdownRowSub}>View your profile</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={toggleTheme}
                      onHoverIn={() => setHoveredNav("__pm_theme")}
                      onHoverOut={() => setHoveredNav(null)}
                      style={[styles.dropdownRow, styles.themeRow, hoveredNav === "__pm_theme" && { backgroundColor: c.notifHoverBg }]}
                    >
                      <View style={styles.themeRowLeft}>
                        <Ionicons name={darkMode ? "moon" : "sunny"} size={18} color={c.primary} />
                        <View>
                          <Text style={[styles.dropdownRowTitle, { color: c.sidebarText }]}>Theme</Text>
                          <Text style={styles.dropdownRowSub}>{darkMode ? "Dark mode" : "Light mode"}</Text>
                        </View>
                      </View>
                      <View style={[styles.toggleTrack, { backgroundColor: darkMode ? c.primary : c.toggleTrackOff }]}>
                        <View style={[styles.toggleThumb, darkMode && styles.toggleThumbOn]} />
                      </View>
                    </Pressable>

                    <View style={[styles.dropdownDivider, { borderTopColor: c.dropdownBorder }]} />

                    <Pressable
                      onPress={handleLogout}
                      onHoverIn={() => setHoveredNav("__pm_logout")}
                      onHoverOut={() => setHoveredNav(null)}
                      style={[styles.dropdownRow, hoveredNav === "__pm_logout" && { backgroundColor: c.notifHoverBg }]}
                    >
                      <Ionicons name="log-out-outline" size={18} color={c.danger} />
                      <Text style={[styles.dropdownRowTitle, { color: c.danger, fontWeight: "700" }]}>Log Out</Text>
                    </Pressable>
                  </View>
                )}
              </View>}
            </View>
          </View>

          {/* Single shared backdrop — catches taps anywhere else in the content area */}
          {(anyMenuOpen || (isMobile && showMobileNav)) && <Pressable style={styles.backdrop} onPress={() => { closeMenus(); setShowMobileNav(false); }} />}

          {/* Page content */}
          <ScrollView style={[styles.main, { backgroundColor: c.rightBg }]} contentContainerStyle={[styles.mainContent, (isCompact || isMobile) && styles.mainContentCompact, isMobile && styles.mainContentMobile]}>
            {children}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function createStyles(radii, spacing) {
  return StyleSheet.create({
  outer: { flex: 1, padding: 8 },
  shell: { flex: 1, flexDirection: "row", borderRadius: radii.sm, overflow: "hidden" },
  shellMobile: { borderRadius: 0 },
  hidden: { display: "none" },

  // Sidebar
  sidebar: { width: 235, flexShrink: 0, flexDirection: "column" },
  sidebarCompact: { width: 76 },
  sidebarMobile: { position: "absolute", left: 0, top: 0, bottom: 0, width: 260, zIndex: 100, elevation: 100 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 20, paddingVertical: 24 },
  logoRowCompact: { justifyContent: "center", paddingHorizontal: 12 },
  closeNavBtn: { marginLeft: "auto", padding: 8 },
  logoImg: { width: 40, height: 40 },
  logoText: { fontSize: 20, fontWeight: "800" },
  nav: { marginTop: 28, flex: 1, gap: 8, paddingHorizontal: 12 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 12 },
  navText: { fontSize: 14, fontWeight: "600" },
  logoutBtn: { marginHorizontal: 12, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 16, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 12 },

  // Main Content
  content: { flex: 1, minWidth: 0, flexDirection: "column" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, paddingVertical: 20, zIndex: 40, elevation: 40 },
  headerCompact: { paddingHorizontal: 20 },
  headerMobile: { paddingHorizontal: 16, paddingVertical: 14 },
  headerIntro: { flex: 1, minWidth: 0 },
  headerIntroMobile: { paddingLeft: 40 },
  menuBtn: { position: "absolute", left: 0, top: 0, padding: 4 },
  greeting: { fontSize: 24, fontWeight: "800" },
  greetingMobile: { fontSize: 18 },
  pageDesc: { fontSize: 13, marginTop: 4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },

  // Each trigger's wrapper sits above the shared backdrop (zIndex 30), so any tap triggers the pressable
  triggerWrap: { zIndex: 60, elevation: 60 },

  iconBtn: { borderRadius: radii.pill, padding: 8 },
  badgeDot: { position: "absolute", right: 4, top: 4, width: 8, height: 8, borderRadius: 4 },

  profileBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radii.sm, padding: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  profileName: { fontSize: 14, fontWeight: "700" },

  // Shared backdrop — covers the whole right-side content area
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },

  dropdown: { position: "absolute", right: 0, top: 48, zIndex: 70, borderRadius: radii.md, borderWidth: 1, elevation: 70 },
  notifDropdown: { width: 288, padding: 16 },
  profileDropdown: { width: 224, overflow: "hidden" },
  dropdownHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownTitle: { fontSize: 15, fontWeight: "800" },

  notifCard: { borderRadius: radii.sm, padding: 12 },
  notifTitle: { fontSize: 14, fontWeight: "700" },
  notifBody: { fontSize: 12, color: "#6a7282", marginTop: 4 },

  dropdownRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  dropdownRowTitle: { fontSize: 14, fontWeight: "600" },
  dropdownRowSub: { fontSize: 10, color: "#6a7282", marginTop: 1 },
  themeRow: { justifyContent: "space-between" },
  themeRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  dropdownDivider: { borderTopWidth: 1 },

  toggleTrack: { width: 36, height: 20, borderRadius: 10, justifyContent: "center" },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#fff", marginLeft: 2 },
  toggleThumbOn: { marginLeft: 18 },

  main: { flex: 1 },
  mainContent: { paddingHorizontal: 32, paddingBottom: 32 },
  mainContentCompact: { paddingHorizontal: 20 },
  mainContentMobile: { paddingHorizontal: 16, paddingBottom: 24 },
});
}
