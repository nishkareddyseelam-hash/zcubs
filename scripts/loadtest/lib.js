// Shared helpers for the k6 load-test scripts in this folder (D-017,
// docs/DECISION_LOG.md). Not a k6 test file itself — imported by the
// others via `import { ... } from "./lib.js"`.
import http from "k6/http";
import { check } from "k6";

export const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

/** Signs a brand-new founder account up via the real /api/signup endpoint
 * (never a seeded/fixture account — every load-test run creates real rows,
 * see README.md in this folder for how to point this at a disposable
 * database) and logs in via the real NextAuth credentials flow. k6 keeps a
 * cookie jar per VU automatically, so once this returns, every subsequent
 * http.* call from the same VU carries the resulting session cookie —
 * nothing further to wire up. */
export function signUpAndLogIn(emailPrefix, ageBand = "founder") {
  const email = `${emailPrefix}_${__VU}_${__ITER}_${Date.now()}@loadtest.example.com`;
  const password = "loadtest-pass-123";

  const signupRes = http.post(
    `${BASE_URL}/api/signup`,
    JSON.stringify({ name: "Load Test Founder", email, password, ageBand }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "signup" } }
  );
  check(signupRes, { "signup succeeded (200)": (r) => r.status === 200 });

  const csrfRes = http.get(`${BASE_URL}/api/auth/csrf`, { tags: { name: "auth_csrf" } });
  const csrfToken = csrfRes.json("csrfToken");

  const loginRes = http.post(
    `${BASE_URL}/api/auth/callback/credentials`,
    { csrfToken, email, password, json: "true" },
    { tags: { name: "auth_login" } }
  );
  check(loginRes, { "login accepted (200)": (r) => r.status === 200 });

  return { email };
}

export function get(path, tagName) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { name: tagName || path } });
  check(res, { [`${tagName || path}: status 200`]: (r) => r.status === 200 });
  return res;
}
