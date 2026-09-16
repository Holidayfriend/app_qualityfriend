"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";

type Summary = {
  dirty: number;
  cleaning: number;
  ready: number;
  inspected: number;
  expressRooms: string[];
  noServiceRooms: string[];
};

const empty: Summary = { dirty: 0, cleaning: 0, ready: 0, inspected: 0, expressRooms: [], noServiceRooms: [] };

export function HousekeepingCard() {
  const router = useRouter();
  const { dictionary } = useI18n();
  const d = dictionary.dashboard;
  const [summary, setSummary] = useState<Summary>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/housekeeping", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as Summary;
        if (!cancelled) setSummary(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const noteParts = [
    summary.expressRooms.length ? d.hkExpressRooms.replace("{rooms}", summary.expressRooms.join(", ")) : "",
    summary.noServiceRooms.length ? d.hkNoServiceRooms.replace("{rooms}", summary.noServiceRooms.join(", ")) : "",
  ].filter(Boolean);

  return (
    <div className="card">
      <div className="ch">
        <div className="ct">🧹 {dictionary.navigation.housekeeping}</div>
        <span className="ca" onClick={() => router.push("/housekeeping")}>{d.fullView} →</span>
      </div>
      <div className="cb">
        <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
          <Stat bg="var(--red-bg)" color="var(--red)" value={loaded ? summary.dirty : "–"} label={d.dirty} />
          <Stat bg="var(--amber-bg)" color="var(--amber)" value={loaded ? summary.cleaning : "–"} label={d.cleaning} />
          <Stat bg="var(--green-bg)" color="var(--green)" value={loaded ? summary.ready : "–"} label={d.ready} />
          <Stat bg="var(--blue-bg)" color="var(--blue)" value={loaded ? summary.inspected : "–"} label={d.inspected} />
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--text2)" }}>
          {loaded ? (noteParts.join(" · ") || d.hkNoteNone) : d.hkNoteNone}
        </div>
      </div>
    </div>
  );
}

function Stat({ bg, color, value, label }: { bg: string; color: string; value: number | string; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "10px", background: bg, borderRadius: "8px" }}>
      <div style={{ fontSize: "20px", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "11px", color }}>{label}</div>
    </div>
  );
}
