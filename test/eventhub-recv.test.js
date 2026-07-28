"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { EventEmitter } = require("node:events");

const { NodeRedCheckpointStore } = require("../lib/eventhub-recv");

function makeNode() {
  const contextStore = new Map();
  const node = new EventEmitter();
  node.warnings = [];
  node.warn = (msg) => node.warnings.push(msg);
  node.context = function () {
    return {
      flow: { get: () => undefined, set: () => undefined },
      global: {
        get: (key) => contextStore.get(key),
        set: (key, value) => contextStore.set(key, value),
      },
    };
  };
  return { node, contextStore };
}

const samplePartition = {
  fullyQualifiedNamespace: "ns-example.servicebus.windows.net",
  eventHubName: "my-eventhub",
  consumerGroup: "$default",
  partitionId: "0",
  ownerId: "test-owner",
};

test("getKey replaces dots with hyphens", () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node, "azure-iothub");
  const key = store.getKey({
    fullyQualifiedNamespace: "ns.example.servicebus.windows.net",
    eventHubName: "my.eventhub",
    consumerGroup: "$default",
  });
  assert.match(key, /^azure-iothub_ns-example-servicebus-windows-net_my-eventhub_\$default$/);
});

test("listOwnership returns empty array when nothing stored", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);
  const result = await store.listOwnership("ns", "eh", "$default");
  assert.deepEqual(result, []);
});

test("claimOwnership stores and returns claimed partitions", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);

  const owned = [Object.assign({}, samplePartition)];
  const claimed = await store.claimOwnership(owned);
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].partitionId, "0");
  assert.equal(claimed[0].ownerId, "test-owner");
});

test("claimOwnership preserves existing partition ownership when claiming new ones", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);

  await store.claimOwnership([{ ...samplePartition, partitionId: "0" }]);
  const claimed = await store.claimOwnership([{ ...samplePartition, partitionId: "1" }]);

  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].partitionId, "1");

  const allOwned = await store.listOwnership("ns-example.servicebus.windows.net", "my-eventhub", "$default");
  assert.equal(allOwned.length, 2);
  assert.equal(allOwned.map((p) => p.partitionId).sort().join(), "0,1");
});

test("claimOwnership warns and refuses partition claimed by another owner", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);

  await store.claimOwnership([{ ...samplePartition, partitionId: "0", ownerId: "owner-a" }]);
  const claimed = await store.claimOwnership([{ ...samplePartition, partitionId: "0", ownerId: "owner-b" }]);

  assert.equal(claimed.length, 0);
  assert.equal(node.warnings.length, 1);
  assert.match(node.warnings[0], /already claimed/);
});

test("claimOwnership returns empty for null/empty input", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);

  assert.deepEqual(await store.claimOwnership(null), []);
  assert.deepEqual(await store.claimOwnership([]), []);
});

test("updateCheckpoint and listCheckpoints store/retrieve offset data", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);

  await store.updateCheckpoint({
    fullyQualifiedNamespace: "ns",
    eventHubName: "eh",
    consumerGroup: "$default",
    partitionId: "0",
    offset: "12345",
    sequenceNumber: 100,
  });

  const checkpoints = await store.listCheckpoints("ns", "eh", "$default");
  assert.equal(checkpoints.length, 1);
  assert.equal(checkpoints[0].partitionId, "0");
  assert.equal(checkpoints[0].offset, "12345");
  assert.equal(checkpoints[0].sequenceNumber, 100);
});

test("updateCheckpoint updates existing checkpoint for same partition", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);

  await store.updateCheckpoint({
    fullyQualifiedNamespace: "ns",
    eventHubName: "eh",
    consumerGroup: "$default",
    partitionId: "0",
    offset: "100",
    sequenceNumber: 10,
  });

  await store.updateCheckpoint({
    fullyQualifiedNamespace: "ns",
    eventHubName: "eh",
    consumerGroup: "$default",
    partitionId: "0",
    offset: "200",
    sequenceNumber: 20,
  });

  const checkpoints = await store.listCheckpoints("ns", "eh", "$default");
  assert.equal(checkpoints.length, 1);
  assert.equal(checkpoints[0].offset, "200");
});

test("separate consumer groups have separate ownership", async () => {
  const { node } = makeNode();
  const store = new NodeRedCheckpointStore(node);

  await store.claimOwnership([{ ...samplePartition, consumerGroup: "group-a" }]);
  await store.claimOwnership([{ ...samplePartition, consumerGroup: "group-b" }]);

  const a = await store.listOwnership("ns-example.servicebus.windows.net", "my-eventhub", "group-a");
  const b = await store.listOwnership("ns-example.servicebus.windows.net", "my-eventhub", "group-b");
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].consumerGroup, "group-a");
  assert.equal(b[0].consumerGroup, "group-b");
});
