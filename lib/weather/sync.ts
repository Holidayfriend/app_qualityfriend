import type { PrismaClient } from "../../app/generated/prisma/client";
import { firstRainHour, hotelAddressKey, weatherFromCode } from "./codes";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

type HotelRow = {
  id: string;
  city: string;
  country: string;
  streetAddress: string;
  postalCode: string;
  weather: { addressKey: string; latitude: number; longitude: number } | null;
};

type GeoResult = { latitude: number; longitude: number; name: string; country?: string; postcodes?: string[] };
type ForecastResult = {
  current?: { time?: string; temperature_2m?: number; weather_code?: number; wind_speed_10m?: number };
  hourly?: { time?: string[]; precipitation?: number[] };
  daily?: { uv_index_max?: number[] };
};

export async function syncHotelWeather(prisma: PrismaClient, hotel: HotelRow) {
  const addressKey = hotelAddressKey(hotel);
  const coords = hotel.weather?.addressKey === addressKey
    ? { latitude: hotel.weather.latitude, longitude: hotel.weather.longitude, cityName: hotel.city, countryName: hotel.country }
    : await geocodeHotel(hotel);

  const forecast = await fetchJson<ForecastResult>(
    `${FORECAST_URL}?latitude=${coords.latitude}&longitude=${coords.longitude}` +
      "&current=temperature_2m,weather_code,wind_speed_10m" +
      "&hourly=precipitation&daily=uv_index_max&timezone=auto&forecast_days=1",
  );
  const current = forecast.current;
  if (current?.temperature_2m == null || current.weather_code == null || current.wind_speed_10m == null) {
    throw new Error("Weather forecast did not include current conditions.");
  }

  const mapped = weatherFromCode(current.weather_code);
  const rainFromHour = firstRainHour(forecast.hourly?.time ?? [], forecast.hourly?.precipitation ?? [], current.time ?? "");
  const uvIndex = Math.round(forecast.daily?.uv_index_max?.[0] ?? 0);
  const fetchedAt = new Date();

  await prisma.hotelWeather.upsert({
    where: { hotelTenantId: hotel.id },
    create: {
      hotelTenantId: hotel.id,
      cityName: coords.cityName,
      countryName: coords.countryName,
      addressKey,
      latitude: coords.latitude,
      longitude: coords.longitude,
      temperatureC: Math.round(current.temperature_2m),
      weatherCode: current.weather_code,
      conditionKey: mapped.conditionKey,
      icon: mapped.icon,
      rainFromHour,
      windKmh: Math.round(current.wind_speed_10m),
      uvIndex,
      fetchedAt,
    },
    update: {
      cityName: coords.cityName,
      countryName: coords.countryName,
      addressKey,
      latitude: coords.latitude,
      longitude: coords.longitude,
      temperatureC: Math.round(current.temperature_2m),
      weatherCode: current.weather_code,
      conditionKey: mapped.conditionKey,
      icon: mapped.icon,
      rainFromHour,
      windKmh: Math.round(current.wind_speed_10m),
      uvIndex,
      fetchedAt,
    },
  });

  return { hotelTenantId: hotel.id, city: coords.cityName, temperatureC: Math.round(current.temperature_2m), conditionKey: mapped.conditionKey };
}

export async function syncAllHotelWeather(prisma: PrismaClient, hotelTenantId?: string) {
  const hotels = await prisma.hotelTenant.findMany({
    where: { isActive: true, ...(hotelTenantId ? { id: hotelTenantId } : {}) },
    select: {
      id: true,
      city: true,
      country: true,
      streetAddress: true,
      postalCode: true,
      weather: { select: { addressKey: true, latitude: true, longitude: true } },
    },
  });

  const results: Array<Record<string, unknown>> = [];
  for (const hotel of hotels) {
    try {
      results.push({ ok: true, ...await syncHotelWeather(prisma, hotel) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, hotelTenantId: hotel.id, error: message });
      console.error(JSON.stringify({ hotelTenantId: hotel.id, error: message }));
    }
  }
  return results;
}

async function geocodeHotel(hotel: HotelRow) {
  const city = hotel.city.trim();
  const postal = hotel.postalCode.trim();
  const country = hotel.country.trim().toLowerCase();
  const data = await fetchJson<{ results?: GeoResult[] }>(`${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=5&language=en&format=json`);
  const results = data.results ?? [];
  const match = results.find((item) => postal && item.postcodes?.some((code) => code.replace(/\s/g, "") === postal.replace(/\s/g, "")))
    ?? results.find((item) => item.country?.toLowerCase() === country)
    ?? (country ? undefined : results[0]);
  if (match) return { latitude: match.latitude, longitude: match.longitude, cityName: match.name || city, countryName: match.country || hotel.country };

  const fallbackQueries = [
    [city, hotel.country].filter((part) => part.trim()).join(", "),
    [hotel.streetAddress, postal, city, hotel.country].filter((part) => part.trim()).join(", "),
  ].filter((query, index, list) => query && list.indexOf(query) === index);

  for (const fallbackQuery of fallbackQueries) {
    const nominatim = await fetchJson<Array<{ lat: string; lon: string }>>(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1`,
    );
    const place = nominatim[0];
    if (place) return { latitude: Number(place.lat), longitude: Number(place.lon), cityName: city, countryName: hotel.country };
  }
  throw new Error(`Could not geocode hotel address for ${city}.`);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "QualityFriend-weather-daily" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Weather request failed (${response.status}).`);
  return response.json() as Promise<T>;
}
