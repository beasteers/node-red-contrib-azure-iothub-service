"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { EventEmitter } = require("node:events");

const { getField } = require("../lib/utils");

function makeNode(overrides = {}) {
  const node = new EventEmitter();
  node.credentials = overrides.credentials || {};
  node.errors = [];
  node.error = (msg) => node.errors.push(msg);

  const flowStore = new Map();
  const globalStore = new Map();
  for (const [k, v] of Object.entries(overrides.flow || {})) flowStore.set(k, v);
  for (const [k, v] of Object.entries(overrides.global || {})) globalStore.set(k, v);

  node.context = function () {
    return {
      flow: { get: (k) => flowStore.get(k), set: (k, v) => flowStore.set(k, v) },
      global: { get: (k) => globalStore.get(k), set: (k, v) => globalStore.set(k, v) },
    };
  };

  return node;
}

test("getField resolves str type from config", () => {
  const node = makeNode();
  const config = { connectionstring: "Endpoint=sb://test", connectionstringType: "str" };
  assert.equal(getField(node, config, "connectionstring"), "Endpoint=sb://test");
});

test("getField resolves default (no type) from config", () => {
  const node = makeNode();
  const config = { connectionstring: "Endpoint=sb://test" };
  assert.equal(getField(node, config, "connectionstring"), "Endpoint=sb://test");
});

test("getField resolves env type from process.env", () => {
  const node = makeNode();
  const config = { connectionstring: "TEST_CS", connectionstringType: "env" };
  process.env.TEST_CS = "Endpoint=sb://from-env";
  try {
    assert.equal(getField(node, config, "connectionstring"), "Endpoint=sb://from-env");
  } finally {
    delete process.env.TEST_CS;
  }
});

test("getField resolves cred type from node.credentials", () => {
  const node = makeNode({ credentials: { connectionstring: "Endpoint=sb://from-cred" } });
  const config = { connectionstring: "cred-id-123", connectionstringType: "cred" };
  assert.equal(getField(node, config, "connectionstring"), "Endpoint=sb://from-cred");
});

test("getField falls back to config value when credentials are empty", () => {
  const node = makeNode({ credentials: {} });
  const config = { connectionstring: "plain-text-cs", connectionstringType: "cred" };
  assert.equal(getField(node, config, "connectionstring"), "plain-text-cs");
});

test("getField falls back to config value when credentials key is absent", () => {
  const node = makeNode();
  const config = { connectionstring: "plain-text-cs", connectionstringType: "cred" };
  assert.equal(getField(node, config, "connectionstring"), "plain-text-cs");
});

test("getField resolves flow type", () => {
  const node = makeNode({ flow: { myFlowKey: "flow-value" } });
  const config = { connectionstring: "myFlowKey", connectionstringType: "flow" };
  assert.equal(getField(node, config, "connectionstring"), "flow-value");
});

test("getField resolves global type", () => {
  const node = makeNode({ global: { myGlobalKey: "global-value" } });
  const config = { connectionstring: "myGlobalKey", connectionstringType: "global" };
  assert.equal(getField(node, config, "connectionstring"), "global-value");
});

test("getField resolves num type", () => {
  const node = makeNode();
  const config = { interval: "42", intervalType: "num" };
  assert.equal(getField(node, config, "interval"), 42);
});

test("getField resolves bool type", () => {
  const node = makeNode();
  assert.equal(getField(node, { enabled: "true", enabledType: "bool" }, "enabled"), true);
  assert.equal(getField(node, { enabled: "false", enabledType: "bool" }, "enabled"), false);
});

test("getField resolves json type", () => {
  const node = makeNode();
  const config = { mydata: '{"key":"val"}', mydataType: "json" };
  const result = getField(node, config, "mydata");
  assert.deepEqual(result, { key: "val" });
});

test("getField handles missing value gracefully", () => {
  const node = makeNode({ credentials: {} });
  const config = { connectionstring: undefined };
  assert.equal(getField(node, config, "connectionstring"), undefined);
});

test("getField checks credentials before config when both are present", () => {
  const node = makeNode({ credentials: { connectionstring: "SECRET-cs" } });
  const config = { connectionstring: "plain-cs", connectionstringType: "str" };
  assert.equal(getField(node, config, "connectionstring"), "SECRET-cs");
});
