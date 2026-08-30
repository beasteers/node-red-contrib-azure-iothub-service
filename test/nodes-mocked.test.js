"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createHarness } = require("./helpers/node-red-harness");
const { installMocks, setQueryPages, getLatestRegistry, getLatestClient } = require("./helpers/mock-azure-sdks");

function clearModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.includes("/azure-iothub/") ||
        key.includes("/azure-iot-common/") ||
        key.includes("/@azure/event-hubs/") ||
        key.includes("/node-red-contrib-azure-iothub-service/lib/")) {
      delete require.cache[key];
    }
  }
}

function setupMockedHarness() {
  clearModuleCache();
  installMocks();
  const harness = createHarness();
  harness.registerNodes();
  return harness;
}

test("iothub-registry query paginates multiple pages of twins", async () => {
  const harness = setupMockedHarness();

  setQueryPages([
    [{ deviceId: "dev-a", properties: { reported: { temp: 20 } } }],
    [{ deviceId: "dev-b", properties: { reported: { temp: 21 } } }],
  ]);

  const node = harness.instantiate("iothub-registry", {
    id: "reg-query",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdA==",
    connectionstringType: "str",
  });

  node.emit("input", { method: "query", payload: "SELECT * FROM devices" });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const sent = node.sent.find((s) => Array.isArray(s.payload));
  assert.ok(sent, "expected a message with payload array");
  assert.equal(sent.payload.length, 2);
  assert.equal(sent.payload[0].deviceId, "dev-a");
  assert.equal(sent.payload[1].deviceId, "dev-b");
});

test("iothub-registry query handles errors", async () => {
  const harness = setupMockedHarness();

  setQueryPages([
    new Error("syntax error"),
  ]);

  const node = harness.instantiate("iothub-registry", {
    id: "reg-query-err",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdA==",
    connectionstringType: "str",
  });

  node.emit("input", { method: "query", payload: "BAD SQL" });
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(node.errors.some((e) => /syntax error/.test(e)), true);
  const errorSent = node.sent.find((s) => s.payload && s.payload.error);
  assert.ok(errorSent, "expected an error message");
  assert.match(errorSent.payload.error, /syntax error/);
});

test("iothub-registry query accumulates across three pages", async () => {
  const harness = setupMockedHarness();

  setQueryPages([
    [{ deviceId: "d1" }],
    [{ deviceId: "d2" }, { deviceId: "d3" }],
    [{ deviceId: "d4" }],
  ]);

  const node = harness.instantiate("iothub-registry", {
    id: "reg-query-3p",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdA==",
    connectionstringType: "str",
  });

  node.emit("input", { method: "query", payload: "SELECT * FROM devices" });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const sent = node.sent.find((s) => Array.isArray(s.payload));
  assert.ok(sent);
  assert.equal(sent.payload.length, 4);
  assert.deepEqual(
    sent.payload.map((d) => d.deviceId),
    ["d1", "d2", "d3", "d4"]
  );
});

test("eventhub-recv legacy inline connectionstring still works", () => {
  const harness = setupMockedHarness();

  const node = harness.instantiate("eventhub-recv", {
    id: "recv-legacy",
    name: "legacy-recv",
    eventhub: "",
    connectionstring: "Endpoint=sb://legacy.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=dGVzdA==;EntityPath=legacyhub",
    connectionstringType: "str",
    consumergroup: "legacygroup",
    consumergroupType: "str",
  });

  assert.equal(node.warnings.some((w) => /deprecated/.test(w)), true);
});

test("iothub-send node closes client on node close", async () => {
  const harness = setupMockedHarness();

  const node = harness.instantiate("iothub-send", {
    id: "send1",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdA==",
    connectionstringType: "str",
  });

  const client = getLatestClient();
  assert.ok(client);
  assert.equal(client.closed, false);

  await harness.close(node);
  assert.equal(client.closed, true);
});
