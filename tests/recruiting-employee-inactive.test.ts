import assert from "node:assert/strict";
import test from "node:test";
import { isValidEmployeeTaxId, normalizeCertificatesInput, parseEmployeePatch } from "../lib/recruiting/employee-fields";

test("marking inactive requires a reason and an end date", () => {
  assert.equal(parseEmployeePatch({ status: "inactive" }), null);
  assert.equal(parseEmployeePatch({ status: "inactive", inactiveReason: "pension" }), null);
  const patch = parseEmployeePatch({ status: "inactive", inactiveReason: "resignation", employedTo: "2026-07-31" });
  assert.equal(patch?.status, "INACTIVE");
  assert.equal(patch?.inactiveReason, "RESIGNATION");
  assert.equal(patch?.employedTo?.toISOString().slice(0, 10), "2026-07-31");
});

test("marking active clears the reason and end date", () => {
  const patch = parseEmployeePatch({ status: "active" });
  assert.equal(patch?.status, "ACTIVE");
  assert.equal(patch?.inactiveReason, null);
  assert.equal(patch?.employedTo, null);
});

test("personnel file patch accepts department, tags and employment dates", () => {
  const departmentId = "11111111-1111-4111-8111-111111111111";
  const patch = parseEmployeePatch({
    departmentId,
    tags: ["Service", ""],
    employedFrom: "2022-03-01",
    employedTo: "2025-12-31",
  });
  assert.equal(patch?.departmentId, departmentId);
  assert.deepEqual(patch?.tags, ["Service"]);
  assert.equal(patch?.employedFrom?.toISOString().slice(0, 10), "2022-03-01");
  assert.equal(parseEmployeePatch({ departmentId: "not-a-uuid" }), null);
});

test("tax code rejects ABC and accepts a codice fiscale", () => {
  assert.equal(isValidEmployeeTaxId("ABC"), false);
  assert.equal(isValidEmployeeTaxId(""), true);
  assert.equal(isValidEmployeeTaxId("RSSMRA85T10A562S"), true);
  assert.equal(parseEmployeePatch({ taxId: "ABC" }), null);
  assert.equal(parseEmployeePatch({ taxId: "rssmra85t10a562s" })?.taxId, "RSSMRA85T10A562S");
});
test("training valid-until before completion is rejected", () => {
  assert.equal(normalizeCertificatesInput([{ name: "haccp", completed: "2026-06-01", expires: "2026-01-01" }]), null);
  const saved = normalizeCertificatesInput([{ name: "firstAid", completed: "2026-01-01", expires: "2026-06-01" }]);
  assert.equal(saved?.[0]?.name, "firstAid");
  assert.equal(normalizeCertificatesInput([{ name: "fireSafety", completed: "2026-03-01", expires: "2026-03-01" }])?.[0]?.name, "fireSafety");
});
