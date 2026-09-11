"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../components/dashboard/app-shell";
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
        <div className="weather">
          <div style={{"fontSize":"36px"}}>⛅</div>
          <div><div className="w-temp">18°</div><div className="w-desc">{d.weather}</div></div>
          <div className="w-detail">{d.rain}<br />{d.wind}<br />{d.uv}</div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">🧹 {dictionary.navigation.housekeeping}</div><span className="ca" onClick={() => router.push("/housekeeping")}>{d.fullView} →</span></div>
          <div className="cb">
            <div style={{"display":"flex","gap":"10px","marginBottom":"12px"}}>
              <div style={{"flex":1,"textAlign":"center","padding":"10px","background":"var(--red-bg)","borderRadius":"8px"}}><div style={{"fontSize":"20px","fontWeight":700,"color":"var(--red)"}}>3</div><div style={{"fontSize":"11px","color":"var(--red)"}}>{d.dirty}</div></div>
              <div style={{"flex":1,"textAlign":"center","padding":"10px","background":"var(--amber-bg)","borderRadius":"8px"}}><div style={{"fontSize":"20px","fontWeight":700,"color":"var(--amber)"}}>2</div><div style={{"fontSize":"11px","color":"var(--amber)"}}>{d.cleaning}</div></div>
              <div style={{"flex":1,"textAlign":"center","padding":"10px","background":"var(--green-bg)","borderRadius":"8px"}}><div style={{"fontSize":"20px","fontWeight":700,"color":"var(--green)"}}>6</div><div style={{"fontSize":"11px","color":"var(--green)"}}>{d.ready}</div></div>
              <div style={{"flex":1,"textAlign":"center","padding":"10px","background":"var(--blue-bg)","borderRadius":"8px"}}><div style={{"fontSize":"20px","fontWeight":700,"color":"var(--blue)"}}>3</div><div style={{"fontSize":"11px","color":"var(--blue)"}}>{d.inspected}</div></div>
            </div>
            <div style={{"fontSize":"12.5px","color":"var(--text2)"}}>{d.hkNote}</div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">📅 {d.onDuty}</div><span className="ca" onClick={() => router.push("/schedule")}>{d.roster} →</span></div>
          <div className="cb">
            <div style={{"fontSize":"13px","color":"var(--text2)","marginBottom":"8px"}}>{d.teamSummary}</div>
            <div style={{"display":"flex","flexWrap":"wrap","gap":"6px"}}>
              <span style={{"padding":"4px 10px","background":"var(--accent-light)","color":"var(--accent)","borderRadius":"5px","fontSize":"12px","fontWeight":600}}>Maria R. 07-15</span>
              <span style={{"padding":"4px 10px","background":"var(--blue-bg)","color":"var(--blue)","borderRadius":"5px","fontSize":"12px","fontWeight":600}}>Jana M. 15-23</span>
              <span style={{"padding":"4px 10px","background":"var(--accent-light)","color":"var(--accent)","borderRadius":"5px","fontSize":"12px","fontWeight":600}}>Sabine M. 08-16</span>
              <span style={{"padding":"4px 10px","background":"var(--accent-light)","color":"var(--accent)","borderRadius":"5px","fontSize":"12px","fontWeight":600}}>Luca B. 11-22</span>
              <span style={{"padding":"4px 10px","background":"var(--red-bg)","color":"var(--red)","borderRadius":"5px","fontSize":"12px","fontWeight":600}}>Zorah A. 🏖 {d.vacation}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </AppShell>;
}
