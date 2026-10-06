import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createHash } from "node:crypto";
import ts from "typescript";
import { canChangeApplicationStage } from "../lib/recruiting/application-actions";

test("terminal stages block offers, rejections and conversion until reopened", () => {
  for (const stage of ["hired", "rejected", "archived"]) {
    for (const action of ["invited", "offer", "rejected", "hired"]) assert.equal(canChangeApplicationStage(stage, action), false);
  }
  assert.equal(canChangeApplicationStage("rejected", "new"), true);
  assert.equal(canChangeApplicationStage("archived", "new"), true);
  assert.equal(canChangeApplicationStage("hired", "archived"), true);
  assert.equal(canChangeApplicationStage("OFFER", "OFFER"), false);
  assert.equal(canChangeApplicationStage("NEW", "INVITED"), true);
});

test("preview never sends; sending uses preview; changes invalidate confirmation", async () => {
  const sent: unknown[] = [];
  let autoSend = true;
  const application = { email: "maria@example.com", locale: "en", firstName: "Maria", lastName: "B", job: { title: "Reception", titleDe: "", titleIt: "" }, hotelTenant: { hotelNameEn: "Hotel", hotelNameDe: "", hotelNameIt: "", email: "hotel@example.com" } };
  const exports = {} as typeof import("../lib/recruiting/send-recruiting-email");
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/recruiting/send-recruiting-email.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, process: { env: {} }, console,
    require(name: string) {
      if (name === "server-only") return {};
      if (name === "node:crypto") return { createHash };
      if (name === "./email-validation") return { isValidApplicationEmail: (value: string) => value.includes("@") };
      if (name.includes("generated/prisma")) return { Prisma: {} };
      if (name === "../prisma") return { prisma: {
        recruitingApplication: { findFirst: async () => application },
        recruitingEmailTemplate: { findMany: async () => [{ category: "OFFER", locale: "en", autoSend, subject: "Offer: {{job_name}}", body: "Hello {{name}}" }] },
        recruitingSettings: { findUnique: async () => null },
      } };
      if (name === "../mail/smtp") return { sendMail: async (mail: unknown) => { sent.push(mail); return { sent: true }; } };
      if (name === "./email-template-fields") return { EMAIL_LOCALES: ["en", "de", "it"], seedEmailTemplateRows: () => [] };
      throw new Error(name);
    },
  });
  const input = { hotelTenantId: "hotel", category: "offer", applicationId: "app" } as const;
  const preview = await exports.prepareRecruitingTemplateEmail(input);
  assert.equal(sent.length, 0);
  assert.equal(preview.subject, "Offer: Reception");
  assert.equal(preview.text, "Hello Maria B");
  assert.equal(preview.willSend, true);
  const token = exports.recruitingConfirmationToken("offer", "version1", preview);
  assert.notEqual(token, exports.recruitingConfirmationToken("offer", "version2", preview));
  assert.notEqual(token, exports.recruitingConfirmationToken("offer", "version1", { ...preview, to: "other@example.com" }));
  await exports.sendPreparedRecruitingEmail(preview);
  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { text: string }).text, preview.text);
  autoSend = false;
  const disabled = await exports.prepareRecruitingTemplateEmail(input);
  assert.equal(disabled.willSend, false);
  await exports.sendPreparedRecruitingEmail(disabled);
  assert.equal(sent.length, 1);
});

test("status API rejects missing or stale confirmation before mutation", async () => {
  const exports = {} as typeof import("../app/api/recruiting/applications/[id]/route");
  let mutations = 0;
  const db = {
    recruitingApplication: { findFirst: async () => ({ stage: "NEW", updatedAt: new Date("2026-10-07T00:00:00Z") }) },
    $transaction: async () => { mutations++; throw new Error("Should not mutate"); },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("app/api/recruiting/applications/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, Response, Request, URL, console,
    require(name: string) {
      if (name.endsWith("application-actions")) return { canChangeApplicationStage };
      if (name.endsWith("/prisma")) return { prisma: db };
      if (name.endsWith("/access")) return { recruitingActor: async () => ({ id: "actor", hotel_tenant_id: "hotel" }) };
      if (name.endsWith("application-fields")) return { isUuid: () => true, toDbStage: (stage: string) => stage.toUpperCase() };
      if (name.endsWith("send-recruiting-email")) return { prepareRecruitingTemplateEmail: async () => ({}), recruitingConfirmationToken: () => "current-token" };
      return {};
    },
  });
  for (const payload of [{ stage: "offer" }, { stage: "rejected", confirmationToken: "stale-token" }]) {
    const response = await exports.PATCH(new Request("http://localhost/api/test", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }), { params: Promise.resolve({ id: "application" }) });
    assert.equal(response.status, 409);
  }
  assert.equal(mutations, 0);
});
