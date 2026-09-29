"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Input } from "../ui/input";
import { listCountries, listProvinces } from "../../lib/geo/locations";
import { parseStarCategory, starCategories } from "../../lib/hotel/star-category";
import { DEFAULT_HOTEL_TIME_ZONE } from "../../lib/hotel/clock";
import { accountSettingsMessages, type Locale } from "../../lib/i18n/dictionaries";

type Messages = (typeof accountSettingsMessages)[Locale];
export type HotelSettingsValues = {
  hotelNameEn: string; hotelNameDe: string; hotelNameIt: string; email: string; logoUrl: string; companyName: string;
  streetAddress: string; postalCode: string; city: string; country: string; province: string; contactPerson: string;
  phoneNumber: string; vatId: string; tripadvisorId: string; asaXmlName: string; timeZone: string; hotelLanguage: string;
  pecAddress: string; invoiceEmail: string; sdiCode: string; legalForm: string; roomCount: string; starRating: string; seasonal: boolean;
  openingPeriod: string; closurePeriod: string; checkInTime: string; checkOutTime: string; pmsName: string;
};

const timeZones = [DEFAULT_HOTEL_TIME_ZONE, "Europe/Rome", "Europe/Vienna", "Europe/Zurich", "Europe/Paris", "Europe/Madrid", "Europe/London", "Europe/Amsterdam", "Europe/Brussels", "Europe/Prague", "UTC"];
const selectClass = "block h-11 w-full cursor-pointer rounded-lg border border-[var(--qf-border)] bg-white px-3.5 text-sm font-normal";

function nameKey(locale: Locale) {
  return locale === "de" ? "hotelNameDe" : locale === "it" ? "hotelNameIt" : "hotelNameEn";
}

function Group({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <div className="space-y-4 border-t border-[var(--qf-border)] px-5 py-5 first:border-t-0">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--qf-accent)]">{title}</h3>
        {help ? <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--qf-text-muted)]">{help}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-[13px] font-semibold">{label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>{children}</select>
    </label>
  );
}

export function HotelSettingsForm<T extends HotelSettingsValues>({ hotel, setHotel, locale, t }: { hotel: T; setHotel: Dispatch<SetStateAction<T | null>>; locale: Locale; t: Messages }) {
  const key = nameKey(locale);
  const countries = listCountries(locale);
  const provinces = listProvinces(hotel.country, locale);
  const pmsChoice = hotel.pmsName === "ASA" ? "ASA" : hotel.pmsName ? "OTHER" : "";
  const zones = hotel.timeZone && !timeZones.includes(hotel.timeZone) ? [hotel.timeZone, ...timeZones] : timeZones;
  const legalForms = [
    ["SOLE", t.legalSole], ["SNC", t.legalSnc], ["SAS", t.legalSas], ["SRL", t.legalSrl], ["SPA", t.legalSpa], ["OTHER", t.legalOther],
  ] as const;

  function update(patch: Partial<HotelSettingsValues>) {
    setHotel((current) => current ? { ...current, ...patch } : current);
  }

  return (
    <>
      <Group title={t.profileGroup} help={t.profileGroupHelp}>
        <Input label={t.hotelName} value={hotel[key]} onChange={(event) => update({ [key]: event.target.value })} />
        <Input label={t.logo} value={hotel.logoUrl} onChange={(event) => update({ logoUrl: event.target.value })} />
        <SelectField label={t.hotelLanguage} value={hotel.hotelLanguage} onChange={(hotelLanguage) => update({ hotelLanguage })}>
          <option value="EN">English</option>
          <option value="DE">Deutsch</option>
          <option value="IT">Italiano</option>
        </SelectField>
        <SelectField label={t.timeZone} value={hotel.timeZone || DEFAULT_HOTEL_TIME_ZONE} onChange={(timeZone) => update({ timeZone })}>
          {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </SelectField>
        <Input label={t.rooms} type="number" min={0} value={hotel.roomCount} onChange={(event) => update({ roomCount: event.target.value })} />
        <SelectField label={t.stars} value={hotel.starRating} onChange={(starRating) => update({ starRating })}>
          <option value="">{t.starsPlaceholder}</option>
          {starCategories.map((code) => {
            const label = { "1": t.star1, "2": t.star2, "3": t.star3, "3S": t.star3s, "4": t.star4, "4S": t.star4s, "5": t.star5, "5S": t.star5s }[code];
            return <option key={code} value={code}>{label}</option>;
          })}
          {hotel.starRating && !starCategories.some((code) => code === hotel.starRating) ? <option value={hotel.starRating}>{hotel.starRating}</option> : null}
        </SelectField>
      </Group>
      <Group title={t.companyGroup}>
        <Input label={t.company} value={hotel.companyName} onChange={(event) => update({ companyName: event.target.value })} />
        <Input type="email" label={t.email} value={hotel.email} onChange={(event) => update({ email: event.target.value })} />
        <Input label={t.contact} value={hotel.contactPerson} onChange={(event) => update({ contactPerson: event.target.value })} />
        <Input label={t.phone} value={hotel.phoneNumber} onChange={(event) => update({ phoneNumber: event.target.value })} />
        <SelectField label={t.country} value={hotel.country} onChange={(country) => update({ country, province: listProvinces(country, locale).some((item) => item.code === hotel.province) ? hotel.province : "" })}>
          <option value="">{t.countryPlaceholder}</option>
          {countries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
          {hotel.country && !countries.some((country) => country.code === hotel.country) ? <option value={hotel.country}>{hotel.country}</option> : null}
        </SelectField>
        {provinces.length ? (
          <SelectField label={t.province} value={hotel.province} onChange={(province) => update({ province })}>
            <option value="">{t.provincePlaceholder}</option>
            {provinces.map((province) => <option key={province.code} value={province.code}>{province.label}</option>)}
            {hotel.province && !provinces.some((province) => province.code === hotel.province) ? <option value={hotel.province}>{hotel.province}</option> : null}
          </SelectField>
        ) : null}
        <Input label={t.city} value={hotel.city} onChange={(event) => update({ city: event.target.value })} />
        <Input label={t.street} value={hotel.streetAddress} onChange={(event) => update({ streetAddress: event.target.value })} />
        <Input label={t.zip} value={hotel.postalCode} onChange={(event) => update({ postalCode: event.target.value })} />
        <Input label={t.vat} value={hotel.vatId} onChange={(event) => update({ vatId: event.target.value })} />
        <SelectField label={t.legalForm} value={hotel.legalForm} onChange={(legalForm) => update({ legalForm })}>
          <option value="">{t.legalFormPlaceholder}</option>
          {legalForms.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          {hotel.legalForm && !legalForms.some(([value]) => value === hotel.legalForm) ? <option value={hotel.legalForm}>{hotel.legalForm}</option> : null}
        </SelectField>
      </Group>
      <Group title={t.invoicingGroup} help={t.invoicingHelp}>
        <Input type="email" label={t.invoiceEmail} value={hotel.invoiceEmail} placeholder="billing@hotel.com" onChange={(event) => update({ invoiceEmail: event.target.value })} />
        <Input type="email" label={t.pec} value={hotel.pecAddress} placeholder="name@pec.it" onChange={(event) => update({ pecAddress: event.target.value })} />
        <Input label={t.sdi} value={hotel.sdiCode} maxLength={7} placeholder="ABC1234" onChange={(event) => update({ sdiCode: event.target.value.toUpperCase() })} />
      </Group>
      <Group title={t.stayGroup} help={t.stayHelp}>
        <Input label={t.checkIn} type="time" value={hotel.checkInTime} onChange={(event) => update({ checkInTime: event.target.value })} />
        <Input label={t.checkOut} type="time" value={hotel.checkOutTime} onChange={(event) => update({ checkOutTime: event.target.value })} />
        <SelectField label={t.seasonal} value={hotel.seasonal ? "yes" : "no"} onChange={(value) => update({ seasonal: value === "yes", openingPeriod: value === "yes" ? hotel.openingPeriod : "", closurePeriod: value === "yes" ? hotel.closurePeriod : "" })}>
          <option value="no">{t.no}</option>
          <option value="yes">{t.yes}</option>
        </SelectField>
        {hotel.seasonal ? (
          <>
            <Input label={t.opening} value={hotel.openingPeriod} placeholder={t.openingPlaceholder} onChange={(event) => update({ openingPeriod: event.target.value })} />
            <Input label={t.closure} value={hotel.closurePeriod} placeholder={t.closurePlaceholder} onChange={(event) => update({ closurePeriod: event.target.value })} />
          </>
        ) : null}
      </Group>
      <Group title={t.systemsGroup} help={t.systemsHelp}>
        <SelectField label={t.pms} value={pmsChoice} onChange={(value) => update({ pmsName: value === "ASA" ? "ASA" : value === "OTHER" ? (hotel.pmsName === "ASA" ? "" : hotel.pmsName) : "" })}>
          <option value="">{t.pmsPlaceholder}</option>
          <option value="ASA">ASA</option>
          <option value="OTHER">{t.pmsOtherOption}</option>
        </SelectField>
        {pmsChoice === "OTHER" ? <Input label={t.pmsOther} value={hotel.pmsName} onChange={(event) => update({ pmsName: event.target.value })} /> : null}
        <Input label={t.asaXmlName} value={hotel.asaXmlName} maxLength={255} placeholder="hotel" onChange={(event) => update({ asaXmlName: event.target.value })} />
        <Input label={t.tripadvisor} value={hotel.tripadvisorId} onChange={(event) => update({ tripadvisorId: event.target.value })} />
      </Group>
    </>
  );
}
