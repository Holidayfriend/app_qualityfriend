import assert from "node:assert/strict";
import { test } from "node:test";
import { canMutateRoomState, housekeeperRoomStatuses, isHousekeeperRoomStatus } from "../lib/housekeeping/room-access-policy";

test("housekeepers can set only operational cleaning statuses", () => {
  assert.deepEqual(housekeeperRoomStatuses, ["dirty", "cleaning", "clean"]);
  for (const status of housekeeperRoomStatuses) {
    assert.equal(isHousekeeperRoomStatus(status), true);
    assert.equal(canMutateRoomState({ isAdmin: false, status, changesGuestCleaningPreference: false }), true);
  }
  for (const status of ["inspected", "inspectionInProgress", "unassigned", "noCleaningDesired"]) {
    assert.equal(isHousekeeperRoomStatus(status), false);
    assert.equal(canMutateRoomState({ isAdmin: false, status, changesGuestCleaningPreference: false }), false);
  }
});

test("housekeepers cannot change guest cleaning preference", () => {
  assert.equal(canMutateRoomState({ isAdmin: false, status: "clean", changesGuestCleaningPreference: true }), false);
  assert.equal(canMutateRoomState({ isAdmin: false, status: null, changesGuestCleaningPreference: true }), false);
});

test("housekeeping admins retain all room controls", () => {
  for (const status of [null, "dirty", "cleaning", "clean", "inspected", "inspectionInProgress", "unassigned", "noCleaningDesired"]) {
    assert.equal(canMutateRoomState({ isAdmin: true, status, changesGuestCleaningPreference: true }), true);
  }
});
