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
