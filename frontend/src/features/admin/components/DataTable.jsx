import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

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

export function useVisibleColumns(columns) {
  const { width } = useWindowDimensions();
  return columns.filter((column) => {
    const priority = column.priority || 1;
    if (priority >= 3 && width < BREAKPOINT_PRIORITY_3) return false;
    if (priority >= 2 && width < BREAKPOINT_PRIORITY_2) return false;
    return true;
  });
}

/**
 * Empty, loading and error are ONE component with three modes rather than
 * three call sites' worth of conditional JSX, because a table in any of those
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

  const cellStyle = (column) =>
    column.width
      ? { width: column.width, flexGrow: 0, flexShrink: 0 }
      : { flex: column.flex || 1, minWidth: 0 };

  return (
    <View style={[styles.card, { backgroundColor: tone.card, borderColor: tone.border }]}>
      {/* The header stays mounted in every state */}
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

      {loading ? (
        <TableState tone={tone} icon="hourglass-outline" title="Loading…" />
      ) : error ? (
        <TableState
          tone={tone}
          icon="alert-circle-outline"
          title="Couldn't load this"
          body={error}
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

          const body = (
            <View style={[styles.bodyRow, index > 0 && { borderTopWidth: 1, borderTopColor: tone.border }]}>
              {visible.map((column) => (
                <View key={column.key} style={[cellStyle(column), column.align === "right" && styles.alignRight]}>
                  {column.render ? (
                    column.render(row)
                  ) : (
                    <Text numberOfLines={1} style={[styles.bodyCell, { color: tone.text }]}>
                      {row[column.key] ?? "—"}
                    </Text>
                  )}
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

/**
 * Label/value pairs for a row's expanded drawer. Wraps rather than scrolls
 */
export function DetailGrid({ items }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);

  return (
    <View style={styles.detailGrid}>
      {items
        .filter((item) => item && item.value !== undefined && item.value !== null && item.value !== "")
        .map((item) => (
          <View key={item.label} style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: tone.muted }]}>{item.label}</Text>
            {/* selectable so an id or an IP can be copied out of the drawer --
                the single most common thing anyone does with either. */}
            <Text selectable style={[styles.detailValue, { color: tone.text }]}>{item.value}</Text>
          </View>
        ))}
    </View>
  );
}

/** Page picker. Hidden entirely at one page */
export function Pager({ page, pageCount, total, onChange, unit = "rows" }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);
  if (pageCount <= 1) return null;

  const Btn = ({ icon, disabled, onPress, label }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[styles.pagerBtn, { borderColor: tone.border }, disabled && styles.pagerBtnDisabled]}
    >
      <Ionicons name={icon} size={16} color={disabled ? tone.muted : tone.text} />
    </Pressable>
  );

  return (
    <View style={styles.pager}>
      <Text style={[styles.pagerText, { color: tone.muted }]}>
        Page {page} of {pageCount} · {total} {unit}
      </Text>
      <View style={styles.pagerBtns}>
        <Btn icon="chevron-back" label="Previous page" disabled={page <= 1} onPress={() => onChange(page - 1)} />
        <Btn icon="chevron-forward" label="Next page" disabled={page >= pageCount} onPress={() => onChange(page + 1)} />
      </View>
    </View>
  );
}

/** Horizontally scrollable filter pills. */
export function FilterRow({ options, value, onChange }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable
            key={option.value ?? "__all"}
            onPress={() => onChange(option.value)}
            style={[
              styles.filterPill,
              { borderColor: tone.border, backgroundColor: tone.card },
              active && { backgroundColor: shellColors.primary, borderColor: shellColors.primary },
            ]}
          >
            <Text style={[styles.filterText, { color: active ? colors.white : tone.muted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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

  expanded: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  detailItem: { minWidth: 160, gap: 2 },
  detailLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  detailValue: { fontSize: 13 },

  stateWrap: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
  stateIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  stateTitle: { fontSize: 14, fontWeight: "700" },
  stateBody: { fontSize: 12, textAlign: "center", maxWidth: 360, lineHeight: 18 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  retryText: { fontSize: 13, fontWeight: "700", color: shellColors.primary },

  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, flexWrap: "wrap" },
  pagerText: { fontSize: 12 },
  pagerBtns: { flexDirection: "row", gap: 8 },
  pagerBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 8 },
  pagerBtnDisabled: { opacity: 0.4 },

  filterRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  filterPill: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 7 },
  filterText: { fontSize: 12, fontWeight: "700" },
});
