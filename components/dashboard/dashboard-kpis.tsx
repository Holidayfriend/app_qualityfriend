"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";

type Snapshot = {
  occupancy: number;
  occupancyDelta: number;
  arrivals: number;
  departures: number;
  roomsReady: number;
  roomsDue: number;
  roomsOpen: number;
  expressRooms: string[];
};

const empty: Snapshot = {
  occupancy: 0,
  occupancyDelta: 0,
  arrivals: 0,
  departures: 0,
  roomsReady: 0,
  roomsDue: 0,
  roomsOpen: 0,
  expressRooms: [],
};

export function DashboardKpis() {
  const { dictionary } = useI18n();
  const d = dictionary.dashboard;
  const [data, setData] = useState<Snapshot>(empty);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/housekeeping", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const next = await response.json() as Partial<Snapshot>;
        if (cancelled) return;
        setData({
          occupancy: Number.isFinite(Number(next.occupancy)) ? Number(next.occupancy) : 0,
          occupancyDelta: Number.isFinite(Number(next.occupancyDelta)) ? Number(next.occupancyDelta) : 0,
          arrivals: Number(next.arrivals) || 0,
          departures: Number(next.departures) || 0,
          roomsReady: Number(next.roomsReady) || 0,
          roomsDue: Number(next.roomsDue) || 0,
          roomsOpen: Number(next.roomsOpen) || 0,
          expressRooms: Array.isArray(next.expressRooms) ? next.expressRooms : [],
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const dash = loaded ? String(data.occupancy) : "–";
  const delta = data.occupancyDelta;
  const deltaChip = delta > 0 ? "chip-g" : delta < 0 ? "chip-r" : "chip-b";
  const deltaText = `${delta > 0 ? "↑ +" : delta < 0 ? "↓ " : ""}${delta}%`;

  return (
    <div className="kpi-row">
      <div className="kpi">
        <div className="kpi-lbl">{d.occupancy}</div>
        <div className="kpi-val">{dash}<span>%</span></div>
        <div className="kpi-sub">{loaded ? <span className={`chip ${deltaChip}`}>{deltaText}</span> : null} {d.vsWeek}</div>
      </div>
      <div className="kpi">
        <div className="kpi-lbl">{d.arrivals}</div>
        <div className="kpi-val">{loaded ? data.arrivals : "–"}<span> / {loaded ? data.departures : "–"}</span></div>
        <div className="kpi-sub">{d.checkin}</div>
      </div>
      <div className="kpi">
        <div className="kpi-lbl">{d.roomsReady}</div>
        <div className="kpi-val">{loaded ? data.roomsReady : "–"}<span>/{loaded ? data.roomsDue : "–"}</span></div>
        <div className="kpi-sub">
          {loaded && data.roomsOpen > 0 ? <span className="chip chip-r">{d.open.replace("{n}", String(data.roomsOpen))}</span> : null}
          {loaded && data.expressRooms.length ? ` ${d.express}` : null}
        </div>
      </div>
      <div className="kpi">
        <div className="kpi-lbl">{d.rating}</div>
        <div className="kpi-val">4.9<span>/5</span></div>
        <div className="kpi-sub"><span className="chip chip-b">{d.reviews}</span></div>
      </div>
    </div>
  );
}
