import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { alertDisplayTime, formatAlertToken, sortAcknowledgedAlerts } from "./alertListDisplay.js";

describe("formatAlertToken", () => {
  it("title-cases lowercase trigger and status values", () => {
    assert.equal(formatAlertToken("velocity"), "Velocity");
    assert.equal(formatAlertToken("active"), "Active");
    assert.equal(formatAlertToken("acknowledged"), "Acknowledged");
  });

  it("returns em dash for empty values", () => {
    assert.equal(formatAlertToken(null), "—");
    assert.equal(formatAlertToken(""), "—");
    assert.equal(formatAlertToken("   "), "—");
  });

  it("title-cases hyphenated and underscored tokens", () => {
    assert.equal(formatAlertToken("case_velocity"), "Case Velocity");
    assert.equal(formatAlertToken("multi-word"), "Multi Word");
  });
});

describe("alertDisplayTime", () => {
  it("uses createdAt for active alerts", () => {
    const alert = {
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      acknowledgedAt: null
    };
    assert.equal(alertDisplayTime(alert), "2026-01-01T00:00:00.000Z");
  });

  it("uses acknowledgedAt for acknowledged alerts", () => {
    const alert = {
      status: "acknowledged",
      createdAt: "2026-01-01T00:00:00.000Z",
      acknowledgedAt: "2026-06-18T12:00:00.000Z"
    };
    assert.equal(alertDisplayTime(alert), "2026-06-18T12:00:00.000Z");
  });

  it("keeps createdAt when acknowledgedAt is missing", () => {
    const alert = {
      status: "acknowledged",
      createdAt: "2026-01-01T00:00:00.000Z",
      acknowledgedAt: null
    };
    assert.equal(alertDisplayTime(alert), "2026-01-01T00:00:00.000Z");
  });

  it("does not use acknowledgedAt for active alerts", () => {
    const alert = {
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      acknowledgedAt: "2026-06-18T12:00:00.000Z"
    };
    assert.equal(alertDisplayTime(alert), "2026-01-01T00:00:00.000Z");
  });
});

describe("sortAcknowledgedAlerts", () => {
  it("sorts newest acknowledged first", () => {
    const alerts = [
      {
        id: 1,
        status: "acknowledged",
        acknowledgedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2025-12-01T00:00:00.000Z"
      },
      {
        id: 2,
        status: "acknowledged",
        acknowledgedAt: "2026-06-18T00:00:00.000Z",
        createdAt: "2025-11-01T00:00:00.000Z"
      },
      {
        id: 3,
        status: "acknowledged",
        acknowledgedAt: "2026-03-10T00:00:00.000Z",
        createdAt: "2025-10-01T00:00:00.000Z"
      }
    ];
    const sorted = sortAcknowledgedAlerts(alerts);
    assert.deepEqual(
      sorted.map((a) => a.id),
      [2, 3, 1]
    );
  });

  it("does not mutate the input array", () => {
    const alerts = [
      {
        id: 1,
        status: "acknowledged",
        acknowledgedAt: "2026-01-01T00:00:00.000Z",
        createdAt: "2025-12-01T00:00:00.000Z"
      },
      {
        id: 2,
        status: "acknowledged",
        acknowledgedAt: "2026-06-18T00:00:00.000Z",
        createdAt: "2025-11-01T00:00:00.000Z"
      }
    ];
    const copy = [...alerts];
    sortAcknowledgedAlerts(alerts);
    assert.deepEqual(alerts, copy);
  });
});
