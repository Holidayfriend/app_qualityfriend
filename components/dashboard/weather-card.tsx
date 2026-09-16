"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";

type WeatherSnapshot = {
  cityName: string;
  temperatureC: number;
  conditionKey: string;
  icon: string;
  rainFromHour: string | null;
  windKmh: number;
  uvIndex: number;
};

export function WeatherCard() {
  const { dictionary } = useI18n();
  const d = dictionary.dashboard;
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/weather", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { weather: WeatherSnapshot | null };
        if (!cancelled) setWeather(data.weather);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const condition = weather
    ? d.weatherConditions[weather.conditionKey as keyof typeof d.weatherConditions] ?? d.weatherConditions.changeable
    : d.weatherUnavailable;
  const rain = weather?.rainFromHour
    ? d.weatherRainFrom.replace("{time}", weather.rainFromHour)
    : d.weatherNoRain;

  return (
    <div className="weather">
      <div style={{ fontSize: "36px" }}>{weather?.icon ?? "⛅"}</div>
      <div>
        <div className="w-temp">{loaded && weather ? `${weather.temperatureC}°` : "–"}</div>
        <div className="w-desc">{loaded ? `${condition}${weather ? ` · ${weather.cityName}` : ""}` : d.weatherUnavailable}</div>
      </div>
      <div className="w-detail">
        {loaded && weather ? (
          <>
            {rain}<br />
            {d.weatherWindSpeed.replace("{speed}", String(weather.windKmh))}<br />
            {d.weatherUvIndex.replace("{index}", String(weather.uvIndex))}
          </>
        ) : d.weatherUnavailable}
      </div>
    </div>
  );
}
