module.exports.getField = function getField(node, config, key) {
    var kind = config[key + 'Type'];
    var value = (node.credentials && node.credentials[key]) || config[key];
    switch (kind) {
        case 'flow':
            return node.context().flow.get(value);
        case 'global':
            return node.context().global.get(value);
        case 'num': {
            var n = parseInt(value, 10);
            return isNaN(n) ? value : n;
        }
        case 'bool':
        case 'json':
            try {
                return JSON.parse(value);
            } catch (e) {
                if (node && typeof node.warn === 'function') {
                    node.warn(`Invalid ${kind} value for "${key}": ${e.message}`);
                }
                return value;
            }
        case 'env':
            return process.env[value];
        default:
            return value;
    }
};

module.exports.getSecretField = function getSecretField(node, config, key) {
    var value = module.exports.getField(node, config, key);
    var fromCredential = node.credentials && node.credentials[key];
    if (!fromCredential && config[key + 'Type'] === 'str' && value &&
            node && typeof node.warn === 'function') {
        node.warn(`"${key}" is stored in plaintext in the flow file (flows.json). Use a credential (cred) or an environment variable (env) instead.`);
    }
    return value;
};
