const { Client } = require("azure-iothub");
const { Message } = require("azure-iot-common");


function getField(node, kind, value) {
    switch (kind) {
        case 'flow':	// Legacy
            return node.context().flow.get(value);
        case 'global':
            return node.context().global.get(value);
        case 'num':
            return parseInt(value);
        case 'bool':
        case 'json':
            return JSON.parse(value);
        case 'env':
            return process.env[value];
        default:
            return value;
    }
}


module.exports = function (RED) {
    RED.nodes.registerType("iothub-send", function(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        node.connectionstring = getField(node, config.connectionstringType, config.connectionstring);
        node.consumergroup = getField(node, config.consumergroupType, config.consumergroup);
        var client = Client.fromConnectionString(node.connectionstring);

        node.status({});
        client.open((err) => {
            if (err) {
                node.error(`Could not connect: ${err.message}`);
                node.status({ fill: "red", shape: "ring", text: `Could not connect: ${err.message}` });
                return;
            }

            // setup listener
            client.getFeedbackReceiver((err, receiver) => {
                if(err) {
                    node.error(`Could not get feedback receiver: ${err.message}`);
                    node.status({ fill: "red", shape: "ring", text: `Could not get feedback receiver: ${err.message}` });
                    return;
                }
                receiver.on('message', function (msg) {
                  node.send([{ payload: msg.getData().toString('utf-8') }, null]);
                  node.status({ fill: "green" });
                });
            });

            // node processing
            node.on('input', function({ deviceId, payload: message }) {
                if(!deviceId) {
                    node.error('No msg.deviceId set.');
                    node.status({ fill: "red", shape: "ring", text: 'No msg.deviceId set.' });
                    return;
                }

                node.status({ fill: "green", text: deviceId });
                client.send(deviceId, new Message(JSON.stringify(message)), (err, res) => {
                    if (err) {
                        node.error(`Could not send message to ${deviceId}: ${err.toString()}`);
                        node.status({ fill: "red", text: `${deviceId}: ${err.toString()}` });
                        node.send([null, { deviceId, message, payload: err.toString() }]);
                    } else {
                        node.send([{ deviceId, message, payload: {} }, null]);
                        node.status({ fill: "green", text: deviceId });
                    }
                });
            });
        });
    }, {
        credentials: {
            connectionstring: {type: "text"}
        }
    });
}
