import { onReconnect } from "@/shared/api/connection";
import { FormAlert } from "@/shared/components/ui/FormInput";
import { usePullRefreshRunner } from "@/shared/context/PullRefreshContext";
import {
    clearNetworkError,
    currentScreenError,
    dismissScreenError,
    setScreenError,
    subscribeScreenErrors,
} from "@/shared/state/screenErrors";
import { useFocusEffect, usePathname } from "expo-router";
import { Children, useCallback, useEffect, useId, useRef, useState } from "react";

// The one alert under a screen's title. DashboardLayout places it after the
// screen's first child (its title); screens whose title sits deeper place
// it themselves and pass screenAlert={false}
export function ScreenAlert({ style }) {
  const [top, setTop] = useState(currentScreenError);
  const pathname = usePathname();

  useEffect(() => subscribeScreenErrors(() => setTop(currentScreenError())), []);
  // A connection message from the last screen doesn't follow you
  useEffect(() => clearNetworkError(), [pathname]);

  if (!top) return null;
  return <FormAlert message={top.message} onDismiss={() => dismissScreenError(top.message)} style={style} />;
}

// Renders nothing: hands a card's or form's error to the screen alert.
// Drop-in for <FormAlert message onDismiss />
export function ScreenError({ message, onDismiss }) {
  const id = useId();
  // Only while its screen is in front: screens below in the stack stay
  // mounted and mustn't leak their errors onto this one
  useFocusEffect(
    useCallback(() => {
      setScreenError(id, message, onDismiss);
      return () => setScreenError(id, "");
      // onDismiss is usually an inline arrow; the message is what matters
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, message]),
  );
  return null;
}

// The screen's first child is its title (or header row); the alert goes right under it
export function withScreenAlert(children) {
  const list = Children.toArray(children);
  if (!list.length) return <ScreenAlert />;
  return [list[0], <ScreenAlert key="__screen-alert" />, ...list.slice(1)];
}

// Server back: every data hook on the focused screen reloads itself
export function useReloadOnReconnect() {
  const pull = usePullRefreshRunner();
  useEffect(() => (pull ? onReconnect(() => pull.runAll()) : undefined), [pull]);
}

// Scrolls the screen back to the top whenever a new error appears, so the
// alert under the title is seen at once. Only the focused screen moves
export function useScrollToErrors(scrollRef) {
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );
  useEffect(() => {
    let last = currentScreenError();
    return subscribeScreenErrors(() => {
      const top = currentScreenError();
      const isNew = top && (!last || top.message !== last.message || top.at !== last.at);
      last = top;
      if (isNew && focused.current) scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [scrollRef]);
}