import { fetchExerciseInfo, getEnglishTranslation, getExerciseImages, getMuscleNames } from "@/features/workouts/hooks/useWorkoutApi";
import Skeleton from "@/shared/components/Skeleton";
import SheetModal from "@/shared/components/ui/SheetModal";
import { useHeldWhileClosing } from "@/shared/hooks/useHeldWhileClosing";
import { fs } from "@/shared/theme/fontScale";
import { getScreenTones, radii } from "@/shared/theme/nutrifitai";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import SectionLabel from "./SectionLabel";

// Read-only catalog details sheet for an exercise: image, category, muscles, instructions.

export default function ExerciseInfoSheet({ visible, exerciseRef, name, subtitle, onClose, darkMode }) {
  const tone = getScreenTones(darkMode);
  // Preserves content during modal exit transition
  const held = useHeldWhileClosing(visible, { exerciseRef, name, subtitle });
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !exerciseRef) return undefined;
    let live = true;
    // Abort request if modal is closed before fetch completes
    const abort = new AbortController();
    setLoading(true);
    setInfo(null);
    fetchExerciseInfo(exerciseRef, { signal: abort.signal })
      .then((data) => live && setInfo(data))
      .catch(() => live && setInfo(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
      abort.abort();
    };
  }, [visible, exerciseRef]);

  if (!held) return null;
  const image = info ? getExerciseImages(info)[0] : null;
  const muscles = info ? getMuscleNames(info) : [];
  const description = info ? getEnglishTranslation(info).description.replace(/<[^>]*>/g, "").trim() : "";

  return (
    <SheetModal visible={visible} onClose={onClose} darkMode={darkMode} title={held.name} subtitle={held.subtitle}>
      {loading ? (
        <>
          <Skeleton width="100%" height={180} borderRadius={radii.md} />
          <Skeleton width="30%" height={13} />
          <Skeleton width={70} height={11} />
          <Skeleton width="60%" height={13} />
          <Skeleton width={60} height={11} />
          <Skeleton width="100%" height={13} />
          <Skeleton width="90%" height={13} />
          <Skeleton width={70} height={13} />
        </>
      ) : image ? <Image source={{ uri: image }} style={styles.hero} contentFit="cover" /> : null}
      {!!info?.category?.name && <Text style={[styles.text, { color: tone.muted }]}>{info.category.name}</Text>}
      {muscles.length > 0 && (
        <>
          <SectionLabel darkMode={darkMode}>Muscles</SectionLabel>
          <Text style={[styles.text, { color: tone.text }]}>{muscles.join(", ")}</Text>
        </>
      )}
      {!!description && (
        <>
          <SectionLabel darkMode={darkMode}>How to</SectionLabel>
          <Text style={[styles.text, { color: tone.muted }]}>{description}</Text>
        </>
      )}
      {!loading && !info && <Text style={[styles.text, { color: tone.muted }]}>Details aren't available right now.</Text>}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", height: 180, borderRadius: radii.md },
  text: { fontSize: fs(14, 13), lineHeight: 19 },
});
