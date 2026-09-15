import { NextResponse } from "next/server";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../lib/recruiting/access";
import {
  createCampaign,
  deleteCampaign,
  listCampaigns,
  parseCampaignInput,
} from "../../../../lib/recruiting/campaigns";
import { prisma } from "../../../../lib/prisma";

export async function GET(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  try {
    const campaigns = await listCampaigns(actor.hotel_tenant_id, locale);
    return NextResponse.json({ campaigns }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("List campaigns failed", error);
    return NextResponse.json({
      error: "LIST_FAILED",
      message: error instanceof Error ? error.message : "Could not load campaigns.",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const input = parseCampaignInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({
      error: "INVALID_FIELDS",
      message: "Select a job and enter source, name and team.",
    }, { status: 400 });
  }
  try {
    const campaign = await createCampaign({
      hotelTenantId: actor.hotel_tenant_id,
      jobId: input.jobId,
      source: input.source,
      name: input.name,
      team: input.team,
      locale,
    });
    if (!campaign) {
      return NextResponse.json({ error: "INVALID_FIELDS", message: "Job not found." }, { status: 400 });
    }
    await prisma.$transaction(async (tx) => {
      await recordAuditLog(tx, {
        hotelTenantId: actor.hotel_tenant_id,
        actorId: actor.id,
        action: "CREATE",
        entityType: "RECRUITING_JOB",
        entityId: campaign.jobId,
        changes: { after: { campaign: { id: campaign.id, source: campaign.source, name: campaign.name, team: campaign.team } } },
      });
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Create campaign failed", error);
    return NextResponse.json({
      error: "CREATE_FAILED",
      message: error instanceof Error ? error.message : "Could not create campaign.",
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  try {
    const ok = await deleteCampaign(actor.hotel_tenant_id, id);
    if (!ok) return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete campaign failed", error);
    return NextResponse.json({
      error: "DELETE_FAILED",
      message: error instanceof Error ? error.message : "Could not delete campaign.",
    }, { status: 500 });
  }
}
