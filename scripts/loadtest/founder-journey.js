// Authenticated founder-journey load test (D-017, docs/DECISION_LOG.md).
// Each virtual user signs up a REAL new account (via the real /api/signup
// endpoint), logs in through the real NextAuth credentials flow, and reads
// through the pages a founder actually visits most: dashboard home,
// Opportunity Cards, Validation Lab, Mentors, Evidence Passport, Guide.
//
// Scope, honestly stated: this covers PAGE READS only, not the write
// actions inside them (adding an Opportunity Card, submitting an
// experiment, etc.) — those are Next.js Server Actions, invoked over a
// wire protocol keyed to a build-specific action id that isn't stable
// enough to script against from outside the app. Every write path already
// has real coverage in tests/*.test.ts (43 tests as of D-016) exercising
// the same service-layer functions the UI calls. This script is about
// concurrent READ throughput and latency, which unit tests don't measure.
//
// Run with:
//   BASE_URL=http://localhost:3000 k6 run scripts/loadtest/founder-journey.js
// See README.md in this folder for full usage, thresholds, and the
// standing rule about never pointing this at a real production database
// (every run creates real user accounts).
import { sleep } from "k6";
import { signUpAndLogIn, get } from "./lib.js";

export const options = {
  scenarios: {
    founders: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "2m", target: 20 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
    "http_req_duration{name:dashboard}": ["p(95)<1200"],
  },
};

export default function () {
  signUpAndLogIn("loadtest_founder");

  get("/dashboard", "dashboard");
  sleep(1);
  get("/dashboard/opportunities", "opportunities");
  sleep(1);
  get("/dashboard/validation", "validation");
  sleep(1);
  get("/dashboard/mentors", "mentors");
  sleep(1);
  get("/dashboard/passport", "passport");
  sleep(1);
  get("/dashboard/guide", "guide");
  sleep(1);
}
