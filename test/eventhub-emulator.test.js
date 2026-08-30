"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const net = require("node:net");

const { EventHubProducerClient } = require("@azure/event-hubs");
const { createHarness } = require("./helpers/node-red-harness");

const EMULATOR_HOST = process.env.EVENTHUB_EMULATOR_HOST || "localhost";
const EMULATOR_PORT = 5672;
const CONNECTION_STRING = `Endpoint=sb://${EMULATOR_HOST};SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=SAS_KEY_VALUE;UseDevelopmentEmulator=true;EntityPath=eh1`;
const CONSUMER_GROUP = "$default";

// The recv node provides a CheckpointStore, so the SDK's balanced load
// balancer claims one partition per loop iteration (10s apart by default).
// Allow generous time for all partitions to come online.
const CONNECT_TIMEOUT_MS = 120000;

function checkEmulator() {
  return new Promise((resolve) => {
    const socket = net.connect(EMULATOR_PORT, EMULATOR_HOST);
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function waitFor(fn, timeoutMs = 20000, intervalMs = 100) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      let result;
      try {
        result = fn();
      } catch (e) {
        return reject(e);
      }
      if (result) {
        return resolve();
      }
      if (Date.now() > deadline) {
        return reject(new Error(`timed out after ${timeoutMs}ms`));
      }
      setTimeout(poll, intervalMs);
    })();
  });
}

function sentOn(node, port) {
  return node.sent
    .filter((m) => Array.isArray(m) && m[port] !== null && m[port] !== undefined)
    .map((m) => m[port]);
}

test("eventhub-recv against the Event Hub emulator", async (t) => {
  if (!(await checkEmulator())) {
    t.skip(
      `Event Hub emulator not reachable on ${EMULATOR_HOST}:${EMULATOR_PORT}. ` +
        "Start it with: cd test/emulator && docker compose up -d"
    );
    return;
  }

  // One shared node: the partition claim cycle (one partition per ~10s
  // iteration) runs only once for the whole suite.
  const harness = createHarness();
  harness.registerNodes();

  const configNode = harness.instantiate("eventhub-config", {
    id: "eh-emulator-cfg",
    connectionstring: CONNECTION_STRING,
    connectionstringType: "str",
    consumergroup: CONSUMER_GROUP,
    consumergroupType: "str",
  });
  assert.equal(configNode.connectionstring, CONNECTION_STRING);

  const node = harness.instantiate("eventhub-recv", {
    id: "eh-emulator-recv",
    eventhub: "eh-emulator-cfg",
  });
  t.after(() => harness.close(node).catch(() => {}));

  await t.test("subscribes to all partitions", async () => {
    await waitFor(() => sentOn(node, 2).length >= 4, CONNECT_TIMEOUT_MS);
    const connects = sentOn(node, 2);
    assert.ok(connects.every((m) => m.payload.status === "connected"));
    assert.ok(connects.every((m) => m.context && m.context.partitionId !== undefined));
  });

  await t.test("receives messages after they are sent", async (t) => {
    const producer = new EventHubProducerClient(CONNECTION_STRING);
    t.after(() => producer.close().catch(() => {}));

    const payloads = [
      { deviceId: "dev-1", temp: 22.5 },
      { deviceId: "dev-2", temp: 21.0 },
      { deviceId: "dev-3", temp: 23.7 },
      "plain string payload",
    ];
    const baseline = sentOn(node, 0).length;
    await producer.sendBatch(payloads.map((body) => ({ body })));

    await waitFor(() => sentOn(node, 0).length >= baseline + payloads.length);
    const received = sentOn(node, 0).slice(baseline, baseline + payloads.length);

    const receivedPayloads = received.map((m) => m.payload);
    for (const expected of payloads) {
      assert.ok(
        receivedPayloads.some((p) => JSON.stringify(p) === JSON.stringify(expected)),
        `expected to receive payload ${JSON.stringify(expected)}, got ${JSON.stringify(receivedPayloads)}`
      );
    }

    for (const msg of received) {
      assert.ok(msg.context.partitionId !== undefined, "message has partitionId");
      assert.ok(msg.context.eventHubName === "eh1", "message has eventHubName");
      assert.ok(msg.processTimeUtc instanceof Date || typeof msg.processTimeUtc === "object");
      assert.ok(msg.offset !== undefined, "message carries event metadata");
    }
  });

  await t.test("checkpoints the last received event", async (t) => {
    const producer = new EventHubProducerClient(CONNECTION_STRING);
    t.after(() => producer.close().catch(() => {}));

    const baseline = sentOn(node, 0).length;
    await producer.sendBatch([{ body: { checkpoint: "me" } }]);
    await waitFor(() => sentOn(node, 0).length >= baseline + 1);

    const checkpointKey = [...harness.contextStore.keys()].find((k) => k.startsWith("checkpoint_"));
    assert.ok(checkpointKey, "checkpoint written to global context");
    const checkpoints = Object.values(harness.contextStore.get(checkpointKey));
    assert.ok(checkpoints.length >= 1, "at least one partition checkpointed");
    assert.ok(checkpoints.every((c) => c.offset !== undefined && c.sequenceNumber !== undefined));
  });

  await t.test("emits a close event when the node is stopped", async () => {
    await new Promise((resolve) => node.emit("close", false, resolve));
    await waitFor(() => sentOn(node, 3).length >= 4, CONNECT_TIMEOUT_MS);
    const closes = sentOn(node, 3);
    assert.ok(closes.every((m) => m.payload.status === "closed"));
    assert.ok(closes.every((m) => typeof m.payload.reason === "string"));
  });
});
