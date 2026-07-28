module.exports.getField = function getField(node, config, key) {
    var kind = config[key + 'Type'];
    var value = (node.credentials && node.credentials[key]) || config[key];
    switch (kind) {
        case 'flow':
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
};
