export type WeatherConditionKey =
  | "clear"
  | "mainlyClear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "changeable";

export function weatherFromCode(code: number): { conditionKey: WeatherConditionKey; icon: string } {
  if (code === 0) return { conditionKey: "clear", icon: "☀️" };
  if (code === 1) return { conditionKey: "mainlyClear", icon: "🌤️" };
  if (code === 2) return { conditionKey: "partlyCloudy", icon: "⛅" };
  if (code === 3) return { conditionKey: "overcast", icon: "☁️" };
  if (code === 45 || code === 48) return { conditionKey: "fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { conditionKey: "drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { conditionKey: "rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { conditionKey: "snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { conditionKey: "rain", icon: "🌦️" };
  if (code === 85 || code === 86) return { conditionKey: "snow", icon: "🌨️" };
  if (code >= 95 && code <= 99) return { conditionKey: "thunderstorm", icon: "⛈️" };
  return { conditionKey: "changeable", icon: "⛅" };
}

export function hotelAddressKey(hotel: { streetAddress: string; postalCode: string; city: string; country: string }) {
  return [hotel.streetAddress, hotel.postalCode, hotel.city, hotel.country].map((part) => part.trim()).join("|").toLowerCase();
}

export function firstRainHour(times: string[], precipitation: number[], fromTime: string) {
  for (let i = 0; i < times.length; i++) {
    if ((precipitation[i] ?? 0) < 0.1) continue;
    if (times[i] < fromTime) continue;
    const match = times[i].match(/T(\d{2}):/);
    if (match) return `${match[1]}:00`;
  }
  return null;
}
