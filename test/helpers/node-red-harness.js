"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

function createHarness() {
  const types = new Map();
  let idCounter = 0;

  const contextStore = new Map();

  const RED = {
    nodes: {
      registerType(name, constructor) {
        types.set(name, constructor);
      },
      createNode(node, config) {
        Object.setPrototypeOf(node, EventEmitter.prototype);
        EventEmitter.call(node);
        node.id = config.id || `node-${++idCounter}`;
        node.sent = [];
        node.statuses = [];
        node.errors = [];
        node.warnings = [];
        node.send = (message) => node.sent.push(message);
        node.status = (status) => node.statuses.push(status);
        node.error = (error) => node.errors.push(error);
        node.warn = (warning) => node.warnings.push(warning);
        node.credentials = config.credentials || {};
        node.context = function () {
          return {
            flow: { get: () => undefined, set: () => undefined },
            global: {
              get: (key) => contextStore.get(key),
              set: (key, value) => contextStore.set(key, value),
            },
          };
        };
      },
    },
    util: {},
  };

  function installMocks(mocks) {
    if (!mocks) return;
    const originalRequire = require.main ? require.main.require : require;
    for (const [moduleName, mockExports] of Object.entries(mocks)) {
      const resolved = require.resolve(moduleName);
      if (require.cache[resolved]) {
        delete require.cache[resolved];
      }
      require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: mockExports };
    }
  }

  function registerNodes() {
    require(path.join(ROOT, "lib/eventhub-recv"))(RED);
    require(path.join(ROOT, "lib/iothub-send"))(RED);
    require(path.join(ROOT, "lib/iothub-registry"))(RED);
  }

  function instantiate(type, config = {}) {
    const Constructor = types.get(type);
    assert.ok(Constructor, `Node type "${type}" was registered`);

    let node;
    const origCreateNode = RED.nodes.createNode;
    RED.nodes.createNode = function (instance, cfg) {
      node = instance;
      origCreateNode.call(RED.nodes, instance, cfg);
    };

    try {
      new Constructor(config);
    } finally {
      RED.nodes.createNode = origCreateNode;
    }

    assert.ok(node, `Constructor for "${type}" did not create a node`);
    return node;
  }

  function input(node, msg = {}) {
    return new Promise((resolve) => {
      const done = () => resolve();
      node.emit("input", msg, () => {}, done);
      if (node.sent && node.sent.mostRecent) resolve();
      setTimeout(resolve, 50);
    });
  }

  function close(node) {
    return new Promise((resolve) => {
      node.emit("close", false, () => resolve());
      setTimeout(resolve, 50);
    });
  }

  return { RED, types, contextStore, installMocks, registerNodes, instantiate, input, close };
}

module.exports = { createHarness };
