// Unauthenticated smoke test (D-017, docs/DECISION_LOG.md) — checks the
// public pages a not-yet-signed-up visitor hits stay up and fast under
// modest concurrent load. No login, no writes. Run with:
//   BASE_URL=http://localhost:3000 k6 run scripts/loadtest/smoke.js
// See README.md in this folder for full usage, thresholds, and the
// standing rule about never pointing this at a real production database.
import { sleep } from "k6";
import { get } from "./lib.js";

export const options = {
  scenarios: {
    smoke: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // fewer than 1% of requests may fail
    http_req_duration: ["p(95)<800"], // 95% of requests under 800ms
  },
};

export default function () {
  get("/", "home");
  sleep(1);
  get("/login", "login_page");
  sleep(1);
  get("/signup", "signup_page");
  sleep(1);
}
