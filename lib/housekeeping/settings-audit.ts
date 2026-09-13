type Names = { nameEn: string | null; nameDe: string | null; nameIt: string | null };

export function categoryAuditSnapshot(category: Names & {
  expressMinutes: number | null; normalMinutes: number | null; departureMinutes: number | null; finalMinutes: number | null;
  cleaningFrequency: string | null; linenFrequency: string | null;
}) {
  return {
    en: category.nameEn, de: category.nameDe, it: category.nameIt,
    expressMinutes: category.expressMinutes, normalMinutes: category.normalMinutes,
    departureMinutes: category.departureMinutes, finalMinutes: category.finalMinutes,
    cleaningFrequency: category.cleaningFrequency, linenFrequency: category.linenFrequency,
  };
}

export function roomAuditSnapshot(room: Names & { number: string; categoryId: string | null; floorId: string | null }, checklist: {
  roomChecksEn: unknown; roomChecksDe: unknown; roomChecksIt: unknown;
  arrivalChecksEn: unknown; arrivalChecksDe: unknown; arrivalChecksIt: unknown;
} | null) {
  return {
    en: room.nameEn || room.number, de: room.nameDe || room.number, it: room.nameIt || room.number,
    number: room.number, categoryId: room.categoryId, floorId: room.floorId,
    checklist: checklist ? {
      roomChecksEn: checklist.roomChecksEn, roomChecksDe: checklist.roomChecksDe, roomChecksIt: checklist.roomChecksIt,
      arrivalChecksEn: checklist.arrivalChecksEn, arrivalChecksDe: checklist.arrivalChecksDe, arrivalChecksIt: checklist.arrivalChecksIt,
    } : null,
  };
}
