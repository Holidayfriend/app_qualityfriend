export const housekeeperRoomStatuses = ["dirty", "cleaning", "clean"] as const;

const housekeeperRoomStatusSet = new Set<string>(housekeeperRoomStatuses);

export function isHousekeeperRoomStatus(status: string) {
  return housekeeperRoomStatusSet.has(status);
}

export function canMutateRoomState(input: {
  isAdmin: boolean;
  status: string | null;
  changesGuestCleaningPreference: boolean;
}) {
  if (input.isAdmin) return true;
  if (input.changesGuestCleaningPreference) return false;
  return input.status === null || isHousekeeperRoomStatus(input.status);
}
