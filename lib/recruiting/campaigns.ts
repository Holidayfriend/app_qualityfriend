import { randomBytes } from "node:crypto";
import { prisma } from "../prisma";

export type JobCampaign = {
  id: string;
  jobId: string;
  jobTitle: string;
  jobSlug: string;
  source: string;
  name: string;
  team: string;
  code: string;
  clickCount: number;
  applicationCount: number;
  urlPath: string;
  createdAt: string;
};

let tableReady: Promise<void> | null = null;

export function ensureCampaignsTable() {
  if (!tableReady) {
    tableReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS recruiting_job_campaigns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          hotel_tenant_id UUID NOT NULL REFERENCES hotel_tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
          job_id UUID NOT NULL,
          source VARCHAR(80) NOT NULL,
          name VARCHAR(180) NOT NULL,
          team VARCHAR(120) NOT NULL,
          code VARCHAR(32) NOT NULL,
          click_count INT NOT NULL DEFAULT 0,
          application_count INT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS recruiting_job_campaigns_hotel_tenant_id_id_key
          ON recruiting_job_campaigns (hotel_tenant_id, id)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS recruiting_job_campaigns_code_key
          ON recruiting_job_campaigns (code)
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS recruiting_job_campaigns_hotel_job_idx
          ON recruiting_job_campaigns (hotel_tenant_id, job_id)
      `);
    })().catch((error) => {
      tableReady = null;
      throw error;
    });
  }
  return tableReady;
}

export function makeCampaignCode() {
  return randomBytes(6).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase() || randomBytes(5).toString("hex");
}

export function campaignUrlPath(jobSlug: string, code: string) {
  return `/apply/${jobSlug}?c=${encodeURIComponent(code)}`;
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseCampaignInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const jobId = text(data.jobId, 80);
  const source = text(data.source, 80);
  const name = text(data.name, 180);
  const team = text(data.team, 120);
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || !source || !name || !team) return null;
  return { jobId, source, name, team };
}

type CampaignRow = {
  id: string;
  job_id: string;
  source: string;
  name: string;
  team: string;
  code: string;
  click_count: number;
  application_count: number;
  created_at: Date;
  job_title: string;
  job_slug: string;
};

function mapRow(row: CampaignRow): JobCampaign {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: row.job_title,
    jobSlug: row.job_slug,
    source: row.source,
    name: row.name,
    team: row.team,
    code: row.code,
    clickCount: Number(row.click_count) || 0,
    applicationCount: Number(row.application_count) || 0,
    urlPath: campaignUrlPath(row.job_slug, row.code),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listCampaigns(hotelTenantId: string, locale?: string) {
  await ensureCampaignsTable();
  const titleExpr = locale === "de"
    ? `CASE WHEN NULLIF(TRIM(j.title_de), '') IS NOT NULL THEN j.title_de ELSE j.title END`
    : locale === "it"
      ? `CASE WHEN NULLIF(TRIM(j.title_it), '') IS NOT NULL THEN j.title_it ELSE j.title END`
      : `j.title`;
  const rows = await prisma.$queryRawUnsafe<CampaignRow[]>(`
    SELECT c.id, c.job_id, c.source, c.name, c.team, c.code, c.click_count, c.application_count, c.created_at,
           ${titleExpr} AS job_title, j.slug AS job_slug
    FROM recruiting_job_campaigns c
    INNER JOIN recruiting_jobs j ON j.id = c.job_id AND j.hotel_tenant_id = c.hotel_tenant_id
    WHERE c.hotel_tenant_id = $1::uuid
    ORDER BY c.created_at DESC
  `, hotelTenantId);
  return rows.map(mapRow);
}

export async function createCampaign(input: {
  hotelTenantId: string;
  jobId: string;
  source: string;
  name: string;
  team: string;
  locale?: string;
}) {
  await ensureCampaignsTable();
  const job = await prisma.recruitingJob.findFirst({
    where: { id: input.jobId, hotelTenantId: input.hotelTenantId },
    select: { id: true, slug: true, title: true, titleDe: true, titleIt: true },
  });
  if (!job) return null;
  const code = makeCampaignCode();
  const rows = await prisma.$queryRawUnsafe<CampaignRow[]>(`
    INSERT INTO recruiting_job_campaigns (hotel_tenant_id, job_id, source, name, team, code)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
    RETURNING id, job_id, source, name, team, code, click_count, application_count, created_at
  `, input.hotelTenantId, input.jobId, input.source, input.name, input.team, code);
  const row = rows[0];
  if (!row) return null;
  const jobTitle = input.locale === "de" && job.titleDe.trim()
    ? job.titleDe
    : input.locale === "it" && job.titleIt.trim()
      ? job.titleIt
      : job.title;
  return mapRow({ ...row, job_title: jobTitle, job_slug: job.slug });
}

export async function deleteCampaign(hotelTenantId: string, id: string) {
  await ensureCampaignsTable();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const result = await prisma.$executeRawUnsafe(
    `DELETE FROM recruiting_job_campaigns WHERE hotel_tenant_id = $1::uuid AND id = $2::uuid`,
    hotelTenantId,
    id,
  );
  return Number(result) > 0;
}

export async function findCampaignByCode(code: string, jobId?: string) {
  await ensureCampaignsTable();
  const value = text(code, 32);
  if (!value) return null;
  const rows = jobId
    ? await prisma.$queryRawUnsafe<Array<{
      id: string; hotel_tenant_id: string; job_id: string; source: string; name: string; team: string; code: string;
    }>>(`
      SELECT id, hotel_tenant_id, job_id, source, name, team, code
      FROM recruiting_job_campaigns
      WHERE code = $1 AND job_id = $2::uuid
      LIMIT 1
    `, value, jobId)
    : await prisma.$queryRawUnsafe<Array<{
      id: string; hotel_tenant_id: string; job_id: string; source: string; name: string; team: string; code: string;
    }>>(`
      SELECT id, hotel_tenant_id, job_id, source, name, team, code
      FROM recruiting_job_campaigns
      WHERE code = $1
      LIMIT 1
    `, value);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    hotelTenantId: row.hotel_tenant_id,
    jobId: row.job_id,
    source: row.source,
    name: row.name,
    team: row.team,
    code: row.code,
  };
}

export async function incrementCampaignClicks(code: string, jobId: string) {
  const campaign = await findCampaignByCode(code, jobId);
  if (!campaign) return null;
  await prisma.$executeRawUnsafe(
    `UPDATE recruiting_job_campaigns SET click_count = click_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
    campaign.id,
  );
  return campaign;
}

export async function incrementCampaignApplications(code: string, jobId: string) {
  const campaign = await findCampaignByCode(code, jobId);
  if (!campaign) return null;
  await prisma.$executeRawUnsafe(
    `UPDATE recruiting_job_campaigns SET application_count = application_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
    campaign.id,
  );
  return campaign;
}
