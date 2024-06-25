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
    RED.nodes.registerType("iothub-registry", function(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        node.connectionstring = getField(node, config.connectionstringType, config.connectionstring);
        var registry = Registry.fromConnectionString(node.connectionstring);

        function showError(msg, method, err, extra) {
            const errorMessage = `Could not perform ${method}: ${err.message}`;
            node.error(errorMessage);
            node.status({ fill: "red", text: errorMessage });
            node.send({ ...msg, ...extra, payload: { error: err.message } });
        }

        function callback(msg, method, getResult, getStatus, extra) {
            return (err, result) => {
                if (err) {
                    return showError(msg, method, err, extra);
                }
                node.send({ ...msg, ...extra, payload: getResult ? getResult(result) : result });
                node.status({ fill: "green", text: method, ...getStatus?.(result) });
            }
        }

        node.on('input', async (msg) => {
            let { deviceId, configId, method, payload } = msg;

            /* -------------------------------- Registry -------------------------------- */

            if(method === 'statistics') {
                registry.getRegistryStatistics(callback(msg, method, s => ({...s})));
                return;
            }

            /* --------------------------------- Config --------------------------------- */

            // https://github.com/Azure/azure-iot-hub-node/blob/main/samples/configuration_sample.js
            if(method === 'configs') {
                registry.getConfigurations(callback(msg, method, cs => cs.map(c => ({...c}))));
                return;
            }
            if(method === 'config') {
                if(!configId) {
                    node.error('No msg.configId set.');
                    node.status({ fill: "red", text: 'No msg.configId set.' });
                    return;
                }
                registry.getConfiguration(configId, callback(msg, method, c => ({...c})));
                return;
            }
            if(method === 'config.create') {
                registry.addConfiguration({ ...payload }, callback(msg, method));
                return;
            }
            if(method === 'config.update') {
                registry.getConfiguration(configId, function(err, config) {
                    if (err) {
                        return showError(msg, method, err);
                    }
                    const merge = (base, update) => Object.keys(update).forEach(k => update[k] instanceof Object && k in base ? merge(base[k], update[k]) : base[k] = update[k]);
                    merge(config, payload);
                    registry.updateConfiguration(config, callback(msg, method, c => ({...c})));
                });
                return;
            }
            if(method === 'config.apply') {
                // https://learn.microsoft.com/en-us/javascript/api/azure-iothub/configurationcontent?view=azure-node-latest
                registry.applyConfigurationContentOnDevice(deviceId, payload, callback(msg, method));
                return;
            }
            if(method === 'config.delete') {
                registry.removeConfiguration(configId, callback(msg, method, c => ({...c})));
                return;
            }

            /* ---------------------------------- Jobs ---------------------------------- */

            if(method === 'jobs') {
                registry.listJobs(callback(msg, method, js => js.map(j => ({...j}))));
                return;
            }
            if(method === 'job') {
                registry.getJob(msg.jobId, callback(msg, method, j => ({...j})));
                return;
            }
            if(method === 'job.cancel') {
                registry.cancelJob(msg.jobId, callback(msg, method));
                return;
            }

            /* ------------------------------- Device List ------------------------------ */

            // list devices
            if(method === 'devices') {
                registry.list(callback(msg, method, ds => (ds.map(d => ({...d})))));
                return;
            }
            // TODO: https://github.com/Azure/azure-iot-hub-node/blob/main/samples/registry_addUpdateRemoveDevicesSample.js
            // SQL query devices
            if(method === 'query') {
                let query = registry.createQuery(payload, msg.pageSize || 100);
                let allTwins = [];
                query.nextAsTwin(function(err, twins) {
                    if (err) {
                        node.error(`Could not query devices: ${err.message}`);
                        node.status({ fill: "red", text: `query: ${err.message}` });
                        node.send({ payload: { error: err.message } });
                        return;
                    }
                    if (query.hasMoreResults) {
                        allTwins = allTwins.push(...twins.map(t => ({...t})));
                        query.nextAsTwin(onResults);
                    } else {
                        node.send({ payload: allTwins });
                    }
                });
                return;
            }

            /* ------------------------- Device-Specific Methods ------------------------ */

            if(!deviceId) {
                node.error('No msg.deviceId set.');
                node.status({ fill: "red", text: 'No msg.deviceId set.' });
                return;
            }
            
            if (method === 'device.create') {
                registry.create({ deviceId, status: 'enabled', ...payload }, callback(msg, method, d => ({ ...d })));
                return;
            } 
            if (method === 'device.delete') {
                registry.delete(deviceId, callback(msg, method, d => ({ deviceId })));
                return;
            } 
            if (method === 'device') {
                registry.get(deviceId, callback(msg, method, d => ({ ...d })));
                return;
            } 
            if (method === 'twin') {
                registry.getTwin(deviceId, callback(msg, method, d => ({ ...d })));
                return;
            } 
            if (method === 'twin.update') {
                registry.updateTwin(deviceId, { ...payload }, msg.etag || '*', callback(msg, method, d => ({ ...d })));
                return;
            }

            node.error(`Invalid method: ${method}`);
            node.status({ fill: "red", text: `Invalid method: ${method}` });
        });
    }, {
        credentials: {
            connectionstring: {type: "text"}
        }
    });
}
