export function checklistDueTime(value: unknown) {
  const text = String(value ?? "").trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(text);
  return match ? `${match[1]}:${match[2]}` : "";
}

export function dueWithTime(date: string, time: string) {
  const clock = time.trim();
  if (!date) return clock || "–";
  return clock ? `${date} ${clock}` : date;
}

export function moveIndex<T>(list: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [row] = next.splice(from, 1);
  next.splice(to, 0, row);
  return next;
}
