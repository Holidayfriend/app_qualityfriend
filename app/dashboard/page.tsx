"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../components/dashboard/app-shell";
import { HousekeepingCard } from "../../components/dashboard/housekeeping-card";
import { OnDutyCard } from "../../components/dashboard/on-duty-card";
import { WeatherCard } from "../../components/dashboard/weather-card";
import { useI18n } from "../../components/i18n/i18n-provider";

export default function DashboardPage() {
  const router = useRouter();
  const { dictionary } = useI18n();
  const d = dictionary.dashboard;

  return <AppShell activeItem="dashboard">
    <div className="qf-dashboard" id="p-dashboard">
    <div className="ai-banner">
      <div style={{"fontSize":"22px"}}>✨</div>
      <div style={{"flex":1}}>
        <div className="ai-title">{d.analysisTitle}</div>
        <div className="ai-body">{d.analysisBody}</div>
      </div>
      <button className="ai-btn" onClick={() => router.push("/ai-assistant")}>{d.discuss} →</button>
    </div>
    <div className="kpi-row">
      <div className="kpi"><div className="kpi-lbl">{d.occupancy}</div><div className="kpi-val">87<span>%</span></div><div className="kpi-sub"><span className="chip chip-g">↑ +4%</span> {d.vsWeek}</div></div>
      <div className="kpi"><div className="kpi-lbl">{d.arrivals}</div><div className="kpi-val">10<span> / 6</span></div><div className="kpi-sub">{d.checkin}</div></div>
      <div className="kpi"><div className="kpi-lbl">{d.roomsReady}</div><div className="kpi-val">9<span>/12</span></div><div className="kpi-sub"><span className="chip chip-r">{d.open}</span> {d.express}</div></div>
      <div className="kpi"><div className="kpi-lbl">{d.rating}</div><div className="kpi-val">4.9<span>/5</span></div><div className="kpi-sub"><span className="chip chip-b">{d.reviews}</span></div></div>
    </div>
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
      <div style={{"display":"flex","flexDirection":"column","gap":"18px"}}>
        <WeatherCard />
        <HousekeepingCard />
        <OnDutyCard />
      </div>
    </div>
  </div>
  </AppShell>;
}
