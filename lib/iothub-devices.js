const { Registry } = require("azure-iothub");


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
    RED.nodes.registerType("iothub-devices", function(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        node.connectionstring = getField(node, config.connectionstringType, config.connectionstring);
        var registry = Registry.fromConnectionString(node.connectionstring);

        node.on('input', async ({ deviceId, method, payload }) => {
            // list devices
            if((method === 'devices' || method === 'device') && !deviceId) {
                registry.list(function(err, devices) {
                    if (err) {
                        node.error(`Could not list devices: ${err.message}`);
                        node.status({ fill: "red", text: `devices: ${err.message}` });
                        node.send({ payload: { error: err.message } });
                        return;
                    }
                    console.log(devices);
                    node.send({ payload: devices.map(d => ({...d})) });
                });
                return;
            }

            /* ------------------------- Device-Specific Methods ------------------------ */

            if(!deviceId) {
                node.error('No msg.deviceId set.');
                node.status({ fill: "red", text: 'No msg.deviceId set.' });
                return;
            }
            
            if(method === 'device.create') {
                registry.create({ deviceId, status: 'enabled', ...payload }, function(err, device) {
                    if (err) {
                        node.error(`Could not create device: ${err.message}`);
                        node.status({ fill: "red", text: `device.create: ${err.message}` });
                        node.send({ deviceId, payload: { error: err.message } });
                        return;
                    }
                    console.log(device);
                    node.send({ deviceId, payload: {...device} });
                });
            }
            else if(method === 'device.delete') {
                registry.delete(deviceId, function(err, device) {
                    if (err) {
                        node.error(`Could not delete device: ${err.message}`);
                        node.status({ fill: "red", text: `device.delete: ${err.message}` });
                        node.send({ deviceId, payload: { error: err.message } });
                        return;
                    }
                    node.send({ deviceId, payload: {} });
                });
            } 
            else if(method === 'device') {
                registry.get(deviceId, function(err, device) {
                    if (err) {
                        node.error(`Could not get device: ${err.message}`);
                        node.status({ fill: "red", text: `device: ${err.message}` });
                        node.send({ deviceId, payload: { error: err.message } });
                        return;
                    }
                    node.send({ deviceId, payload: {...device} });
                });
            }
            else if(method === 'twin') {
                registry.getTwin(deviceId, function(err, twin) {
                    if (err) {
                        node.error(`Could not get twin: ${err.message}`);
                        node.status({ fill: "red", text: `twin: ${err.message}` });
                        node.send({ deviceId, payload: { error: err.message } });
                        return;
                    }
                    node.send({ deviceId, payload: {...twin} });
                });
            } 
            else if(method === 'twin.update') {
                node.warn(payload)
                registry.updateTwin(deviceId, { ...payload }, '*', function(err, twin) {
                    if (err) {
                        node.error(`Could not update twin: ${err.message}`);
                        node.status({ fill: "red", text: `twin.update: ${err.message}` });
                        node.send({ deviceId, payload: { error: err.message } });
                        return;
                    }
                    node.send({ deviceId, payload: {...twin} });
                });
            }
            else {
                node.error(`Invalid method: ${method}`);
                node.status({ fill: "red", text: `Invalid method: ${method}` });
            }
        });
    });
}
