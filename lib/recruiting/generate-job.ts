import "server-only";

import { prisma } from "../prisma";
import { completeHotelChatJson } from "../ai/complete";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|link|meta|style)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, "")
    .trim();
}

function pickHotelName(hotel: { hotelNameEn: string; hotelNameDe: string; hotelNameIt: string }, locale: string) {
  if (locale === "de") return hotel.hotelNameDe || hotel.hotelNameEn || hotel.hotelNameIt;
  if (locale === "it") return hotel.hotelNameIt || hotel.hotelNameEn || hotel.hotelNameDe;
  return hotel.hotelNameEn || hotel.hotelNameDe || hotel.hotelNameIt;
}

async function completeJson(hotelTenantId: string, messages: { role: string; content: string }[]) {
  const parsed = await completeHotelChatJson(prisma, hotelTenantId, messages, { temperature: 0.4, required: true });
  if (!parsed) throw new Error("Hotel AI API key is not configured.");
  return parsed;
}

export async function generateJobCopy(input: {
  hotelTenantId: string;
  title: string;
  departmentName: string;
  workType: string;
  locale: string;
}) {
  const hotel = await prisma.hotelTenant.findUnique({
    where: { id: input.hotelTenantId },
    select: {
      hotelNameEn: true,
      hotelNameDe: true,
      hotelNameIt: true,
      city: true,
      streetAddress: true,
      postalCode: true,
      country: true,
    },
  });
  if (!hotel) throw new Error("Hotel not found");
  const locale = input.locale === "de" || input.locale === "it" ? input.locale : "en";
  const hotelName = pickHotelName(hotel, locale);
  const location = [hotel.city, hotel.country].filter(Boolean).join(", ") || hotel.city || hotel.country;
  const address = [hotel.streetAddress, hotel.postalCode, hotel.city, hotel.country].filter(Boolean).join(", ");
  const language = locale === "de" ? "German" : locale === "it" ? "Italian" : "English";
  const parsed = await completeJson(input.hotelTenantId, [
    {
      role: "system",
      content: `The app language is ${language}. Write every field in ${language} only. Never switch language, even if the title is in another language — translate and improve it into ${language}. You write hotel job ads. Use only the hotel facts given. Do not invent a different city or hotel name. Return JSON only.`,
    },
    {
      role: "user",
      content: `App language: ${language}. Every JSON string must be in ${language}.
Create a complete job listing from this title. Improve the title so it is clear and attractive, still one line, in ${language}.
Hotel: ${hotelName}
Address: ${address}
Location field must be: ${location}
Department: ${input.departmentName || "(not set)"}
Work type: ${input.workType || "(not set)"}
Title: ${input.title}

Return JSON:
{"title":"","startFrom":"","benefits":"","descriptionHtml":"","thankYouHtml":""}

startFrom: short start date/availability in ${language}.
benefits: a richer benefits line in ${language} (several perks, comma or middot separated).

descriptionHtml: HTML for a WYSIWYG editor. Must be substantial (about 180–350 words), not a stub.
Use <p>, <strong>, <em>, <ul>, <li>, optional <h3>. Sprinkle fitting emoji as icons (e.g. 🏨 ✨ ✅ 📍 🤝 🍽️ 🧹) next to headings or list items — not on every word.
Structure:
1) Warm intro about the hotel and role (bold the role and hotel name).
2) <h3> with icon + Your tasks, then 6–10 <li> items.
3) <h3> with icon + What we offer, then 4–7 <li> items (team, meals, location — do not invent a fake city).
4) Closing paragraph inviting the applicant to apply.
No scripts, no images, no links.

thankYouHtml: HTML for the same editor. Must be a full confirmation (about 80–140 words), not one sentence.
Use <p>, <strong>, emoji icons (e.g. ✅ 🙏 📬). Thank them by name-generic, bold the hotel name, say the application arrived, explain we will review and contact them, offer a friendly closing. No scripts.`,
    },
  ]);
  const title = text(parsed.title, 180) || input.title;
  const startFrom = text(parsed.startFrom, 120);
  const benefits = text(parsed.benefits, 400);
  const descriptionHtml = sanitizeHtml(text(parsed.descriptionHtml, 20000));
  const thankYouHtml = sanitizeHtml(text(parsed.thankYouHtml, 8000));
  if (!descriptionHtml) throw new Error("Empty job description.");
  return { title, startFrom, benefits, location, descriptionHtml, thankYouHtml };
}
