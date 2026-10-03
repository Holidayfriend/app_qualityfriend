// ASA may omit the total and provide only its K1/K2/K3 age-group counts.
export function totalChildren(total: number | null, k1: number | null, k2: number | null, k3: number | null): number | null {
  if (total !== null) return total;
  if (k1 === null && k2 === null && k3 === null) return null;
  return (k1 ?? 0) + (k2 ?? 0) + (k3 ?? 0);
}
