"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../components/dashboard/app-shell";
import { DashboardKpis } from "../../components/dashboard/dashboard-kpis";
import { DashboardModules } from "../../components/dashboard/dashboard-modules";
import { ActivitiesCard } from "../../components/dashboard/activities-card";
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
  const [analysisWhen, setAnalysisWhen] = useState("");

  useEffect(() => {
    setAnalysisWhen(analysisDate(locale));
  }, [locale]);

  const analysisTitle = analysisWhen
    ? d.analysisTitle.replace("{date}", analysisWhen)
    : d.analysisTitle.replace("{date}", "").replace(/\s*·\s*$/, "");

  return <AppShell activeItem="dashboard">
    <div className="qf-dashboard" id="p-dashboard">
    <div className="ai-banner">
      <div className="ai-mark">✨</div>
      <div className="ai-copy">
        <div className="ai-title">{analysisTitle}</div>
        <div className="ai-body">{briefing.ready ? (briefing.body || d.analysisEmpty) : ""}</div>
      </div>
      <button className="ai-btn" onClick={() => router.push("/ai-assistant")}>{d.discuss} →</button>
    </div>
    <DashboardKpis />
    <DashboardModules />
    <div className="g2">
      <ActivitiesCard />
      <div className="dash-stack">
        <WeatherCard />
        <HousekeepingCard />
        <OnDutyCard />
      </div>
    </div>
  </div>
  </AppShell>;
}
