export function bestListingJob<T extends { clicks: number; conv: string }>(jobs: readonly T[]) {
  return jobs.filter((job) => job.clicks > 0).sort((a, b) => parseFloat(b.conv) - parseFloat(a.conv))[0];
}
