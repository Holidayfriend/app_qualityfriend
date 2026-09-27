"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../i18n/i18n-provider";

type ShellUser = { role: string; allowed_modules: string[]; tasks_open?: number; repairs_open?: number };

const CACHE_KEY = "qf-shell-user";

type TileId = "housekeeping" | "tasks" | "handovers" | "schedule" | "repairs" | "budget" | "notes" | "more";

function readUser(): ShellUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as ShellUser : null;
  } catch {
    return null;
  }
}

export function DashboardModules() {
  const router = useRouter();
  const { dictionary } = useI18n();
  const tiles = dictionary.dashboard.tiles;
  const [user, setUser] = useState<ShellUser | null>(readUser);

  useEffect(() => {
    const read = () => setUser(readUser());
    read();
    window.addEventListener("qf-shell-refresh", read);
    return () => window.removeEventListener("qf-shell-refresh", read);
  }, []);

  function allowed(id: TileId) {
    if (id === "more") return true;
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (id === "notes" || id === "repairs" || id === "handovers" || id === "tasks" || id === "schedule") return true;
    const modules = user.allowed_modules ?? [];
    if (id === "housekeeping") return modules.includes("housekeeping") || modules.includes("housekeeper");
    if (id === "budget") return modules.includes("revenue");
    return false;
  }

  function open(id: TileId) {
    if (id === "more") {
      window.dispatchEvent(new Event("qf-open-mobile-more"));
      return;
    }
    if (id === "schedule") {
      const canPlan = user?.role === "ADMIN" || (user?.allowed_modules ?? []).includes("schedule");
      router.push(canPlan ? "/schedule" : "/schedule/own");
      return;
    }
    router.push(`/${id}`);
  }

  const badge = (id: TileId) => {
    if (id === "tasks" && user?.tasks_open) return String(Math.min(user.tasks_open, 99));
    if (id === "repairs" && user?.repairs_open) return String(Math.min(user.repairs_open, 99));
    return "";
  };

  const primary: Array<[TileId, string]> = [
    ["housekeeping", "🧹"],
    ["tasks", "✅"],
    ["handovers", "🤝"],
    ["schedule", "📅"],
    ["repairs", "🔧"],
    ["budget", "📊"],
    ["notes", "📝"],
    ["more", "⋯"],
  ];

  return (
    <div className="dash-modules">
      <div className="section-title">{dictionary.dashboard.modules}</div>
      <div className="mgrid">
        {primary.filter(([id]) => allowed(id)).map(([id, icon]) => {
          const count = badge(id);
          return (
            <button key={id} type="button" className="mtile" onClick={() => open(id)}>
              <span className="mic">{icon}</span>
              <span className="mlbl">{tiles[id]}</span>
              {count ? <span className="mbadge">{count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
