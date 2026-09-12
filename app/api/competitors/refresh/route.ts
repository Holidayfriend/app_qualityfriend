import { competitorActor } from "../../../../lib/competitors/access";
import { dispatchCompetitorRefresh, getJobQueue, queues, type CompetitorRefreshJob } from "../../../../lib/jobs/queue";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) {
    return Response.json({ error: "FORBIDDEN_ORIGIN" }, { status: 403 });
  }
  const actor = await competitorActor();
  if (actor instanceof Response) return actor;
  if (!actor.locationKey) return Response.json({ error: "TRIPADVISOR_ID_REQUIRED" }, { status: 400 });
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(actor.locationKey)) return Response.json({ error: "INVALID_TRIPADVISOR_ID" }, { status: 400 });
  try {
    const id = await dispatchCompetitorRefresh({ hotelTenantId: actor.hotel_tenant_id, locationKey: actor.locationKey });
    if (!id) return Response.json({ error: "REFRESH_ALREADY_PENDING" }, { status: 409 });
    return Response.json({ jobId: id, status: "queued", statusUrl: `/api/competitors/refresh?jobId=${id}` }, { status: 202 });
  } catch (error) {
    console.error("Competitor job dispatch failed", error);
    return Response.json({ error: "QUEUE_UNAVAILABLE" }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const actor = await competitorActor();
  if (actor instanceof Response) return actor;
  const id = new URL(request.url).searchParams.get("jobId");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ error: "INVALID_JOB_ID" }, { status: 400 });
  }
  try {
    const boss = await getJobQueue();
    const [job] = await boss.findJobs<CompetitorRefreshJob>(queues.competitors, { id, key: actor.hotel_tenant_id });
    if (!job || job.data.hotelTenantId !== actor.hotel_tenant_id) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ jobId: job.id, status: job.state, locationKey: job.data.locationKey,
      result: job.state === "completed" ? job.output : null,
      error: job.state === "failed" || job.state === "retry" ? "Competitor refresh failed; check worker logs." : null,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Competitor job status failed", error);
    return Response.json({ error: "QUEUE_UNAVAILABLE" }, { status: 503 });
  }
}
