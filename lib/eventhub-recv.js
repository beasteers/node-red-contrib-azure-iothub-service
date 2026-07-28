const { 
    EventHubConsumerClient, earliestEventPosition, latestEventPosition,
    CheckpointStore, PartitionOwnership, Checkpoint
} = require("@azure/event-hubs");

const { getField } = require("./utils");


class NodeRedCheckpointStore {
    constructor(node, keyPrefix='azure-iothub') {
        this.node = node;
        this.context = node.context().global;
        this.keyPrefix = keyPrefix;
    }

    getKey({ fullyQualifiedNamespace, eventHubName, consumerGroup }) {
        return `${this.keyPrefix}_${fullyQualifiedNamespace}_${eventHubName}_${consumerGroup}`.split(".").join("-");
    }

    async listOwnership(fullyQualifiedNamespace, eventHubName, consumerGroup) {
        const key = `ownership_${this.getKey({ fullyQualifiedNamespace, eventHubName, consumerGroup })}`;
        return Object.values(this.context.get(key) || {});
    }
    
    async claimOwnership(partitionOwnership) {
        if (!partitionOwnership || partitionOwnership.length === 0) {
            return [];
        }
        const key = `ownership_${this.getKey(partitionOwnership[0])}`;
        const currentOwnership = this.context.get(key) || {};
        const claimed = [];
        for (const p of partitionOwnership) {
            const e = currentOwnership[p.partitionId];
            if (e && e.ownerId !== p.ownerId) {
                this.node.warn(`Partition "${p.partitionId}" is already claimed by another owner.`);
            } else {
                currentOwnership[p.partitionId] = p;
                claimed.push(p);
            }
        }
        this.context.set(key, currentOwnership);
        return claimed;
    }
    
    async updateCheckpoint(checkpoint) {
        const key = `checkpoint_${this.getKey(checkpoint)}`;
        let currentCheckpoints = this.context.get(key) || {};
        currentCheckpoints[checkpoint.partitionId] = checkpoint;
        this.context.set(key, currentCheckpoints);
    }

    async listCheckpoints(fullyQualifiedNamespace, eventHubName, consumerGroup) {
        const key = `checkpoint_${this.getKey({ fullyQualifiedNamespace, eventHubName, consumerGroup })}`;
        return Object.values(this.context.get(key) || {});
    }
}



module.exports = function (RED) {
    RED.nodes.registerType("eventhub-recv", function(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        const eventhubConfig = RED.nodes.getNode(config.eventhub);
        const connectionstring = eventhubConfig
            ? eventhubConfig.connectionstring
            : getField(node, config, 'connectionstring');
        const consumergroup = eventhubConfig
            ? eventhubConfig.consumergroup
            : getField(node, config, 'consumergroup');

        if (!eventhubConfig) {
            node.warn("Using inline connection string is deprecated. Use an eventhub-config node instead.");
        }
        if(!connectionstring) {
            node.error("Connection string is required.");
            node.status({ fill: "red", text: "Connection string is required." });
            return;
        }
        
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

            // update node status
            message = message || "";
            if (errMessage) { // there was an error on this message
                message = `${message || ""} ${errMessage}`;
                color = color || "red";
            }
            if (errors.length > 0) {  // there are errors on some partitions
                message = `${message || ""} [E: ${errors.length}/${status.length}]`;
                color = color || "yellow";
            }
            node.status({ fill: color || "green", text: message });
        }

        node.nodeClose = false;

        let consumerClient;
        let subscription;
        try {
            const checkpointStore = new NodeRedCheckpointStore(node);
            consumerClient = new EventHubConsumerClient(consumergroup || "$default", connectionstring, checkpointStore);
            
            subscription = consumerClient.subscribe({
                    // init
                    processInitialize: async (context) => {
                        console.log(`Connecting Event Hub partition "${context.partitionId}"`);
                        try {
                            node.send([
                                null, null, 
                                { payload: { status: 'connected' }, context: { ...context }, processTimeUtc: new Date(Date.now()) }, 
                                null
                            ]);
                        } catch (e) {
                            node.error(`Error sending connect event: ${e.message}`);
                        }
                        updateStatus(context.partitionId, 'connected');
                    },
                    // message
                    processEvents: async (events, context) => {
                        if (!events.length) { return; }
                        for (const { body, ...event } of events) {
                            try {
                                node.send([
                                    { ...event, payload: body, context: { ...context._context }, processTimeUtc: new Date(Date.now()) }, 
                                    null, null, null
                                ]);
                            } catch (e) {
                                node.error(`Error sending event: ${e.message}`);
                            }
                        }
                        updateStatus(context.partitionId, `received ${events.length} ${new Date(Date.now()).toLocaleTimeString()}`, null, 'blue');
                        await context.updateCheckpoint(events[events.length - 1]);
                    },
                    // error
                    processError: async (err, context) => {
                        node.error(`Error on partition "${context.partitionId}": ${err.message}`);
                        try {
                            node.send([
                                null, 
                                { payload: { ...err }, context: { ...context._context }, processTimeUtc: new Date(Date.now()) }, 
                                null, null
                            ]);
                        } catch (e) {
                            node.error(`Error sending error event: ${e.message}`);
                        }
                        updateStatus(context.partitionId, "error", err.message);
                    },
                    // close
                    processClose: async (reason, context) => {
                        console.error(`Closing partition "${context.partitionId}" for reason "${reason}".`);
                        try {
                            node.send([
                                null, null, null, 
                                { payload: { status: 'closed', reason }, context: { ...context._context }, processTimeUtc: new Date(Date.now()) }
                            ]);
                        } catch (e) {
                            node.error(`Error sending close event: ${e.message}`);
                        }
                        if(!node.nodeClose) updateStatus(context.partitionId, "closed", reason, "red");
                    }
                },
                { 
                    startPosition: latestEventPosition,
                },
            );
            
        }
        catch (err) {
            node.error(`can't connect: ${err.message}`);
            node.status({ fill: "red", shape: "ring", text: `can't connect: ${err.message}` });
        }
        
        node.on('close', async () => {
            node.nodeClose = true;
            subscription && (await subscription.close());
            consumerClient && (await consumerClient.close());
    });

    }, {
        credentials: {
            connectionstring: {type: "text"},
        }
    });
};

module.exports.NodeRedCheckpointStore = NodeRedCheckpointStore;
