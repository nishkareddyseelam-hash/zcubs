// Mentor self-attestation (D-013, docs/DECISION_LOG.md). Run with:
// npm test (requires DATABASE_URL — see docs/DEPLOYMENT.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as mentorship from "../src/lib/mentorship";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

const BASE = {
  headline: "h", bio: "", expertiseTags: "fundraising", sectors: "", mentorshipMode: "virtual",
  languages: "English", capacityPerMonth: 4,
};

test("D-013: a mentor profile cannot be created without describing what qualifies the mentor", async () => {
  const userId = await makeUser(`attest_no_creds_${Date.now()}@example.com`);
  await assert.rejects(
    () => mentorship.upsertMentorProfile(userId, { ...BASE, credentialsNote: "", attestationConfirmed: true }),
    /Describe what qualifies you/,
  );
});

test("D-013: a mentor profile cannot be created without confirming the attestation checkbox", async () => {
  const userId = await makeUser(`attest_no_check_${Date.now()}@example.com`);
  await assert.rejects(
    () => mentorship.upsertMentorProfile(userId, { ...BASE, credentialsNote: "5 years as a PM", attestationConfirmed: false }),
    /confirm the attestation checkbox/,
  );
});

test("D-013: a valid attestation creates the profile with attestation_confirmed=true and a real attested_at timestamp", async () => {
  const userId = await makeUser(`attest_valid_${Date.now()}@example.com`);
  const profile = await mentorship.upsertMentorProfile(userId, { ...BASE, credentialsNote: "5 years as a PM at a D2C startup", attestationConfirmed: true });
  assert.equal(profile.credentialsNote, "5 years as a PM at a D2C startup");
  assert.equal(profile.attestationConfirmed, true);
  assert.ok(profile.attestedAt);
});

test("D-013: an optional reference contact is stored and returned when provided, and is absent by default", async () => {
  const userId = await makeUser(`attest_ref_${Date.now()}@example.com`);
  const profile = await mentorship.upsertMentorProfile(userId, {
    ...BASE, credentialsNote: "Ran GTM for two launches", attestationConfirmed: true,
    referenceName: "Priya S", referenceEmail: "priya@example.com", referenceRelationship: "Former manager",
  });
  assert.equal(profile.referenceName, "Priya S");
  assert.equal(profile.referenceEmail, "priya@example.com");

  const userId2 = await makeUser(`attest_noref_${Date.now()}@example.com`);
  const profile2 = await mentorship.upsertMentorProfile(userId2, { ...BASE, credentialsNote: "Built a startup", attestationConfirmed: true });
  assert.equal(profile2.referenceName, "");
});

test("D-013: editing an existing profile re-confirms the attestation — omitting credentials on an edit is rejected the same as on creation", async () => {
  const userId = await makeUser(`attest_edit_${Date.now()}@example.com`);
  await mentorship.upsertMentorProfile(userId, { ...BASE, credentialsNote: "Initial credentials", attestationConfirmed: true });

  await assert.rejects(
    () => mentorship.upsertMentorProfile(userId, { ...BASE, credentialsNote: "", attestationConfirmed: true }),
    /Describe what qualifies you/,
  );

  const updated = await mentorship.upsertMentorProfile(userId, { ...BASE, credentialsNote: "Updated credentials", attestationConfirmed: true });
  assert.equal(updated.credentialsNote, "Updated credentials");
});

test("D-013: listActiveMentors surfaces the self-attestation fields (not just the base profile columns) for the match cards", async () => {
  const userId = await makeUser(`attest_list_${Date.now()}@example.com`);
  await mentorship.upsertMentorProfile(userId, { ...BASE, credentialsNote: "Visible in listing", attestationConfirmed: true });
  const mentors = await mentorship.listActiveMentors();
  const found = mentors.find((m) => m.userId === userId);
  assert.ok(found);
  assert.equal(found?.credentialsNote, "Visible in listing");
  assert.equal(found?.attestationConfirmed, true);
});
