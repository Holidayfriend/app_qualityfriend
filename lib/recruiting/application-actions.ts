import type { AppStage } from "./preview-data";

const transitions: Record<AppStage, readonly AppStage[]> = {
  new: ["invited", "offer", "rejected", "hired", "archived"],
  invited: ["offer", "rejected", "hired", "archived"],
  offer: ["rejected", "hired", "archived"],
  hired: ["archived"],
  rejected: ["new", "archived"],
  archived: ["new"],
};
export function canChangeApplicationStage(from: string, to: string) {
  return transitions[from.toLowerCase() as AppStage]?.includes(to.toLowerCase() as AppStage) ?? false;
}
