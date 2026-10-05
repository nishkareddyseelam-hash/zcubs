// Institution-side dashboard load test (D-017, docs/DECISION_LOG.md).
// Same read-only scope note as founder-journey.js applies here: this signs
// up a real account and reads /dashboard/institution repeatedly (the
// heaviest page in the app — it awaits several nested async components per
// programme: cohorts, applications, evaluations, mentor coverage, rubric).
// It does NOT create an institution/programme through the UI (that's a
// Server Action, same limitation as founder-journey.js) — instead it reads
// the page as a brand-new account would see it (the empty state), which is
// still a real, non-trivial render (RBAC checks, several queries) worth
// measuring under concurrency.
//
// Run with:
//   BASE_URL=http://localhost:3000 k6 run scripts/loadtest/institution-dashboard.js
// See README.md in this folder for full usage and thresholds.
import { sleep } from "k6";
import { signUpAndLogIn, get } from "./lib.js";

export const options = {
  scenarios: {
    institution_viewers: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "20s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{name:institution_dashboard}": ["p(95)<2000"],
  },
};

export default function () {
  signUpAndLogIn("loadtest_institution");
  get("/dashboard/institution", "institution_dashboard");
  sleep(2);
}
