"use client";

import { useEffect, useState } from "react";

export function useLiveSummary() {
  const [summary, setSummary] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  useEffect(() => {
    const source = new EventSource("/events");

    const onMessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setSummary(payload);
        setLastUpdate(Date.now());
      } catch {
        // Ignore malformed payload.
      }
    };

    source.addEventListener("summary", onMessage);
    source.addEventListener("snapshot", onMessage);
    source.onerror = () => {};

    return () => source.close();
  }, []);

  return { summary, lastUpdate };
}

export function formatDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleTimeString("tr-TR", { hour12: false });
}
