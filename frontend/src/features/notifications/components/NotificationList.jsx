import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { fs } from "@/shared/theme/fontScale";

// The inbox, shared by the Notifications screen (mobile and web) and the
// web header's bell. `compact` is the bell's version: a few rows, no paging

const CATEGORY_ICONS = {
  reminders: "alarm-outline",
  achievements: "trophy-outline",
  account: "shield-checkmark-outline",
};

// "5m", "3h", "2d", then a date
function ago(value) {
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// About one notification row's height plus the gap, for the skeleton count
const SKELETON_ROW_HEIGHT = 76;

export default function NotificationList({ compact = false, onNavigate }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const router = useRouter();
  const inbox = useNotifications({ limit: compact ? 5 : 30 });
  // Enough placeholder rows to fill the screen
  const { height } = useWindowDimensions();

  const open = (row) => {
    if (!row.readAt) inbox.markRead([row.id]);
    if (row.link) {
      if (onNavigate) onNavigate();
      router.push(row.link);
    }
  };

  // Same shape as the list: the count line, then rows with an icon, title and body
  if (inbox.loading) {
    return (
      <View style={styles.wrap}>
        <View style={styles.headerRow}>
          <Skeleton width={70} height={12} />
        </View>
        {Array.from({ length: compact ? 3 : Math.max(6, Math.ceil(height / SKELETON_ROW_HEIGHT)) }, (_, i) => (
          <View key={i} style={[styles.row, { borderColor: tone.border }]}>
            <Skeleton width={18} height={18} borderRadius={9} />
            <View style={styles.rowText}>
              <Skeleton width="45%" height={14} />
              <Skeleton width="80%" height={12} style={styles.skeletonLine} />
            </View>
            <Skeleton width={22} height={11} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {/* The bell's dropdown keeps quiet; the screen shows its own */}
      {!compact && <ScreenError message={inbox.error} />}
      <View style={styles.headerRow}>
        <Text style={[styles.count, { color: tone.muted }]}>
          {inbox.unread ? `${inbox.unread} unread` : "All caught up"}
        </Text>
        {inbox.unread > 0 && (
          <Pressable onPress={() => inbox.markRead()} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {inbox.rows.length === 0 ? (
        <Text style={[styles.stateText, { color: tone.muted }]}>
          Reminders, goals reached and account notices will show up here.
        </Text>
      ) : (
        inbox.rows.map((row) => (
          <Pressable
            key={row.id}
            onPress={() => open(row)}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: row.readAt ? "transparent" : tone.soft, borderColor: tone.border }]}
          >
            <Ionicons name={CATEGORY_ICONS[row.category] || "notifications-outline"} size={18} color={shellColors.primary} />
            <View style={styles.rowText}>
              <Text style={[styles.title, { color: tone.text }]}>{row.title}</Text>
              <Text style={[styles.body, { color: tone.muted }]}>{row.body}</Text>
            </View>
            <View style={styles.rowEnd}>
              <Text style={[styles.time, { color: tone.muted }]}>{ago(row.createdAt)}</Text>
              {!row.readAt && <View style={[styles.dot, { backgroundColor: colors.danger }]} />}
            </View>
          </Pressable>
        ))
      )}

      {!compact && inbox.hasMore && (
        <Pressable onPress={inbox.loadMore} style={[styles.more, { borderColor: tone.border }]}>
          <Text style={[styles.moreText, { color: tone.text }]}>Show older</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, width: "100%" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  count: { fontSize: fs(14, 12), fontWeight: "600" },
  markAll: { fontSize: fs(14, 12), fontWeight: "700", color: shellColors.primary },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: radii.sm, padding: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: fs(15, 14), fontWeight: "700" },
  body: { fontSize: fs(14, 12), lineHeight: 17 },
  rowEnd: { alignItems: "flex-end", gap: 6 },
  time: { fontSize: fs(13, 11) },
  dot: { width: 8, height: 8, borderRadius: 4 },
  more: { alignSelf: "center", borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  moreText: { fontSize: fs(14, 12), fontWeight: "700" },
  skeletonLine: { marginTop: 4 },
  stateText: { fontSize: fs(14, 13), textAlign: "center", paddingVertical: 16 },
});