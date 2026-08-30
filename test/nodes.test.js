"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createHarness } = require("./helpers/node-red-harness");

test("getField utility resolves all types", async () => {
  const { getField } = require("../lib/utils");
  const { EventEmitter } = require("node:events");

  const node = new EventEmitter();
  node.credentials = { credKey: "cred-value" };
  const flowStore = new Map([["fk", "flow-value"]]);
  const globalStore = new Map([["gk", "global-value"]]);
  node.context = () => ({
    flow: { get: (k) => flowStore.get(k) },
    global: { get: (k) => globalStore.get(k) },
  });

  assert.equal(getField(node, { conn: "plain", connType: "str" }, "conn"), "plain");
  assert.equal(getField(node, { credKey: "cred-id", credKeyType: "cred" }, "credKey"), "cred-value");
  assert.equal(getField(node, { conn: "gk", connType: "global" }, "conn"), "global-value");
  assert.equal(getField(node, { conn: "fk", connType: "flow" }, "conn"), "flow-value");

  process.env.TEST_ENV_VAR = "env-value";
  try {
    assert.equal(getField(node, { conn: "TEST_ENV_VAR", connType: "env" }, "conn"), "env-value");
  } finally {
    delete process.env.TEST_ENV_VAR;
  }

  assert.equal(getField(node, { n: "42", nType: "num" }, "n"), 42);
  assert.equal(getField(node, { b: "true", bType: "bool" }, "b"), true);
  assert.deepEqual(getField(node, { j: '{"a":1}', jType: "json" }, "j"), { a: 1 });
});

test("eventhub-recv node fails gracefully with missing connection string", () => {
  const harness = createHarness();
  harness.registerNodes();

  const node = harness.instantiate("eventhub-recv", {
    id: "recv1",
    name: "test-recv",
    eventhub: "",
  });

  assert.equal(node.errors.some((e) => /Connection string is required/.test(e)), true);
  assert.equal(node.statuses.some((s) => /Connection string is required/.test(s.text)), true);
});

test("eventhub-recv node resolves values from config node", () => {
  const harness = createHarness();
  harness.registerNodes();

  const configNode = harness.instantiate("eventhub-config", {
    id: "eh-cfg-1",
    connectionstring: "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=dGVzdA==;EntityPath=testhub",
    connectionstringType: "str",
    consumergroup: "mygroup",
    consumergroupType: "str",
  });

  assert.equal(configNode.connectionstring, "Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=test;SharedAccessKey=dGVzdA==;EntityPath=testhub");
  assert.equal(configNode.consumergroup, "mygroup");
});

test("iothub-registry node rejects unknown method", () => {
  const harness = createHarness();
  harness.registerNodes();

  const node = harness.instantiate("iothub-registry", {
    id: "reg1",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==",
    connectionstringType: "str",
  });

  node.emit("input", { method: "no-such-method", deviceId: "dev1" });

  assert.equal(node.errors.some((e) => /Invalid method: no-such-method/.test(e)), true);
  assert.equal(node.statuses.some((s) => /Invalid method: no-such-method/.test(s.text)), true);
});

test("iothub-registry node requires deviceId for device methods", () => {
  const harness = createHarness();
  harness.registerNodes();

  const node = harness.instantiate("iothub-registry", {
    id: "reg2",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==",
    connectionstringType: "str",
  });

  node.emit("input", { method: "device" });
  assert.equal(node.errors.some((e) => /No msg\.deviceId set/.test(e)), true);

  node.emit("input", { method: "twin" });
  assert.equal(node.errors.some((e) => /No msg\.deviceId set/.test(e)), true);

  node.emit("input", { method: "twin.update" });
  assert.equal(node.errors.some((e) => /No msg\.deviceId set/.test(e)), true);
});

test("iothub-registry node requires configId for config.get/update/delete", () => {
  const harness = createHarness();
  harness.registerNodes();

  const node = harness.instantiate("iothub-registry", {
    id: "reg3",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==",
    connectionstringType: "str",
  });

  node.emit("input", { method: "config" });
  assert.equal(node.errors.some((e) => /No msg\.configId set/.test(e)), true);
});

test("iothub-registry twin.update warns when etag is not provided", () => {
  const harness = createHarness();
  harness.registerNodes();

  const node = harness.instantiate("iothub-registry", {
    id: "reg4",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==",
    connectionstringType: "str",
  });

  node.emit("input", { method: "twin.update", deviceId: "dev1", payload: { properties: { desired: { interval: 5000 } } } });
  assert.equal(node.warnings.some((w) => /No msg\.etag provided/.test(w)), true);
});

test("iothub-registry connectionstring resolves via getField", () => {
  const harness = createHarness();
  harness.registerNodes();

  const node = harness.instantiate("iothub-registry", {
    id: "reg5",
    connectionstring: "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==",
    connectionstringType: "str",
  });

  assert.equal(node.connectionstring, "HostName=test.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==");
});

test("iothub-registry connectionstring uses credential fallback", () => {
  const harness = createHarness();
  harness.registerNodes();

  const node = harness.instantiate("iothub-registry", {
    id: "reg6",
    connectionstring: "cred-ref-123",
    connectionstringType: "cred",
    credentials: { connectionstring: "HostName=test-from-cred.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==" },
  });

  assert.equal(node.connectionstring, "HostName=test-from-cred.azure-devices.net;SharedAccessKeyName=iothubowner;SharedAccessKey=dGVzdGtleQ==");
});

test("all node types are registered", () => {
  const harness = createHarness();
  harness.registerNodes();

  const registered = ["eventhub-config", "eventhub-recv", "iothub-send", "iothub-registry"].filter((name) =>
    harness.types.has(name)
  );
  assert.deepEqual(registered.sort(), ["eventhub-config", "eventhub-recv", "iothub-registry", "iothub-send"]);
});
