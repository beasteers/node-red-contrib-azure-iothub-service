var { EventHubConsumerClient, earliestEventPosition, latestEventPosition } = require("@azure/event-hubs");


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
    RED.nodes.registerType("eventhub-recv", function(config) {
        RED.nodes.createNode(this, config);

        var node = this;
        node.connectionstring = getField(node, config.connectionstringType, config.connectionstring);
        node.consumergroup = getField(node, config.consumergroupType, config.consumergroup);
        node.status({});
        node.consumerError = {};

        let updateStatus = (partitionId, message, errMessage=null, color=null) => {
            // track error status
            if(partitionId) {
                node.consumerError[partitionId] = errMessage;
            }
            // get partition error counts
            let status = Object.values(node.consumerError);
            let errors = status.filter(e => e !== null);
            let n = status.length;

            // update node status
            message = message || "";
            if (errMessage) { // there was an error on this message
                message = `${message || ""} ${errMessage}`;
                color = color || "red";
            }
            if (errors.length > 0) {  // there are errors on some partitions
                message = `${message || ""} [E: ${errors.length}/${n}]`;
                color = color || "yellow";
            }
            node.status({ fill: color || "green", text: message });
        }

        try {
            const consumerClient = new EventHubConsumerClient(node.consumergroup, node.connectionstring);
            
            const subscription = consumerClient.subscribe({
                    // init
                    processInitialize: async (context) => {
                        node.send([
                            null, null, 
                            { payload: { status: 'connected' }, context: { ...context }, processTimeUtc: new Date(Date.now()) }, 
                            null
                        ]);
                        updateStatus(context.partitionId, 'connected');
                    },
                    // message
                    processEvents: async (events, context) => {
                        for (const { body, ...event } of events) {
                            node.send([
                                { ...event, payload: body, context: { ...context._context }, processTimeUtc: new Date(Date.now()) }, 
                                null, null, null
                            ]);
                        }
                        updateStatus(context.partitionId, `received ${events.length}`);
                    },
                    // error
                    processError: async (err, context) => {
                        node.error(`Error on partition "${context.partitionId}": ${err.message}`);
                        node.send([
                            null, 
                            { payload: { ...err }, context: { ...context._context }, processTimeUtc: new Date(Date.now()) }, 
                            null, null
                        ]);
                        updateStatus(context.partitionId, "error", err.message);
                    },
                    // close
                    processClose: async (reason, context) => {
                        node.error(`Closing partition "${context.partitionId}" for reason "${reason}".`);
                        node.send([
                            null, null, null, 
                            { payload: { status: 'closed', reason }, context: { ...context._context }, processTimeUtc: new Date(Date.now()) }
                        ]);
                        updateStatus(context.partitionId, "closed", reason, "red");
                    }
                },
                { 
                    startPosition: latestEventPosition,
                },
            );
            node.consumerClient = consumerClient;
            node.subscription = subscription;
        }
        catch (err) {
            node.error(`can't connect: ${err.message}`);
            node.status({ fill: "red", shape: "ring", text: `can't connect: ${err.message}` });
        }
    });
}
