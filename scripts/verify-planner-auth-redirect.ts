import assert from "node:assert/strict";

import {
  buildLoginCallbackHref,
  buildPlannerCallbackPath
} from "../app/planner/auth-redirect";

function assertCallback(input: {
  route: "/planner/wedding" | "/planner/funeral";
  params: Record<string, string | undefined>;
  expectedPath: string;
  expectedHref: string;
}) {
  const callbackPath = buildPlannerCallbackPath(input.route, input.params);
  assert.equal(callbackPath, input.expectedPath);
  assert.equal(buildLoginCallbackHref(callbackPath), input.expectedHref);
}

assertCallback({
  route: "/planner/wedding",
  params: { planId: "abc", step: "3" },
  expectedPath: "/planner/wedding?planId=abc&step=3",
  expectedHref: "/login?callbackUrl=%2Fplanner%2Fwedding%3FplanId%3Dabc%26step%3D3"
});

assertCallback({
  route: "/planner/funeral",
  params: { planId: "funeral plan", step: "4" },
  expectedPath: "/planner/funeral?planId=funeral+plan&step=4",
  expectedHref: "/login?callbackUrl=%2Fplanner%2Ffuneral%3FplanId%3Dfuneral%2Bplan%26step%3D4"
});

assertCallback({
  route: "/planner/funeral",
  params: { planId: "funeral-id", step: "9" },
  expectedPath: "/planner/funeral?planId=funeral-id&step=9",
  expectedHref: "/login?callbackUrl=%2Fplanner%2Ffuneral%3FplanId%3Dfuneral-id%26step%3D9"
});

console.log("[verify-planner-auth-redirect] success");
