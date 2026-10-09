import { useLogout } from "@/features/auth/hooks/useLogout";
import NotificationList from "@/features/notifications/components/NotificationList";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { UntrackedSkeletons, useSkeletonsShowing } from "@/shared/state/skeletonTracker";
import AvatarImage from "@/shared/components/ui/AvatarImage";
import { useReloadOnReconnect, useScrollToErrors, withScreenAlert } from "@/shared/components/ui/ScreenAlert";
import { canAccess, useAuth } from "@/shared/context/AuthContext";
import { usePullRefreshState } from "@/shared/context/PullRefreshContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors } from "@/shared/theme/nutrifitai";
import { getGreeting } from "@/shared/utils/greeting";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const MENU_ITEMS = [
  { name: "Dashboard", icon: "home-outline", route: "/dashboard" },
  { name: "Food Scanner", icon: "camera-outline", route: "/food-scanner" },
  { name: "Workouts", icon: "barbell-outline", route: "/workouts" },
  { name: "Steps", icon: "footsteps-outline", route: "/steps" },
  { name: "Water", icon: "water-outline", route: "/water" },
  { name: "Progress", icon: "bar-chart-outline", route: "/progress" },
  { name: "AI Coach", icon: "hardware-chip-outline", route: "/ai-coach" },
  { name: "Notifications", icon: "notifications-outline", route: "/notifications" },
  { name: "Profile", icon: "person-outline", route: "/profile" },
  { name: "Settings", icon: "settings-outline", route: "/settings" },

  // --- Administration -----------------------------------------------------
  // Rendered under their own heading (see `section`) rather than mixed into
  // the list above: an admin is still an ordinary user of this app most of
  // the time, and burying "Users" between "Steps" and "Profile" would make it
  // too easy to open the wrong one
  {
    name: "Analytics",
    icon: "analytics-outline",
    route: "/analytics",
    section: "Administration",
  },
  {
    name: "Users",
    icon: "people-outline",
    route: "/users",
    section: "Administration",
  },
  {
    name: "Audit Logs",
    icon: "document-text-outline",
    route: "/audit-logs",
    section: "Administration",
  },
  {
    name: "Admins",
    icon: "shield-checkmark-outline",
    route: "/admins",
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
  Water: "Log what you drink and keep up with your daily goal.",
  Notifications: "Updates and reminders in one place.",
  Settings: "Adjust how NutriFitAI works for you.",
  Profile: "Manage your personal information and preferences.",
  Analytics: "How NutriFitAI is being used, at a glance.",
  Users: "Review and manage the people using NutriFitAI.",
  "Audit Logs": "A record of what happened, who did it, and when.",
  Admins: "Manage who holds elevated access.",
};

const RAIL_KEY = "nutrifit.navRail";

function readRailPref() {
  try {
    const saved = localStorage.getItem(RAIL_KEY);
    return saved === null ? null : saved === "true";
  } catch {
    return null;
  }
}

export default function DashboardLayout({
  children,
  logoSource = require("@/assets/images/nutrifit-logo.png"),
  scrollable = true,
  // false for screens that place <ScreenAlert /> themselves
  screenAlert = true,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { darkMode, toggleTheme, tokens, shell: c } = useTheme();
  const { width } = useWindowDimensions();
  const { radii, spacing } = tokens;
  const styles = useMemo(() => createStyles(radii, spacing), [radii, spacing]);
  // Reads the session AuthContext already loaded for the route guards,
  // instead of issuing a second /auth/me request of its own
  const { user, firstName, initials, loading, role } = useAuth();
  useReloadOnReconnect();
  // New error: back to the top, where the alert is
  const scrollRef = useRef(null);
  useScrollToErrors(scrollRef);
  // No scrollbar while the screen is still skeletons
  const skeletons = useSkeletonsShowing();
  const body = screenAlert ? withScreenAlert(children) : children;

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
      // Same rules as the route guards (ROUTE_ROLES in AuthContext.js), so the sidebar
      // never offers a screen the guard would refuse
      loading ? [] : MENU_ITEMS.filter((item) => canAccess(role, item.route)),
    [loading, role],
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
    // Admins: their own pages first, then the rest under an "Account" heading
    if (groups.length > 1 && groups.some((g) => g.section === "Administration")) {
      return [
        ...groups.filter((g) => g.section === "Administration"),
        ...groups.filter((g) => g.section !== "Administration").map((g) => ({ ...g, section: g.section || "Account" })),
      ];
    }
    return groups;
  }, [visibleMenuItems]);
  // Computed once per render rather than kept live-updating -- the greeting
  // only needs to be right for whenever the page happens to render, not
  // ticking over the instant the clock crosses a boundary
  const greeting = useMemo(() => getGreeting(), []);
  // A stored avatar URL can 404 (an old Google URL after the photo changed),
  // so a failed load falls back to the initials rather than a broken image
  // Reset per URL: a new photo (or a fresh signed R2 link) gets its own try
  const [failedUrl, setFailedUrl] = useState(null);
  const avatarUrl = user?.avatarUrl && user.avatarUrl !== failedUrl ? user.avatarUrl : null;
  const logout = useLogout();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  // Unread count for the bell's dot. The dropdown loads its own rows when opened
  const { unread } = useNotifications({ limit: 1 });
  const [hoveredNav, setHoveredNav] = useState(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const isMobile = width < 720;
  const isCompact = width >= 720 && width < 1100;
  // Hamburger choice on wider screens: true = icon rail, false = full sidebar,
  // null = follow the width. Remembered per browser
  const [railPref, setRailPref] = useState(readRailPref);
  const isRail = !isMobile && (railPref ?? isCompact);

  const toggleNav = () => {
    if (isMobile) {
      setShowMobileNav((v) => !v);
      return;
    }
    const next = !isRail;
    setRailPref(next);
    try {
      localStorage.setItem(RAIL_KEY, String(next));
    } catch {}
  };

  // Nested screens (e.g. /steps/history) belong to their parent's entry
  const currentPage = MENU_ITEMS.find((item) => pathname === item.route || pathname.startsWith(`${item.route}/`))?.name
    || "Dashboard";

  // The page you're already on reloads instead of opening again
  const pull = usePullRefreshState();
  const handleNavigation = (route) => {
    setShowProfileMenu(false);
    setShowNotifications(false);
    setShowMobileNav(false);
    if (pathname === route) {
      scrollRef.current?.scrollTo?.({ y: 0, animated: true });
      pull?.refresh();
      return;
    }
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
    <View style={[styles.outer, { backgroundColor: c.rightBg }]}>
      <View style={[styles.shell, isMobile && styles.shellMobile]}>
        {/* Sidebar: the page's own background, set off by a hairline, at every
            width. On phones it slides over the page, which dims behind it */}
        <View
          style={[
            styles.sidebar,
            isRail && styles.sidebarCompact,
            isMobile && styles.sidebarMobile,
            isMobile && !showMobileNav && styles.sidebarMobileClosed,
            { backgroundColor: c.rightBg, borderRightColor: c.shellBorder },
          ]}
        >
          <View style={[styles.logoRow, isRail && styles.logoRowCompact]}>
            <Image source={logoSource} style={styles.logoImg} contentFit="contain" />
            {!isRail && <Text style={[styles.logoText, { color: c.primary }]}>NutriFitAI</Text>}
            {/* On phones the header's ☰ sits under the open nav, so the same
                button closes it from here */}
            {isMobile && (
              <Pressable
                accessibilityLabel="Close navigation"
                onPress={() => setShowMobileNav(false)}
                onHoverIn={() => setHoveredNav("__menu_close")}
                onHoverOut={() => setHoveredNav(null)}
                style={[styles.menuBtn, styles.menuCloseBtn, hoveredNav === "__menu_close" && { backgroundColor: c.notifHoverBg }]}
              >
                <Ionicons name="menu" size={22} color={c.sidebarText} />
              </Pressable>
            )}
          </View>

          <View style={styles.nav}>
            {navGroups.map((group) => (
              <View key={group.section || "__main"} style={styles.navGroup}>
                {/* Compact Sidebar */}
                {group.section && (isRail
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
                      accessibilityLabel={item.name}
                      onHoverIn={() => setHoveredNav(item.name)}
                      onHoverOut={() => setHoveredNav(null)}
                      style={[
                        styles.navItem,
                        isRail && styles.navItemRail,
                        active
                          ? { backgroundColor: c.activeNavBg, borderLeftWidth: 2, borderLeftColor: c.primary }
                          : hovered
                          ? { backgroundColor: c.inactiveNavHoverBg }
                          : null,
                      ]}
                    >
                      <View>
                        <Ionicons name={item.icon} size={20} color={active || hovered ? c.primary : c.inactiveNavText} />
                        {/* Same unread dot as the topbar bell */}
                        {item.route === "/notifications" && unread > 0 && <View style={[styles.navDot, { backgroundColor: c.danger }]} />}
                      </View>
                      {!isRail && <Text style={[styles.navText, { color: active || hovered ? c.primary : c.inactiveNavText }]}>{item.name}</Text>}
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
            accessibilityLabel="Log Out"
            style={[styles.logoutBtn, isRail && styles.navItemRail, hoveredNav === "__logout" && { backgroundColor: c.logoutHoverBg }]}
          >
            <Ionicons name="log-out-outline" size={20} color={c.danger} />
            {!isRail && <Text style={[styles.navText, { color: c.danger }]}>Log Out</Text>}
          </Pressable>
        </View>

        {/* Main Content */}
        <View style={[styles.content, { backgroundColor: c.rightBg }]}>
          <View style={[styles.header, (isCompact || isMobile) && styles.headerCompact, isMobile && styles.headerMobile, { borderBottomColor: c.shellBorder }]}>
            <View style={styles.headerIntro}>
              {/* Always there: opens the overlay on phones, collapses to the icon rail elsewhere */}
              <Pressable
                accessibilityLabel={isMobile ? "Open navigation" : isRail ? "Expand sidebar" : "Collapse sidebar"}
                onPress={toggleNav}
                onHoverIn={() => setHoveredNav("__menu")}
                onHoverOut={() => setHoveredNav(null)}
                style={[styles.menuBtn, hoveredNav === "__menu" && { backgroundColor: c.notifHoverBg }]}
              >
                <Ionicons name="menu" size={22} color={c.sidebarText} />
              </Pressable>
              <View style={styles.headerText}>
                <Text numberOfLines={1} style={[styles.greeting, isMobile && styles.greetingMobile, { color: c.sidebarText }]}>
                  {greeting}, {loading ? "..." : firstName} 👋
                </Text>
                <Text numberOfLines={1} style={[styles.pageDesc, { color: c.headerDescText }]}>{PAGE_DESCRIPTIONS[currentPage]}</Text>
              </View>
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
                {/* Only while something is unread */}
                {unread > 0 && <View style={[styles.badgeDot, { backgroundColor: c.danger }]} />}

                {showNotifications && (
                  <View style={[styles.dropdown, styles.notifDropdown, { backgroundColor: c.dropdownBg, borderColor: c.dropdownBorder }]}>
                    <View style={styles.dropdownHeaderRow}>
                      <Text style={[styles.dropdownTitle, { color: c.sidebarText }]}>Notifications</Text>
                      <Pressable onPress={() => setShowNotifications(false)}>
                        <Ionicons name="close" size={16} color={c.sidebarText} />
                      </Pressable>
                    </View>

                    {/* Latest few, with a link to the full inbox */}
                    <View style={styles.notifList}>
                      <UntrackedSkeletons>
                        <NotificationList compact onNavigate={() => setShowNotifications(false)} />
                      </UntrackedSkeletons>
                    </View>
                    <Pressable onPress={() => handleNavigation("/notifications")} style={styles.notifSeeAll}>
                      <Text style={styles.notifSeeAllText}>See all</Text>
                    </Pressable>
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
                          onError={() => setFailedUrl(user.avatarUrl)}
                        />
                      ) : (
                        <Text style={{ color: c.white, fontWeight: "700", fontSize: 14 }}>{initials}</Text>
                      )}
                    </View>
                    {!isCompact && (
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

                      {/* The public pages, which signed-in users can still open */}
                      {[
                        { key: "__pm_home", icon: "globe-outline", title: "About NutriFitAI", route: "/" },
                        { key: "__pm_terms", icon: "document-text-outline", title: "Terms of Service", route: "/terms" },
                      ].map((link) => (
                        <Pressable
                          key={link.key}
                          onPress={() => { closeMenus(); router.push(link.route); }}
                          onHoverIn={() => setHoveredNav(link.key)}
                          onHoverOut={() => setHoveredNav(null)}
                          style={[styles.dropdownRow, hoveredNav === link.key && { backgroundColor: c.notifHoverBg }]}
                        >
                          <Ionicons name={link.icon} size={18} color={c.inactiveNavText} />
                          <Text style={[styles.dropdownRowTitle, { color: c.sidebarText }]}>{link.title}</Text>
                        </Pressable>
                      ))}

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
          {anyMenuOpen && <Pressable style={styles.backdrop} onPress={closeMenus} />}

          {/* Dims the page behind the phone nav. Always mounted on phones so it
              fades both ways; it only takes taps while the nav is open */}
          {isMobile && (
            <Pressable
              accessibilityLabel="Close navigation"
              style={[styles.backdrop, styles.backdropDim, !showMobileNav && styles.backdropDimHidden]}
              onPress={() => setShowMobileNav(false)}
            />
          )}

          {/* Page content */}
          {scrollable ? (
            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={!skeletons} style={[styles.main, { backgroundColor: c.rightBg }]} contentContainerStyle={[styles.mainContent, (isCompact || isMobile) && styles.mainContentCompact, isMobile && styles.mainContentMobile]}>
              {body}
            </ScrollView>
          ) : (
            <View style={[styles.main, styles.mainNonScrollable, { backgroundColor: c.rightBg }]}>{body}</View>
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

  // Sidebar
  sidebar: {
    width: 235,
    flexShrink: 0,
    flexDirection: "column",
    borderRightWidth: 1,
    overflow: "hidden",
    transitionProperty: "width",
    transitionDuration: "180ms",
  },
  sidebarCompact: { width: 76 },
  sidebarMobile: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 260,
    zIndex: 100,
    elevation: 100,
    // Slides in from the left, same timing as the wide-screen collapse.
    // visibility flips at the end of the slide out, so the closed nav can't
    // be tabbed into
    transform: [{ translateX: 0 }],
    transitionProperty: "transform, visibility",
    transitionDuration: "180ms",
    transitionTimingFunction: "ease-out",
  },
  sidebarMobileClosed: { transform: [{ translateX: -261 }], visibility: "hidden" },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: 20, paddingVertical: 24 },
  logoRowCompact: { justifyContent: "center", paddingHorizontal: 12 },
  // Pushed to the far right of the logo row, like the old close button
  menuCloseBtn: { marginLeft: "auto", marginRight: -8 },
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
  // Icon centred in the rail, not sat at the left padding
  navItemRail: { justifyContent: "center", paddingHorizontal: 0 },
  navText: { fontSize: 14, fontWeight: "600" },
  logoutBtn: { marginHorizontal: 12, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 16, borderRadius: radii.sm, paddingHorizontal: 16, paddingVertical: 12 },

  // Main Content
  // minHeight:0 alongside minWidth:0 -- on web a flex child defaults to
  // min-height:auto and refuses to shrink below its content, which would let
  // the column grow past the viewport again and re-break the inner scroll
  content: { flex: 1, minWidth: 0, minHeight: 0, flexDirection: "column" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderBottomWidth: 1,
    zIndex: 40,
    elevation: 40,
  },
  headerCompact: { paddingHorizontal: 20 },
  headerMobile: { paddingHorizontal: 16, paddingVertical: 12 },
  headerIntro: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  menuBtn: { borderRadius: radii.sm, padding: 8, marginLeft: -8 },
  greeting: { fontSize: 24, fontWeight: "800" },
  greetingMobile: { fontSize: 18 },
  pageDesc: { fontSize: 13, marginTop: 4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },

  // Each trigger's wrapper sits above the shared backdrop (zIndex 30), so any tap triggers the pressable
  triggerWrap: { zIndex: 60, elevation: 60 },

  iconBtn: { borderRadius: radii.pill, padding: 8 },
  navDot: { position: "absolute", right: -2, top: -1, width: 8, height: 8, borderRadius: 4 },
  badgeDot: { position: "absolute", right: 4, top: 4, width: 8, height: 8, borderRadius: 4 },

  profileBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: radii.sm, padding: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  profileName: { fontSize: 14, fontWeight: "700" },

  // Shared backdrop — covers the whole right-side content area
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 },
  backdropDim: {
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 90,
    opacity: 1,
    transitionProperty: "opacity",
    transitionDuration: "180ms",
  },
  backdropDimHidden: { opacity: 0, pointerEvents: "none" },

  dropdown: { position: "absolute", right: 0, top: 48, zIndex: 70, borderRadius: radii.md, borderWidth: 1, elevation: 70 },
  notifDropdown: { width: 288, padding: 16 },
  profileDropdown: { width: 224, overflow: "hidden" },
  dropdownHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dropdownTitle: { fontSize: 15, fontWeight: "800" },

  notifList: { marginTop: 12, maxHeight: 360, overflow: "hidden" },
  notifSeeAll: { alignSelf: "flex-end", marginTop: 8 },
  notifSeeAllText: { fontSize: 12, fontWeight: "700", color: colors.green600 },

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