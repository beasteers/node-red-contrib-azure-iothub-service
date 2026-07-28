const { getField } = require("./utils");

module.exports = function (RED) {
    RED.nodes.registerType("eventhub-config", function (config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.connectionstring = getField(node, config, 'connectionstring');
        node.consumergroup = getField(node, config, 'consumergroup');
    }, {
        credentials: {
            connectionstring: {type: "text"},
        }
    });
};
