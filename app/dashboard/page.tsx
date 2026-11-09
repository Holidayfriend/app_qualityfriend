"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../components/dashboard/app-shell";
import { DashboardKpis } from "../../components/dashboard/dashboard-kpis";
import { DashboardModules } from "../../components/dashboard/dashboard-modules";
import { HousekeepingCard } from "../../components/dashboard/housekeeping-card";
import { OnDutyCard } from "../../components/dashboard/on-duty-card";
import { WeatherCard } from "../../components/dashboard/weather-card";
import { useAiRecommendation } from "../../components/ai/use-ai-recommendation";
import { useI18n } from "../../components/i18n/i18n-provider";
import { readHotelTimeZone } from "../../lib/hotel/clock";

function analysisDate(locale: string) {
  const formatted = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: readHotelTimeZone(),
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function DashboardPage() {
  const router = useRouter();
  const { dictionary, locale } = useI18n();
  const briefing = useAiRecommendation("DASHBOARD");
  const d = dictionary.dashboard;

  return <AppShell activeItem="dashboard">
    <div className="qf-dashboard" id="p-dashboard">
    <div className="ai-banner">
      <div className="ai-mark">✨</div>
      <div className="ai-copy">
        <div className="ai-title">{d.analysisTitle.replace("{date}", analysisDate(locale))}</div>
        <div className="ai-body">{briefing.ready ? (briefing.body || d.analysisEmpty) : ""}</div>
      </div>
      <button className="ai-btn" onClick={() => router.push("/ai-assistant")}>{d.discuss} →</button>
    </div>
    <DashboardKpis />
    <DashboardModules />
    <div className="g2">
      <div className="card">
        <div className="ch"><div className="ct">🔔 {d.activities}</div><span className="ca" onClick={() => router.push("/tasks")}>{d.allTasks} →</span></div>
        <div className="cb">
          <div className="al"><div className="al-ic r">⚡</div><div><div className="al-t">{d.expressCleaning}</div><div className="al-m">{d.expressCleaningMeta}</div></div><div className="al-r"><span className="sc sc-r">{d.urgentStatus}</span><div className="tl">{d.now}</div></div></div>
          <div className="al"><div className="al-ic a">⭐</div><div><div className="al-t">{d.reviewActivity}</div><div className="al-m">{d.reviewActivityMeta}</div></div><div className="al-r"><span className="sc sc-a">{d.openStatus}</span><div className="tl">{d.oneHour}</div></div></div>
          <div className="al"><div className="al-ic a">👤</div><div><div className="al-t">{d.breakfastCover}</div><div className="al-m">{d.breakfastCoverMeta}</div></div><div className="al-r"><span className="sc sc-a">{d.openStatus}</span><div className="tl">{d.twoHours}</div></div></div>
          <div className="al"><div className="al-ic b">🤝</div><div><div className="al-t">{d.tablePlan}</div><div className="al-m">{d.tablePlanMeta}</div></div><div className="al-r"><span className="sc sc-g">{d.doneStatus}</span><div className="tl">09:14</div></div></div>
          <div className="al"><div className="al-ic g">✅</div><div><div className="al-t">{d.firstAid}</div><div className="al-m">{d.firstAidMeta}</div></div><div className="al-r"><span className="sc sc-g">{d.doneStatus}</span><div className="tl">08:30</div></div></div>
          <div className="al"><div className="al-ic g">✅</div><div><div className="al-t">{d.restock}</div><div className="al-m">{d.restockMeta}</div></div><div className="al-r"><span className="sc sc-g">{d.doneStatus}</span><div className="tl">08:10</div></div></div>
        </div>
      </div>
      <div className="dash-stack">
        <WeatherCard />
        <HousekeepingCard />
        <OnDutyCard />
      </div>
    </div>
  </div>
  </AppShell>;
}
