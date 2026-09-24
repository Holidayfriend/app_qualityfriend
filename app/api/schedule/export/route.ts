import { NextResponse } from "next/server";
import { buildScheduleExport } from "../../../../lib/schedule/export-data";
import { supportedLocales } from "../../../../lib/i18n/dictionaries";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const locale = params.get("locale") ?? "";
  const result = await buildScheduleExport({
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    department: params.get("department") ?? "all",
    userId: params.get("userId") ?? "",
    locale: supportedLocales.includes(locale as (typeof supportedLocales)[number]) ? locale : "en",
  });
  if ("error" in result) {
    const status = result.error === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json(result, { status });
  }
  if (params.get("format") === "json") {
    return NextResponse.json({ entries: result.entries, totals: result.totals }, { headers: { "Cache-Control": "no-store" } });
  }
  if (params.get("format") === "csv") {
    return new NextResponse(result.csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="schedule-${params.get("from") ?? "export"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new NextResponse(result.xls, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="schedule-${params.get("from") ?? "export"}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}
