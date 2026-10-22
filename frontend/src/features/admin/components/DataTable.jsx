import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

/**
 * Shared responsive table used across admin screens (web and mobile).
 *
 * Column contract:
 *   { key, title, flex?, width?, priority?, align?, render?(row) }
 *
 *   priority  1 = always shown; 2 = hidden below 1100px; 3 = hidden below 820px.
 *             Lower-priority columns are dropped at narrower widths rather than
 *             horizontally scrolled, and remain accessible via `renderExpanded`.
 *   render    returns a custom cell node; defaults to rendering row[column.key] as text.
 */

const BREAKPOINT_PRIORITY_2 = 1100;
const BREAKPOINT_PRIORITY_3 = 820;
// Below this width, rows stack vertically with each column's label beside its value
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
 * Shared empty and error state view rendered inside the table card so the
 * header row and outer border remain stable when filters change.
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

// Estimate enough skeleton rows to fill the viewport height based on row layout
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
      <ScreenError message={error} />
      {/* Keep header mounted in table mode; stacked rows render column labels inline */}
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
        // Render placeholder rows matching the active table/stacked layout
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
