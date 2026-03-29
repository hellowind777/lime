import { useEffect, useMemo, useRef, useState } from "react";
import { resolveStableProcessingProviderGroup } from "../utils/stableProcessingExperience";

interface UseStableProcessingNoticeParams {
  providerType?: string | null;
  model?: string | null;
  autoHideMs?: number;
}

export const STABLE_PROCESSING_NOTICE_AUTO_HIDE_MS = 3000;

const shownStableProcessingNoticeKeys = new Set<string>();

export function resetStableProcessingNoticeMemoryForTest() {
  shownStableProcessingNoticeKeys.clear();
}

function getStableProcessingNoticeKey({
  providerType,
  model,
}: Pick<UseStableProcessingNoticeParams, "providerType" | "model">) {
  return resolveStableProcessingProviderGroup({ providerType, model });
}

export function useStableProcessingNotice({
  providerType,
  model,
  autoHideMs = STABLE_PROCESSING_NOTICE_AUTO_HIDE_MS,
}: UseStableProcessingNoticeParams) {
  const noticeKey = useMemo(
    () => getStableProcessingNoticeKey({ providerType, model }),
    [providerType, model],
  );
  const [visible, setVisible] = useState(
    () =>
      Boolean(noticeKey) &&
      !(noticeKey ? shownStableProcessingNoticeKeys.has(noticeKey) : false),
  );
  const lastNoticeKeyRef = useRef<string | null>(noticeKey);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (!noticeKey) {
      lastNoticeKeyRef.current = null;
      setVisible(false);
      return;
    }

    if (lastNoticeKeyRef.current !== noticeKey) {
      lastNoticeKeyRef.current = noticeKey;
      setVisible(!shownStableProcessingNoticeKeys.has(noticeKey));
    }

    if (shownStableProcessingNoticeKeys.has(noticeKey)) {
      return;
    }

    shownStableProcessingNoticeKeys.add(noticeKey);
    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, autoHideMs);

    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [autoHideMs, noticeKey]);

  return visible;
}
