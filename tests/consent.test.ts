// Privacy & Consent (D-010, docs/DECISION_LOG.md). Run with: npm test
// (requires DATABASE_URL — see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as consent from "../src/lib/consent";

async function makeUser(email: string, ageBand = "explorer") {
  const id = newId();
  await q(
    `INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x',$4,$5) ON CONFLICT (email) DO NOTHING`,
    [id, email, email, ageBand, now()]
  );
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

test("D-010: a guardian relationship starts pending and only becomes confirmed via the real confirm token", async () => {
  const explorerId = await makeUser(`consent_explorer_a_${Date.now()}@example.com`, "explorer");
  const { relationship, confirmToken } = await consent.addGuardianRelationship(explorerId, {
    guardianName: "Test Guardian", guardianEmail: `guardian_a_${Date.now()}@example.com`,
  });
  assert.equal(relationship.status, "pending");
  assert.ok(await consent.hasConfirmedGuardianConsent(explorerId).then((v) => v === false));

  await assert.rejects(
    () => consent.confirmGuardianRelationship(relationship.id, "wrong-token"),
    /Invalid confirmation link/,
    "a wrong token must not confirm the relationship"
  );

  const confirmed = await consent.confirmGuardianRelationship(relationship.id, confirmToken);
  assert.equal(confirmed.status, "confirmed");
  assert.equal(await consent.hasConfirmedGuardianConsent(explorerId), true);

  // Confirming writes a real consent_records row, not just a status flip.
  const history = await consent.listConsentHistory(explorerId);
  assert.ok(history.some((h) => h.consentType === "guardian_consent" && h.granted === true && h.grantedBy === "guardian"));
});

test("D-010: revoking a confirmed guardian relationship writes a granted=false consent record and flips hasConfirmedGuardianConsent", async () => {
  const explorerId = await makeUser(`consent_explorer_b_${Date.now()}@example.com`, "explorer");
  const { relationship, confirmToken } = await consent.addGuardianRelationship(explorerId, {
    guardianName: "Test Guardian B", guardianEmail: `guardian_b_${Date.now()}@example.com`,
  });
  await consent.confirmGuardianRelationship(relationship.id, confirmToken);
  assert.equal(await consent.hasConfirmedGuardianConsent(explorerId), true);

  await consent.revokeGuardianRelationship(relationship.id);
  assert.equal(await consent.hasConfirmedGuardianConsent(explorerId), false);

  const history = await consent.listConsentHistory(explorerId);
  const latestGuardianConsent = history.find((h) => h.consentType === "guardian_consent");
  assert.equal(latestGuardianConsent?.granted, false);
});

test("D-010: getConsentStatus returns only the latest decision per consent type, not the full history", async () => {
  const userId = await makeUser(`consent_status_${Date.now()}@example.com`, "founder");
  await consent.recordConsent(userId, "data_processing", true, "self");
  await consent.recordConsent(userId, "data_processing", false, "self", "changed my mind");
  await consent.recordConsent(userId, "data_processing", true, "self", "granted again");

  const status = await consent.getConsentStatus(userId);
  assert.equal(status["data_processing"].granted, true);
  assert.equal(status["data_processing"].note, "granted again");

  const history = await consent.listConsentHistory(userId);
  assert.equal(history.length, 3, "the append-only log must keep every decision even though getConsentStatus collapses to the latest");
});

test("D-010: exportUserData returns a real, live export of the founder's own rows and completes the originating request", async () => {
  const userId = await makeUser(`consent_export_${Date.now()}@example.com`, "founder");
  await q(
    `INSERT INTO opportunities (id,user_id,title,customer,problem,evidence_note,mission,created_at)
     VALUES ($1,$2,'Test Opp','Test customer','Test problem','','Test mission',$3)`,
    [newId(), userId, now()]
  );
  const req = await consent.requestDataAction(userId, "export", "curious what's stored");
  assert.equal(req.status, "pending");

  const data = await consent.exportUserData(userId, req.id);
  assert.ok(Array.isArray(data["Opportunity Forest entries"]));
  assert.equal((data["Opportunity Forest entries"] as unknown[]).length, 1);
  assert.equal((data.account as { email: string }).email.includes("consent_export"), true);
  assert.equal("passwordHash" in (data.account as object), false, "export must never include the password hash");

  const requests = await consent.listDataRequests(userId);
  assert.equal(requests.find((r) => r.id === req.id)?.status, "completed");
});

test("D-010: executeDataDeletion removes a founder's owned rows and anonymizes the account, in one transaction", async () => {
  const userId = await makeUser(`consent_delete_${Date.now()}@example.com`, "founder");
  await q(
    `INSERT INTO opportunities (id,user_id,title,customer,problem,evidence_note,mission,created_at)
     VALUES ($1,$2,'To be deleted','c','p','','m',$3)`,
    [newId(), userId, now()]
  );
  const req = await consent.requestDataAction(userId, "deletion", "please remove me");

  await consent.executeDataDeletion(userId, req.id);

  const remainingOpps = await q(`SELECT * FROM opportunities WHERE user_id=$1`, [userId]);
  assert.equal(remainingOpps.length, 0);

  const userRow = (await q<{ name: string; email: string }>(`SELECT name, email FROM users WHERE id=$1`, [userId]))[0];
  assert.equal(userRow.name, "Deleted user");
  assert.ok(userRow.email.startsWith("deleted-"));

  const requests = await consent.listDataRequests(userId);
  assert.equal(requests.find((r) => r.id === req.id)?.status, "completed");
});
