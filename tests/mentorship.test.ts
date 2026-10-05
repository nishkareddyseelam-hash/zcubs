// Mentor Discovery & Matching — access-control, immutability, and D-009
// depth tests (capacity enforcement, capacity-aware ranking, institutional
// coverage). Run with: npm test. Requires DATABASE_URL to point at a real
// Postgres with the schema applied.
import { test } from "node:test";
import assert from "node:assert/strict";
import { q, newId, now } from "../src/lib/pg";
import * as mentorship from "../src/lib/mentorship";
import * as inst from "../src/lib/institutional";

async function makeUser(email: string) {
  const id = newId();
  await q(`INSERT INTO users (id,name,email,password_hash,age_band,created_at) VALUES ($1,$2,$3,'x','founder',$4) ON CONFLICT (email) DO NOTHING`, [id, email, email, now()]);
  const row = (await q<{ id: string }>(`SELECT id FROM users WHERE email=$1`, [email]))[0];
  return row.id;
}

test("a founder cannot respond to a mentorship request that isn't theirs to accept", async () => {
  const founder = await makeUser(`ment_founder_a_${Date.now()}@example.com`);
  const mentor = await makeUser(`ment_mentor_a_${Date.now()}@example.com`);
  const impostor = await makeUser(`ment_impostor_a_${Date.now()}@example.com`);
  await mentorship.upsertMentorProfile(mentor, {
    headline: "Test mentor", bio: "", expertiseTags: "pricing", sectors: "D2C",
    mentorshipMode: "virtual", languages: "English", capacityPerMonth: 4,
    credentialsNote: "Test credentials for automated testing", attestationConfirmed: true,
  });
  const request = await mentorship.requestMentorship(founder, mentor, "Pricing help", "");

  await assert.rejects(
    () => mentorship.respondToRequest(impostor, request.id, true),
    /Not your request/,
    "A user who isn't the mentor on this request must not be able to accept it"
  );

  // Sanity: the real mentor can.
  await mentorship.respondToRequest(mentor, request.id, true);
  const founderView = await mentorship.listRequestsForFounder(founder);
  assert.equal(founderView.find((r) => r.id === request.id)?.status, "accepted");
});

test("only a participant in a mentorship (founder or mentor) can log a session against it", async () => {
  const founder = await makeUser(`ment_founder_b_${Date.now()}@example.com`);
  const mentor = await makeUser(`ment_mentor_b_${Date.now()}@example.com`);
  const outsider = await makeUser(`ment_outsider_b_${Date.now()}@example.com`);
  await mentorship.upsertMentorProfile(mentor, {
    headline: "Test mentor", bio: "", expertiseTags: "GTM", sectors: "EdTech",
    mentorshipMode: "virtual", languages: "English", capacityPerMonth: 4,
    credentialsNote: "Test credentials for automated testing", attestationConfirmed: true,
  });
  const request = await mentorship.requestMentorship(founder, mentor, "GTM help", "");
  await mentorship.respondToRequest(mentor, request.id, true);

  await assert.rejects(
    () => mentorship.logSession(outsider, request.id, "2026-08-27", "Should fail", ""),
    /Not part of this mentorship/,
    "A user who is neither the founder nor the mentor on this request must not be able to log a session"
  );

  // Sanity: both real participants can.
  await mentorship.logSession(founder, request.id, "2026-08-27", "Founder-logged session", "");
  await mentorship.logSession(mentor, request.id, "2026-08-28", "Mentor-logged session", "");
  const sessions = await mentorship.listSessionsForRequest(request.id);
  assert.equal(sessions.length, 2);
  assert.ok(sessions.every((s) => typeof s.sessionDate === "string"), "session_date must serialize as a plain string, not a Date object (React error #31 regression)");
});

test("D-009: a mentor cannot accept a request past their own stated capacity", async () => {
  const mentor = await makeUser(`ment_mentor_cap_${Date.now()}@example.com`);
  const founder1 = await makeUser(`ment_founder_cap1_${Date.now()}@example.com`);
  const founder2 = await makeUser(`ment_founder_cap2_${Date.now()}@example.com`);
  await mentorship.upsertMentorProfile(mentor, {
    headline: "Capacity-limited mentor", bio: "", expertiseTags: "fundraising", sectors: "D2C",
    mentorshipMode: "virtual", languages: "English", capacityPerMonth: 1,
    credentialsNote: "Test credentials for automated testing", attestationConfirmed: true,
  });
  const req1 = await mentorship.requestMentorship(founder1, mentor, "Help 1", "");
  const req2 = await mentorship.requestMentorship(founder2, mentor, "Help 2", "");

  await mentorship.respondToRequest(mentor, req1.id, true);
  await assert.rejects(
    () => mentorship.respondToRequest(mentor, req2.id, true),
    /capacity/,
    "A mentor with capacityPerMonth=1 and one active mentee must not be able to accept a second"
  );

  // Freeing a slot by completing the first should allow the second to be accepted.
  await mentorship.markRequestCompleted(mentor, req1.id);
  await mentorship.respondToRequest(mentor, req2.id, true);
  const mentorView = await mentorship.listRequestsForMentor(mentor);
  assert.equal(mentorView.find((r) => r.id === req2.id)?.status, "accepted");
});

test("D-009: ranked matches show real overlap first, then real available capacity, both disclosed on the match", async () => {
  const founder = await makeUser(`ment_founder_rank_${Date.now()}@example.com`);
  const mentorFull = await makeUser(`ment_mentor_full_${Date.now()}@example.com`);
  const mentorOpen = await makeUser(`ment_mentor_open_${Date.now()}@example.com`);
  const otherFounder = await makeUser(`ment_founder_rank2_${Date.now()}@example.com`);

  // Identical expertise/sectors so tag-overlap score ties; capacity should break the tie.
  await mentorship.upsertMentorProfile(mentorFull, {
    headline: "Full mentor", bio: "", expertiseTags: "pricing, gtm", sectors: "edtech",
    mentorshipMode: "virtual", languages: "English", capacityPerMonth: 1,
    credentialsNote: "Test credentials for automated testing", attestationConfirmed: true,
  });
  await mentorship.upsertMentorProfile(mentorOpen, {
    headline: "Open mentor", bio: "", expertiseTags: "pricing, gtm", sectors: "edtech",
    mentorshipMode: "virtual", languages: "English", capacityPerMonth: 1,
    credentialsNote: "Test credentials for automated testing", attestationConfirmed: true,
  });
  const fullReq = await mentorship.requestMentorship(otherFounder, mentorFull, "fill it up", "");
  await mentorship.respondToRequest(mentorFull, fullReq.id, true);

  await q(
    `INSERT INTO founder_profiles (id,user_id,strengths,develop,time,capital,risk,categories,updated_at) VALUES ($1,$2,'','','','','Medium',$3,$4)`,
    [newId(), founder, "pricing", now()]
  );

  const matches = await mentorship.matchMentorsForFounder(founder);
  const fullMatch = matches.find((m) => m.mentor.userId === mentorFull);
  const openMatch = matches.find((m) => m.mentor.userId === mentorOpen);
  assert.ok(fullMatch && openMatch);
  assert.equal(fullMatch!.atCapacity, true);
  assert.equal(openMatch!.atCapacity, false);
  assert.equal(fullMatch!.mentor.activeMenteeCount, 1);
  // Same tag overlap, but the mentor with room must rank above the one at capacity.
  assert.ok(matches.indexOf(openMatch!) < matches.indexOf(fullMatch!), "a mentor with capacity headroom should rank above an equally-relevant mentor at capacity");
});

test("D-009: institutional Mentor Coverage is a live, honest aggregate over a cohort's real founders", async () => {
  const owner = await makeUser(`ment_owner_cov_${Date.now()}@example.com`);
  const mentor = await makeUser(`ment_mentor_cov_${Date.now()}@example.com`);
  const founderMatched = await makeUser(`ment_founder_cov1_${Date.now()}@example.com`);
  const founderUnmatched = await makeUser(`ment_founder_cov2_${Date.now()}@example.com`);

  const institution = await inst.createInstitution(owner, { name: `Coverage Test Inst ${Date.now()}` });
  const programme = await inst.createProgramme(owner, institution.id, { title: "Coverage Test Programme" });
  const cohort = await inst.createCohort(owner, programme.id, "Coverage Test Cohort");
  await inst.enrolFounderInCohort(owner, cohort.id, founderMatched);
  await inst.enrolFounderInCohort(owner, cohort.id, founderUnmatched);

  await mentorship.upsertMentorProfile(mentor, {
    headline: "Coverage mentor", bio: "", expertiseTags: "ops", sectors: "logistics",
    mentorshipMode: "virtual", languages: "English", capacityPerMonth: 4,
    credentialsNote: "Test credentials for automated testing", attestationConfirmed: true,
  });
  const req = await mentorship.requestMentorship(founderMatched, mentor, "ops help", "");
  await mentorship.respondToRequest(mentor, req.id, true);
  await mentorship.logSession(mentor, req.id, "2026-08-27", "Kickoff", "");
  await mentorship.setNextCheckin(mentor, req.id, "2020-01-01"); // deliberately in the past

  const coverage = await mentorship.computeMentorshipCoverageForCohort(cohort.id);
  assert.equal(coverage.founderCount, 2);
  assert.equal(coverage.foundersWithActiveOrCompletedMentor, 1, "only the matched founder should count, not the unmatched one");
  assert.equal(coverage.totalSessionsLogged, 1);
  assert.equal(coverage.overdueCheckins, 1, "a past next_checkin_at on an accepted request must count as overdue");
});
