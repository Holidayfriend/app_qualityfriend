import { prisma } from "../../../../lib/prisma";
import { parseApplicationInput, toPublicJob } from "../../../../lib/recruiting/job-fields";

type Context = { params: Promise<{ slug: string }> };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function publicJob(slug: string) {
  if (!slugPattern.test(slug) || slug.length > 80) return null;
  return prisma.recruitingJob.findFirst({ where: { slug, status: "ACTIVE" } });
}

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const job = await publicJob(slug);
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") ?? "";
  const click = url.searchParams.get("click") === "1";
  const current = click
    ? await prisma.recruitingJob.update({ where: { id: job.id }, data: { clickCount: { increment: 1 } } })
    : job;
  const apps = await prisma.recruitingApplication.count({ where: { jobId: current.id } });
  return Response.json({ job: toPublicJob(current, apps, locale) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: Context) {
  const { slug } = await context.params;
  const job = await publicJob(slug);
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const format = job.format.toLowerCase() as "classic" | "quiz";
  const input = parseApplicationInput(await request.json().catch(() => null), format, job.cvRequired);
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const created = await prisma.recruitingApplication.create({
    data: {
      hotelTenantId: job.hotelTenantId,
      jobId: job.id,
      locale: input.locale,
      salutation: input.salutation,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      message: input.message,
      cvFileName: input.cvFileName,
      keepForOtherJobs: input.keepForOtherJobs,
      answers: input.answers,
    },
  });
  return Response.json({ id: created.id }, { status: 201 });
}
