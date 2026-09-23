"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";

type Person = { userId: string; label: string; kind: "work" | "off" | "vac"; time: string };
type Snapshot = { onDuty: number; absent: number; people: Person[] };

const empty: Snapshot = { onDuty: 0, absent: 0, people: [] };

const chip = {
  work: { background: "var(--accent-light)", color: "var(--accent)" },
  late: { background: "var(--blue-bg)", color: "var(--blue)" },
  vac: { background: "var(--red-bg)", color: "var(--red)" },
  off: { background: "var(--amber-bg)", color: "var(--amber)" },
} as const;

function chipStyle(person: Person) {
  if (person.kind === "vac") return chip.vac;
  if (person.kind === "off") return chip.off;
  const hour = Number((person.time.match(/^(\d{2})/) || [])[1]);
  return Number.isFinite(hour) && hour >= 14 ? chip.late : chip.work;
}

export function OnDutyCard() {
  const router = useRouter();
  const { dictionary } = useI18n();
  const d = dictionary.dashboard;
  const [data, setData] = useState<Snapshot>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/on-duty", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const next = await response.json() as Snapshot;
        if (!cancelled && Array.isArray(next.people)) setData(next);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const summary = d.teamSummary.replace("{onDuty}", String(data.onDuty)).replace("{absent}", String(data.absent));

  return (
    <div className="card">
      <div className="ch"><div className="ct">📅 {d.onDuty}</div><span className="ca" onClick={() => router.push("/schedule")}>{d.roster} →</span></div>
      <div className="cb">
        <div style={{ fontSize: "13px", color: "var(--text2)", marginBottom: "8px" }}>
          {loaded ? (data.people.length ? summary : d.onDutyEmpty) : "…"}
        </div>
        {loaded && data.people.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {data.people.map((person) => {
              const style = chipStyle(person);
              const extra = person.kind === "vac" ? `🏖 ${d.vacation}` : person.kind === "off" ? d.offDuty : person.time;
              return (
                <span key={person.userId} style={{ padding: "4px 10px", background: style.background, color: style.color, borderRadius: "5px", fontSize: "12px", fontWeight: 600 }}>
                  {person.label}{extra ? ` ${extra}` : ""}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
