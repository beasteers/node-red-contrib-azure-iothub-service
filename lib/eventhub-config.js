const { getField, getSecretField } = require("./utils");

const DEFAULT_CONNECTION_STRING_ENV = "EVENTHUB_CONNECTION_STRING";

module.exports = function (RED) {
    RED.nodes.registerType("eventhub-config", function (config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.connectionstring = getSecretField(node, config, 'connectionstring') || process.env[DEFAULT_CONNECTION_STRING_ENV];
        node.consumergroup = getField(node, config, 'consumergroup');
    }, {
        credentials: {
            connectionstring: {type: "text"},
        }
    });
};
