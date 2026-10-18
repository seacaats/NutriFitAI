import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

/**
 * The table used by every admin screen.
 *
 * ONE FILE, NOT A .web.jsx / .jsx PAIR
 * ------------------------------------
 * This project splits a screen by platform when the two DESIGNS diverge
 * (profile, dashboard, steps) -- and screenStyles.js exists precisely because
 * keeping the byte-identical half of those pairs in sync by hand was painful.
 *
 * A table has no such divergence: there is no platform-specific data source
 * behind it (no HealthKit, no browser-only chart library), it is built from
 * plain React Native primitives that render identically on web, and the one
 * real difference between a 1440px monitor and a phone is how many columns
 * fit -- which is a width question, not a platform question, and is answered
 * by `priority` below. Splitting it would create exactly the duplicated pair
 * screenStyles was written to undo.
 *
 * COLUMN CONTRACT
 *   { key, title, flex?, width?, priority?, align?, render?(row) }
 *
 *   priority  1 = always shown. 2 = hidden below 1100px. 3 = hidden below
 *             820px. Columns are DROPPED rather than squeezed or
 *             horizontally scrolled: a 60px-wide email column is worse than
 *             no email column, and a phone-width table that scrolls sideways
 *             hides the fact that there is more to see.
 *   render    returns a node; without it the raw value is rendered as text.
 *
 * Anything dropped at narrow widths must also be reachable another way --
 * each caller passes `renderExpanded` for that, shown in the row's expanded
 * drawer, so a column is never the ONLY route to a value.
 */

const BREAKPOINT_PRIORITY_2 = 1100;
const BREAKPOINT_PRIORITY_3 = 820;
// Below this a row of fixed-width columns leaves the flexible one a sliver
// (the message column was ~50px at phone width), so rows stack instead:
// one line per column, its title on the left
const BREAKPOINT_STACK = 640;

function useVisibleColumns(columns) {
  const { width } = useWindowDimensions();
  return columns.filter((column) => {
    const priority = column.priority || 1;
    if (priority >= 3 && width < BREAKPOINT_PRIORITY_3) return false;
    if (priority >= 2 && width < BREAKPOINT_PRIORITY_2) return false;
    return true;
  });
}

/**
 * Empty and error are ONE component with two modes rather than
 * two call sites' worth of conditional JSX, because a table in any of those
 * states must keep its header row and its outer card -- otherwise the layout
 * jumps every time a filter changes, which reads as a broken page
 */
function TableState({ tone, icon, title, body, action }) {
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.stateIcon, { backgroundColor: tone.soft }]}>
        <Ionicons name={icon} size={22} color={tone.muted} />
      </View>
      <Text style={[styles.stateTitle, { color: tone.text }]}>{title}</Text>
      {body ? <Text style={[styles.stateBody, { color: tone.muted }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

// Placeholder rows shown while a page loads
// Placeholder rows: enough to fill the window, from about how tall a row
// is (a stacked row holds several lines)
const ROW_HEIGHT = 46;
const STACK_ROW_HEIGHT = 110;
const skeletonRows = (height, stacked) => Math.max(6, Math.ceil(height / (stacked ? STACK_ROW_HEIGHT : ROW_HEIGHT)));

export default function DataTable({
  columns,
  rows,
  keyExtractor,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = "Nothing to show",
  emptyBody,
  expandedRowId = null,
  onToggleRow,
  renderExpanded,
}) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  const visible = useVisibleColumns(columns);
  const expandable = typeof renderExpanded === "function";
  const { width, height } = useWindowDimensions();
  const stacked = width < BREAKPOINT_STACK;

  const cellStyle = (column) =>
    column.width
      ? { width: column.width, flexGrow: 0, flexShrink: 0 }
      : { flex: column.flex || 1, minWidth: 0 };

  return (
    <View style={[styles.card, { backgroundColor: tone.card, borderColor: tone.border }]}>
      {/* The reason goes in the screen alert, under the page title */}
      <ScreenError message={error} />
      {/* The header stays mounted in every state. Stacked rows carry their
          own titles, so it goes there */}
      {!stacked && (
        <View style={[styles.headerRow, { borderBottomColor: tone.border, backgroundColor: tone.soft }]}>
          {visible.map((column) => (
            <Text
              key={column.key}
              numberOfLines={1}
              style={[styles.headerCell, cellStyle(column), column.align === "right" && styles.alignRight, { color: tone.muted }]}
            >
              {column.title}
            </Text>
          ))}
          {expandable && <View style={styles.chevronCell} />}
        </View>
      )}

      {loading ? (
        // Placeholder rows in the table's own shape, so nothing jumps when it fills in
        Array.from({ length: skeletonRows(height, stacked) }, (_, index) => (
          <View
            key={index}
            style={[stacked ? styles.stackRow : styles.bodyRow, index > 0 && { borderTopWidth: 1, borderTopColor: tone.border }]}
          >
            {stacked ? (
              <View style={styles.stackCells}>
                {visible.map((column) => (
                  <View key={column.key} style={styles.stackLine}>
                    <Text numberOfLines={1} style={[styles.stackTitle, { color: tone.muted }]}>{column.title}</Text>
                    <View style={styles.stackValue}><Skeleton width="60%" height={12} /></View>
                  </View>
                ))}
              </View>
            ) : (
              visible.map((column) => (
                <View key={column.key} style={[cellStyle(column), column.align === "right" && styles.alignRight]}>
                  <Skeleton width="70%" height={12} />
                </View>
              ))
            )}
            {expandable && <View style={styles.chevronCell} />}
          </View>
        ))
      ) : error ? (
        <TableState
          tone={tone}
          icon="alert-circle-outline"
          title="Couldn't load this"
          action={
            onRetry ? (
              <Pressable onPress={onRetry} style={styles.retryBtn}>
                <Ionicons name="refresh" size={15} color={shellColors.primary} />
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            ) : null
          }
        />
      ) : rows.length === 0 ? (
        <TableState tone={tone} icon="file-tray-outline" title={emptyTitle} body={emptyBody} />
      ) : (
        rows.map((row, index) => {
          const id = keyExtractor(row, index);
          const expanded = expandable && expandedRowId === id;

          const renderCell = (column) =>
            column.render ? (
              column.render(row)
            ) : (
              <Text numberOfLines={1} style={[styles.bodyCell, { color: tone.text }]}>
                {row[column.key] ?? "—"}
              </Text>
            );

          const body = stacked ? (
            <View style={[styles.stackRow, index > 0 && { borderTopWidth: 1, borderTopColor: tone.border }]}>
              <View style={styles.stackCells}>
                {visible.map((column) => (
                  <View key={column.key} style={styles.stackLine}>
                    <Text numberOfLines={1} style={[styles.stackTitle, { color: tone.muted }]}>{column.title}</Text>
                    <View style={styles.stackValue}>{renderCell(column)}</View>
                  </View>
                ))}
              </View>
              {expandable && (
                <View style={styles.chevronCell}>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={tone.muted} />
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.bodyRow, index > 0 && { borderTopWidth: 1, borderTopColor: tone.border }]}>
              {visible.map((column) => (
                <View key={column.key} style={[cellStyle(column), column.align === "right" && styles.alignRight]}>
                  {renderCell(column)}
                </View>
              ))}
              {expandable && (
                <View style={styles.chevronCell}>
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={16}
                    color={tone.muted}
                  />
                </View>
              )}
            </View>
          );

          return (
            <View key={id}>
              {expandable ? (
                <Pressable
                  onPress={() => onToggleRow && onToggleRow(expanded ? null : id)}
                  // accessibilityRole/State so the drawer is operable and
                  // announced by a screen reader -- a chevron that only means
                  // something visually is not an affordance
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={expanded ? "Collapse details" : "Expand details"}
                >
                  {body}
                </Pressable>
              ) : (
                body
              )}

              {expanded && (
                <View style={[styles.expanded, { backgroundColor: tone.soft, borderTopColor: tone.border }]}>
                  {renderExpanded(row)}
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radii.md, overflow: "hidden" },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  headerCell: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },

  bodyRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  bodyCell: { fontSize: 13 },
  alignRight: { alignItems: "flex-end", textAlign: "right" },
  chevronCell: { width: 20, alignItems: "flex-end" },

  stackRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  stackCells: { flex: 1, minWidth: 0, gap: 6 },
  stackLine: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stackTitle: { width: 84, fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase", paddingTop: 2 },
  stackValue: { flex: 1, minWidth: 0 },

  expanded: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },

  stateWrap: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  stateIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  stateTitle: { fontSize: 14, fontWeight: "700" },
  stateBody: { fontSize: 12, textAlign: "center", maxWidth: 360, lineHeight: 18 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  retryText: { fontSize: 13, fontWeight: "700", color: shellColors.primary },

});