import { getChipTint, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Chip, SectionLabel } from "./PlanParts";

// Workout tiles (cover, body, grid) and the catalog filters

// ---- Tiles ----------------------------------------------------------------------
// Routines, Upcoming and Recent show cards in a grid like Browse, not rows
// stretched across the page. A tile grows to share its row but never past
// TILE_MAX, and phones get one full-width tile per row

const TILE_MIN = 230;
const TILE_MAX = 340;
export const COVER_HEIGHT = 128;

export function TileGrid({ children }) {
  return <View style={tileStyles.grid}>{children}</View>;
}

// `accent` swaps the border colour, e.g. amber for a missed plan
export function Tile({ children, darkMode, onPress, accent = null }) {
  const tone = getScreenTones(darkMode);
  const { width } = useWindowDimensions();
  const phone = width < 520;
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[
        tileStyles.tile,
        phone ? tileStyles.tilePhone : tileStyles.tileWide,
        { backgroundColor: tone.card, borderColor: accent || tone.border },
        accent && tileStyles.tileAccent,
      ]}
    >
      {children}
    </Wrapper>
  );
}

// Cover image. Several images (a routine's exercises) sit in a horizontal
// paging scroll, so swiping works everywhere touch does: phones, phone
// browsers, tablets. A mouse gets arrows while it's over the card, since a
// mouse can't swipe. Hover is tracked with pointer events on a plain View,
// and only counted for a mouse, so touch never shows the arrows.
// `badge` is optional
export function Cover({ images, kind, badge, heart, darkMode }) {
  const tone = getScreenTones(darkMode);
  const list = useMemo(() => [...new Set((images || []).filter(Boolean))].slice(0, 6), [images]);
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [hovered, setHovered] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    setIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [list]);

  const goTo = (i) => {
    const next = (i + list.length) % list.length;
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
  };

  const onScroll = (e) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < list.length) setIndex(i);
  };

  const tint = getChipTint(kind === "routine" ? "purple" : "green", darkMode);
  const many = list.length > 1;
  const isMouse = (e) => e?.nativeEvent?.pointerType === "mouse";

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onPointerEnter={(e) => isMouse(e) && setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={[tileStyles.cover, { backgroundColor: tone.surfaceMuted }]}
    >
      {list.length && width ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          // One photo per swipe, and a sideways drag isn't stolen by the page
          decelerationRate="fast"
          disableIntervalMomentum
          directionalLockEnabled
          nestedScrollEnabled
          style={StyleSheet.absoluteFill}
        >
          {/* The strip claims its own touches, so tapping or dragging the
              photos never reaches the card; the text below opens details.
              A sideways drag still hands over to the scroll natively */}
          <View style={tileStyles.strip} onStartShouldSetResponder={() => many}>
            {list.map((uri) => (
              <Image key={uri} source={{ uri }} style={{ width, height: COVER_HEIGHT }} contentFit="cover" cachePolicy="memory-disk" />
            ))}
          </View>
        </ScrollView>
      ) : !list.length ? (
        <Ionicons name={kind === "routine" ? "list" : "barbell"} size={34} color={tint.icon} />
      ) : null}

      {!!badge && (
        <View style={[tileStyles.kind, { backgroundColor: tint.backgroundColor }]} pointerEvents="none">
          <Ionicons name={kind === "routine" ? "list" : "barbell"} size={11} color={tint.icon} />
          <Text style={[tileStyles.kindText, { color: tint.icon }]}>{badge}</Text>
        </View>
      )}

      {heart && <View style={tileStyles.heart}>{heart}</View>}

      {many && hovered && (
        <>
          <Pressable onPress={() => goTo(index - 1)} style={[tileStyles.arrow, tileStyles.arrowLeft]} accessibilityLabel="Previous image">
            <Ionicons name="chevron-back" size={15} color="rgba(255,255,255,0.9)" />
          </Pressable>
          <Pressable onPress={() => goTo(index + 1)} style={[tileStyles.arrow, tileStyles.arrowRight]} accessibilityLabel="Next image">
            <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </>
      )}

      {many && (
        <View style={tileStyles.dots} pointerEvents="none">
          {list.map((uri, i) => (
            <View key={uri} style={[tileStyles.dot, i === index && tileStyles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

export function TileBody({ title, meta, metaColor, extra, darkMode, children }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={tileStyles.body}>
      <Text numberOfLines={1} style={[tileStyles.title, { color: tone.text }]}>{title}</Text>
      {!!meta && <Text numberOfLines={2} style={[tileStyles.meta, { color: metaColor || tone.muted }]}>{meta}</Text>}
      {extra}
      {children && <View style={tileStyles.actions}>{children}</View>}
    </View>
  );
}

// Image list for a routine (from its exercises) or a single exercise
// A catalog image that swaps to the category fallback if it fails to load
export function WorkoutImage({ uri, fallbackUri, style }) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      source={{ uri: failed ? fallbackUri : uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      priority="low"
      transition={150}
      onError={() => {
        if (!failed && fallbackUri && uri !== fallbackUri) setFailed(true);
      }}
    />
  );
}

export function coverImagesFor(item, imageOf) {
  if (item.kind === "exercise" || item.exerciseRef) return [imageOf(item.exerciseRef)];
  return (item.exercises || []).map((e) => imageOf(e.exerciseRef));
}

export const tileStyles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tile: { borderWidth: 1, borderRadius: radii.md, overflow: "hidden" },
  tileWide: { flexGrow: 1, flexBasis: TILE_MIN, minWidth: TILE_MIN, maxWidth: TILE_MAX },
  tilePhone: { width: "100%" },
  tileAccent: { borderWidth: 2 },
  cover: { height: COVER_HEIGHT, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  strip: { flexDirection: "row" },
  coverImg: { width: "100%", height: COVER_HEIGHT },
  kind: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindText: { fontSize: 10, fontWeight: "800" },
  heart: { position: "absolute", top: 6, right: 6 },
  arrow: {
    position: "absolute",
    top: COVER_HEIGHT / 2 - 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    // Light enough to sit on the photo without drawing the eye
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  arrowLeft: { left: 8 },
  arrowRight: { right: 8 },
  dots: { position: "absolute", bottom: 8, flexDirection: "row", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.55)" },
  dotActive: { backgroundColor: "#ffffff", width: 14 },
  body: { padding: 12, gap: 4, flexGrow: 1 },
  iconBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  title: { fontSize: 15, fontWeight: "800" },
  meta: { fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
});

// ---- Filters ------------------------------------------------------------------

const EQUIPMENT_MODES = [
  { key: "none", label: "No equipment" },
  { key: "any", label: "Needs equipment" },
];

// One "Filters" button instead of every option on screen. Active filters
// show as removable chips next to it, the full options only once opened.
// category: a category id or null. equipment: null | "none" | "any" | an id.
// onPreferences, when given, adds a "Preferences" button (WorkoutPrefsModal)
export function WorkoutFilters({
  categories = [],
  category,
  onCategory,
  equipment,
  onEquipment,
  equipmentList = [],
  onPreferences,
  darkMode,
}) {
  const tone = getScreenTones(darkMode);
  const [open, setOpen] = useState(false);

  const categoryName = categories.find((c) => c.id === category)?.name;
  const equipmentName = equipment === "none"
    ? "No equipment"
    : equipment === "any"
      ? "Needs equipment"
      : equipmentList.find((e) => e.id === equipment)?.name;
  const active = [
    categoryName && { key: "category", label: categoryName, clear: () => onCategory(null) },
    equipmentName && { key: "equipment", label: equipmentName, clear: () => onEquipment(null) },
  ].filter(Boolean);
  const needs = equipment === "any" || typeof equipment === "number";

  return (
    <View style={filterStyles.wrap}>
      <View style={filterStyles.bar}>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={[filterStyles.toggle, { borderColor: open || active.length ? shellColors.primary : tone.border }]}
        >
          <Ionicons name="options-outline" size={16} color={active.length ? shellColors.primary : tone.text} />
          <Text style={[filterStyles.toggleText, { color: active.length ? shellColors.primary : tone.text }]}>Filters</Text>
          {active.length > 0 && (
            <View style={filterStyles.count}>
              <Text style={filterStyles.countText}>{active.length}</Text>
            </View>
          )}
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={tone.muted} />
        </Pressable>

        {onPreferences && (
          <Pressable
            onPress={onPreferences}
            accessibilityRole="button"
            style={[filterStyles.toggle, { borderColor: tone.border }]}
          >
            <Ionicons name="heart-circle-outline" size={16} color={tone.text} />
            <Text style={[filterStyles.toggleText, { color: tone.text }]}>Preferences</Text>
          </Pressable>
        )}

        {active.map((f) => (
          <Pressable
            key={f.key}
            onPress={f.clear}
            accessibilityLabel={`Remove ${f.label} filter`}
            style={[filterStyles.activeChip, { backgroundColor: tone.soft }]}
          >
            <Text style={filterStyles.activeText}>{f.label}</Text>
            <Ionicons name="close" size={13} color={shellColors.primary} />
          </Pressable>
        ))}
        {active.length > 1 && (
          <Pressable onPress={() => { onCategory(null); onEquipment(null); }} hitSlop={6}>
            <Text style={[filterStyles.clear, { color: tone.muted }]}>Clear all</Text>
          </Pressable>
        )}
      </View>

      {open && (
        <View style={[filterStyles.panel, { backgroundColor: tone.card, borderColor: tone.border }]}>
          <SectionLabel darkMode={darkMode}>Category</SectionLabel>
          <View style={filterStyles.chips}>
            <Chip label="All" active={category == null} onPress={() => onCategory(null)} darkMode={darkMode} />
            {categories.map((c) => (
              <Chip key={c.id} label={c.name} active={category === c.id} onPress={() => onCategory(c.id)} darkMode={darkMode} />
            ))}
          </View>

          <SectionLabel darkMode={darkMode}>Equipment</SectionLabel>
          <View style={filterStyles.chips}>
            <Chip label="Any" active={equipment == null} onPress={() => onEquipment(null)} darkMode={darkMode} />
            {EQUIPMENT_MODES.map((m) => (
              <Chip
                key={m.key}
                label={m.label}
                active={m.key === "any" ? needs : equipment === m.key}
                onPress={() => onEquipment(m.key)}
                darkMode={darkMode}
              />
            ))}
          </View>

          {/* Specific pieces only once "Needs equipment" is picked */}
          {needs && equipmentList.length > 0 && (
            <View style={[filterStyles.chips, filterStyles.nested]}>
              {equipmentList.map((e) => (
                <Chip
                  key={e.id}
                  label={e.name}
                  active={equipment === e.id}
                  onPress={() => onEquipment(equipment === e.id ? "any" : e.id)}
                  darkMode={darkMode}
                />
              ))}
            </View>
          )}

        </View>
      )}
    </View>
  );
}

const filterStyles = StyleSheet.create({
  wrap: { marginBottom: 12, gap: 10 },
  bar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toggleText: { fontSize: 13, fontWeight: "700" },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: shellColors.primary },
  countText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  activeText: { fontSize: 12, fontWeight: "700", color: shellColors.primary },
  clear: { fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  panel: { borderWidth: 1, borderRadius: radii.md, padding: 14, gap: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nested: { paddingLeft: 12 },
});
