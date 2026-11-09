"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";

export function useAiRecommendation(place: "DASHBOARD" | "HANDOVERS" | "TASKS") {
  const { locale } = useI18n();
  const [body, setBody] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    setReady(false);
    fetch(`/api/ai-recommendations?place=${place}&locale=${locale}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { body?: unknown } | null) => {
        if (!ignore) setBody(typeof data?.body === "string" ? data.body.trim() : "");
      })
      .catch(() => {
        if (!ignore) setBody("");
      })
      .finally(() => {
        if (!ignore) setReady(true);
      });
    return () => { ignore = true; };
  }, [locale, place]);

  return { body, ready };
}
