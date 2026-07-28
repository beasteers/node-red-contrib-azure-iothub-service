"use strict";

const { EventEmitter } = require("node:events");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

const mockRegistry = new Map();
const mockClients = [];
let mockQueryPages = [];
let mockQueryPageIndex = 0;

class MockMessage {
  constructor(data) {
    this.data = data;
  }
  getData() {
    return {
      toString: () => this.data,
    };
  }
}

const mockIotCommon = {
  Message: MockMessage,
};

class MockEventHubConsumerClient {
  constructor() {}
  subscribe() {
    return { close: () => Promise.resolve() };
  }
  close() {
    return Promise.resolve();
  }
}

const mockEventHubs = {
  EventHubConsumerClient: MockEventHubConsumerClient,
  earliestEventPosition: "earliest",
  latestEventPosition: "latest",
};

function createMockClient() {
  const client = {
    closed: false,
    sent: [],
    open(cb) {
      if (cb) cb(null);
    },
    close(cb) {
      client.closed = true;
      if (cb) cb(null);
    },
    send(deviceId, msg, cb) {
      client.sent.push({ deviceId, msg });
      if (cb) cb(null, {});
    },
    getFeedbackReceiver(cb) {
      const receiver = new EventEmitter();
      if (cb) cb(null, receiver);
    },
  };
  mockClients.push(client);
  return client;
}

function createMockRegistry() {
  const reg = {
    methods: [],
    results: new Map(),
  };

  reg.getRegistryStatistics = (cb) => {
    reg.methods.push("getRegistryStatistics");
    cb(null, reg.results.get("statistics") || { totalDeviceCount: 42 });
  };

  reg.getConfigurations = (cb) => {
    reg.methods.push("getConfigurations");
    cb(null, reg.results.get("configs") || []);
  };

  reg.getConfiguration = (id, cb) => {
    reg.methods.push("getConfiguration");
    cb(null, reg.results.get(`config:${id}`) || { id, content: {} });
  };

  reg.addConfiguration = (cfg, cb) => {
    reg.methods.push("addConfiguration");
    cb(null, cfg);
  };

  reg.updateConfiguration = (cfg, cb) => {
    reg.methods.push("updateConfiguration");
    cb(null, cfg);
  };

  reg.applyConfigurationContentOnDevice = (deviceId, content, cb) => {
    reg.methods.push("applyConfigurationContentOnDevice");
    cb(null, {});
  };

  reg.removeConfiguration = (id, cb) => {
    reg.methods.push("removeConfiguration");
    cb(null, { id });
  };

  reg.listJobs = (cb) => {
    reg.methods.push("listJobs");
    cb(null, reg.results.get("jobs") || []);
  };

  reg.getJob = (id, cb) => {
    reg.methods.push("getJob");
    cb(null, reg.results.get(`job:${id}`) || { id });
  };

  reg.cancelJob = (id, cb) => {
    reg.methods.push("cancelJob");
    cb(null, { id });
  };

  reg.list = (cb) => {
    reg.methods.push("list");
    cb(null, reg.results.get("devices") || []);
  };

  reg.create = (device, cb) => {
    reg.methods.push("create");
    cb(null, device);
  };

  reg.delete = (id, cb) => {
    reg.methods.push("delete");
    cb(null, { deviceId: id });
  };

  reg.get = (id, cb) => {
    reg.methods.push("get");
    cb(null, reg.results.get(`device:${id}`) || { deviceId: id });
  };

  reg.getTwin = (id, cb) => {
    reg.methods.push("getTwin");
    cb(null, reg.results.get(`twin:${id}`) || { deviceId: id, properties: {} });
  };

  reg.updateTwin = (id, patch, etag, cb) => {
    reg.methods.push("updateTwin");
    cb(null, reg.results.get(`twin:${id}`) || { deviceId: id });
  };

  reg.createQuery = function (sql, pageSize) {
    const pages = mockQueryPages;
    let page = 0;
    return {
      get hasMoreResults() {
        return page < pages.length;
      },
      nextAsTwin(cb) {
        const result = pages[page];
        page++;
        if (result instanceof Error) {
          cb(result);
        } else {
          setTimeout(() => cb(null, result || []), 0);
        }
      },
    };
  };

  return reg;
}

const mockIotHub = {
  Registry: {
    fromConnectionString() {
      const reg = createMockRegistry();
      if (mockRegistry.has("current")) {
        const custom = mockRegistry.get("current");
        Object.assign(reg, custom);
      }
      mockRegistry.set("latest", reg);
      return reg;
    },
  },
  Client: {
    fromConnectionString() {
      return createMockClient();
    },
  },
};

function installMocks() {
  const pairs = [
    ["@azure/event-hubs", mockEventHubs],
    ["azure-iot-common", mockIotCommon],
    ["azure-iothub", mockIotHub],
  ];

  const resolved = {};
  for (const [name, exports] of pairs) {
    const filePath = require.resolve(name);
    require.cache[filePath] = {
      id: filePath,
      filename: filePath,
      loaded: true,
      exports,
    };
    resolved[name] = filePath;
  }
  return resolved;
}

function getLatestRegistry() {
  return mockRegistry.get("latest");
}

function getLatestClient() {
  return mockClients[mockClients.length - 1];
}

function setQueryPages(pages) {
  mockQueryPages = pages;
}

module.exports = {
  installMocks,
  mockRegistry,
  getLatestRegistry,
  getLatestClient,
  setQueryPages,
  createMockClient,
};
