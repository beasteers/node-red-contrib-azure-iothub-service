const { Client } = require("azure-iothub");
const { Message } = require("azure-iot-common");
const { getSecretField } = require("./utils");


module.exports = function (RED) {
    RED.nodes.registerType("iothub-send", function(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        node.connectionstring = getSecretField(node, config, 'connectionstring') || process.env.IOTHUB_CONNECTION_STRING;
        if (!node.connectionstring) {
            node.error("Connection string is required.");
            node.status({ fill: "red", text: "Connection string is required." });
            return;
        }
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

        node.on('close', function (removed, done) {
            if (typeof removed === 'function') { done = removed; }
            if (typeof done !== 'function') { done = function () {}; }
            if (client) {
                client.close(function (err) {
                    if (err) node.error('Error closing client: ' + err.message);
                    done();
                });
            } else {
                done();
            }
        });
    }, {
        credentials: {
            connectionstring: {type: "text"}
        }
    });
}
