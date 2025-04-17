'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.shortBytes32 = void 0
const shortBytes32 = (bytes32) => {
    if (!bytes32) {
        return ''
    }
    if (typeof bytes32 !== 'string' || bytes32.length !== 66) {
        return bytes32
    }
    return bytes32.slice(0, 5) + '..' + bytes32.slice(-3)
}
exports.shortBytes32 = shortBytes32
// # sourceMappingURL=formatters.js.map
