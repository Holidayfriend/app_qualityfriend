export type HousekeepingRoomInput = {
  number: string;
  cleanliness: "UNKNOWN" | "DIRTY" | "CLEANING" | "CLEAN" | "INSPECTED" | null;
  noService: boolean;
  isExpress: boolean;
};

export function housekeepingDashboardSummary(rooms: HousekeepingRoomInput[]) {
  const dirty: string[] = [];
  const cleaning: string[] = [];
  const ready: string[] = [];
  const inspected: string[] = [];
  const express: string[] = [];
  const noService: string[] = [];

  for (const room of rooms) {
    if (room.noService) {
      noService.push(room.number);
      continue;
    }
    if (room.cleanliness === "DIRTY") dirty.push(room.number);
    else if (room.cleanliness === "CLEANING") cleaning.push(room.number);
    else if (room.cleanliness === "CLEAN") ready.push(room.number);
    else if (room.cleanliness === "INSPECTED") inspected.push(room.number);
    if (room.isExpress && room.cleanliness === "DIRTY") express.push(room.number);
  }

  const due = rooms.filter((room) => !room.noService).length;
  const readyCount = ready.length + inspected.length;
  return {
    dirty: dirty.length,
    cleaning: cleaning.length,
    ready: ready.length,
    inspected: inspected.length,
    roomsDue: due,
    roomsReady: readyCount,
    roomsOpen: Math.max(0, due - readyCount),
    expressRooms: express,
    noServiceRooms: noService,
  };
}

export function occupancyPercent(occupied: number, capacity: number) {
  if (capacity <= 0) return 0;
  return Math.round((occupied / capacity) * 100);
}
