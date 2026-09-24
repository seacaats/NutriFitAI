import { useLogout } from "@/features/auth/hooks/useLogout";
import AvatarImage from "@/shared/components/ui/AvatarImage";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

// `new Date().getHours()` reflects
// the browser's own timezone with no extra API needed, unlike a server-side
// computation which would have to be told the timezone explicitly
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

const MENU_ITEMS = [
  { name: "Dashboard", icon: "home-outline", route: "/dashboard", hideFromRoles: ["admin", "superadmin"] },
  { name: "Food Scanner", icon: "camera-outline", route: "/food-scanner", hideFromRoles: ["admin", "superadmin"] },
  { name: "Workouts", icon: "barbell-outline", route: "/workouts", hideFromRoles: ["admin", "superadmin"] },
  { name: "AI Coach", icon: "hardware-chip-outline", route: "/ai-coach", hideFromRoles: ["admin", "superadmin"] },
  { name: "Progress", icon: "bar-chart-outline", route: "/progress", hideFromRoles: ["admin", "superadmin"] },
  { name: "Steps", icon: "footsteps-outline", route: "/steps", hideFromRoles: ["admin", "superadmin"] },
  { name: "Profile", icon: "person-outline", route: "/profile" },

  // --- Administration -----------------------------------------------------
  // Rendered under their own heading (see `section`) rather than mixed into
  // the list above: an admin is still an ordinary user of this app most of
  // the time, and burying "Users" between "Steps" and "Profile" would make it
  // too easy to open the wrong one
  {
    name: "Users",
    icon: "people-outline",
    route: "/users",
    roles: ["admin", "superadmin"],
    section: "Administration",
  },
  {
    name: "Audit Logs",
    icon: "document-text-outline",
    route: "/audit-logs",
    roles: ["admin", "superadmin"],
    section: "Administration",
  },
  {
    name: "Admins",
    icon: "shield-checkmark-outline",
    route: "/admins",
    roles: ["superadmin"],
    section: "Administration",
  },
];

const PAGE_DESCRIPTIONS = {
  Dashboard: "Here's your overview for today.",
  "Food Scanner": "Scan your food and get personalized nutrition insights.",
  Workouts: "Stay active and reach your fitness goals.",
  "AI Coach": "Get personalized guidance from your AI fitness coach.",
  Progress: "Track your health and fitness progress.",
  Steps: "Follow your daily movement, goals, and walking streaks.",
  Profile: "Manage your personal information and preferences.",
  Users: "Review and manage the people using NutriFit AI.",
  "Audit Logs": "A record of what happened, who did it, and when.",
  Admins: "Manage who holds elevated access.",
};

export default function DashboardLayout({
  children,
  logoSource = require("@/assets/images/nutrifit-logo.png"),
  scrollable = true,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { darkMode, toggleTheme, tokens, shell: c } = useTheme();
  const { width } = useWindowDimensions();
  const { radii, spacing } = tokens;
  const styles = useMemo(() => createStyles(radii, spacing), [radii, spacing]);
  // Reads the session AuthContext already loaded for the route guards,
  // instead of issuing a second /auth/me request of its own
  const { user, firstName, initials, loading, hasRole } = useAuth();

  /**
   * Recomputed when the role changes, not on every render.
   *
   * `loading` matters here: during the initial /auth/me the role defaults to
   * "user", so rendering the admin items before it resolves would flash them
   * for an ordinary user and, worse, hide them briefly for an admin on every
   * reload. Waiting is the honest default -- the nav appears a beat later,
   * correct, rather than immediately and wrong
   */
  const visibleMenuItems = useMemo(
    () => 
      MENU_ITEMS.filter((item) => {
      if (loading) return !item.roles; //hide items when loading
      if (item.roles && !hasRole(item.roles)) return false;
      if (item.hideFromRoles && hasRole(item.hideFromRoles)) return false;
      return true;
    }),
    [loading, hasRole],
  );

  /**
   * Groups the visible items into [{ section, items }], preserving the order
   * they are declared in. Items with no `section` land in a leading unlabelled
   * group, so the seven original entries render exactly as they did before
   */
  const navGroups = useMemo(() => {
    const groups = [];
    for (const item of visibleMenuItems) {
      const section = item.section || null;
      const last = groups[groups.length - 1];
      if (last && last.section === section) last.items.push(item);
      else groups.push({ section, items: [item] });
    }
    return groups;
  }, [visibleMenuItems]);
  // Computed once per render rather than kept live-updating -- the greeting
  // only needs to be right for whenever the page happens to render, not
  // ticking over the instant the clock crosses a boundary
  const greeting = useMemo(() => getGreeting(), []);
  // A stored avatar URL can 404 (an old Google URL after the photo changed),
  // so a failed load falls back to the initials rather than a broken image
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatarUrl = !avatarFailed ? user?.avatarUrl : null;
  const logout = useLogout();

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
    logout();
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
            {navGroups.map((group) => (
              <View key={group.section || "__main"} style={styles.navGroup}>
                {/* Compact Sidebar */}
                {group.section && (isCompact
                  ? <View style={[styles.navDivider, { borderTopColor: c.dropdownBorder }]} />
                  : <Text style={[styles.navSection, { color: c.inactiveNavText }]}>{group.section}</Text>
                )}

                {group.items.map((item) => {
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
            ))}
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
        <View style={[styles.content, { backgroundColor: c.cardBg }]}>
          <View style={[styles.header, (isCompact || isMobile) && styles.headerCompact, isMobile && styles.headerMobile]}>
            <View style={[styles.headerIntro, isMobile && styles.headerIntroMobile]}>
              {isMobile && <Pressable accessibilityLabel="Open navigation" onPress={() => setShowMobileNav(true)} style={styles.menuBtn}><Ionicons name="menu" size={24} color={c.sidebarText} /></Pressable>}
              <Text numberOfLines={1} style={[styles.greeting, isMobile && styles.greetingMobile, { color: c.sidebarText }]}>
                {greeting}, {loading ? "..." : firstName} 👋
              </Text>
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
              {!isMobile && (
                <View style={styles.triggerWrap}>
                  <Pressable
                    onPress={toggleProfileMenu}
                    onHoverIn={() => setHoveredNav("__profile")}
                    onHoverOut={() => setHoveredNav(null)}
                    style={[styles.profileBtn, hoveredNav === "__profile" && { backgroundColor: c.notifHoverBg }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: c.avatarBg }]}>
                      {avatarUrl ? (
                        <AvatarImage
                          uri={avatarUrl}
                          style={styles.avatarImg}
                          contentFit="cover"
                          onError={() => setAvatarFailed(true)}
                        />
                      ) : (
                        <Text style={{ color: c.white, fontWeight: "700", fontSize: 14 }}>{initials}</Text>
                      )}
                    </View>
                    {!isCompact && !isMobile && (
                      <Text style={[styles.profileName, { color: c.sidebarText }]}>
                        {loading ? "..." : user?.fullName || "Unknown User"}
                      </Text>
                    )}
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
                </View>
              )}
            </View>
          </View>

          {/* Single shared backdrop — catches taps anywhere else in the content area */}
          {(anyMenuOpen || (isMobile && showMobileNav)) && <Pressable style={styles.backdrop} onPress={() => { closeMenus(); setShowMobileNav(false); }} />}

          {/* Page content */}
          {scrollable ? (
            <ScrollView style={[styles.main, { backgroundColor: c.rightBg }]} contentContainerStyle={[styles.mainContent, (isCompact || isMobile) && styles.mainContentCompact, isMobile && styles.mainContentMobile]}>
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.main, styles.mainNonScrollable, { backgroundColor: c.rightBg }]}>{children}</View>
          )}
        </View>
      </View>
    </View>
  );
}

function createStyles(radii, spacing) {
  return StyleSheet.create({
  outer: { flex: 1 },

  shell: { flex: 1, flexDirection: "row" },
  shellMobile: {},
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
  // gap moved onto navGroup: the nav's children are groups now, and an 8px
  // gap between GROUPS as well as between items is what separates a section
  // from the one above it without a second margin rule
  nav: { marginTop: 28, flex: 1, gap: 12, paddingHorizontal: 12 },
  navGroup: { gap: 8 },
  navSection: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", paddingHorizontal: 16, paddingTop: 8 },
  navDivider: { borderTopWidth: 1, marginVertical: 6, marginHorizontal: 8 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 12 },
  navText: { fontSize: 14, fontWeight: "600" },
  logoutBtn: { marginHorizontal: 12, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 16, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 12 },

  // Main Content
  // minHeight:0 alongside minWidth:0 -- on web a flex child defaults to
  // min-height:auto and refuses to shrink below its content, which would let
  // the column grow past the viewport again and re-break the inner scroll
  content: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: "column" },
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
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
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
  notifBody: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  dropdownRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  dropdownRowTitle: { fontSize: 14, fontWeight: "600" },
  dropdownRowSub: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  themeRow: { justifyContent: "space-between" },
  themeRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  dropdownDivider: { borderTopWidth: 1 },

  toggleTrack: { width: 36, height: 20, borderRadius: 10, justifyContent: "center" },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, marginLeft: 2 },
  toggleThumbOn: { marginLeft: 18 },

  main: { flex: 1, minHeight: 0 },

  mainNonScrollable: { flexDirection: "column" },
  // paddingTop keeps page content clear of the header (topbar) above it --
  // without it, a page's first row of content sits flush against the
  // header with no breathing room between them
  mainContent: { paddingHorizontal: 32, paddingTop: spacing.xl, paddingBottom: 32 },
  mainContentCompact: { paddingHorizontal: 20, paddingTop: spacing.lg },
  mainContentMobile: { paddingHorizontal: 16, paddingTop: spacing.lg, paddingBottom: 24 },
});
}