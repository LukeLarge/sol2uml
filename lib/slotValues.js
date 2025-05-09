'use strict'
const __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod }
    }
Object.defineProperty(exports, '__esModule', { value: true })
exports.escapeString =
    exports.convert2String =
    exports.dynamicSlotSize =
    exports.getSlotValue =
    exports.getSlotValues =
    exports.parseValue =
    exports.addSlotValues =
        void 0
const bignumber_1 = require('@ethersproject/bignumber')
const axios_1 = __importDefault(require('axios'))
const umlClass_1 = require('./umlClass')
const utils_1 = require('ethers/lib/utils')
const SlotValueCache_1 = require('./SlotValueCache')
const ethers_1 = require('ethers')
const debug = require('debug')('sol2uml')
/**
 * Adds the slot values to the variables in the storage section.
 * This can be rerun for a section as it will only get if the slot value
 * does not exist.
 * @param url of Ethereum JSON-RPC API provider. eg Infura or Alchemy
 * @param contractAddress Contract address to get the storage slot values from.
 * If contract is proxied, use proxy and not the implementation contract.
 * @param storageSection is mutated with the slot values added to the variables
 * @param arrayItems the number of items to display at the start and end of an array
 * @param blockTag block number or `latest`
 */
const addSlotValues = async (
    url,
    contractAddress,
    storageSection,
    arrayItems,
    blockTag,
) => {
    const valueVariables = storageSection.variables.filter(
        (variable) => variable.getValue && !variable.slotValue,
    )
    if (valueVariables.length === 0) {
        return
    }
    // for each variable, add all the slots used by the variable.
    const slots = []
    valueVariables.forEach((variable) => {
        if (variable.offset) {
            slots.push(bignumber_1.BigNumber.from(variable.offset))
        } else {
            for (let i = 0; variable.fromSlot + i <= variable.toSlot; i++) {
                if (
                    variable.attributeType === umlClass_1.AttributeType.Array &&
                    i >= arrayItems &&
                    i < variable.toSlot - arrayItems
                ) {
                    continue
                }
                slots.push(variable.fromSlot + i)
            }
        }
    })
    // remove duplicate slot numbers
    const uniqueFromSlots = [...new Set(slots)]
    // Convert slot numbers to BigNumbers and offset dynamic arrays
    const slotKeys = uniqueFromSlots.map((fromSlot) => {
        if (storageSection.offset) {
            return bignumber_1.BigNumber.from(storageSection.offset).add(
                fromSlot,
            )
        }
        return bignumber_1.BigNumber.from(fromSlot)
    })
    // Get the contract slot values from the node provider
    const values = await (0, exports.getSlotValues)(
        url,
        contractAddress,
        slotKeys,
        blockTag,
    )
    // For each slot value retrieved
    values.forEach((value, i) => {
        // Get the corresponding slot number for the slot value
        const fromSlot = uniqueFromSlots[i]
        // For each variable in the storage section
        for (const variable of storageSection.variables) {
            if (
                variable.getValue &&
                variable.offset &&
                bignumber_1.BigNumber.from(variable.offset).eq(fromSlot)
            ) {
                debug(
                    `Set slot value ${value} for section "${storageSection.name}", var type ${variable.type}, slot ${variable.offset}`,
                )
                variable.slotValue = value
                // parse variable value from slot data
                if (variable.displayValue) {
                    variable.parsedValue = (0, exports.parseValue)(variable)
                }
            } else if (variable.getValue && variable.fromSlot === fromSlot) {
                debug(
                    `Set slot value ${value} for section "${storageSection.name}", var type ${variable.type}, slot ${variable.fromSlot} offset ${storageSection.offset}`,
                )
                variable.slotValue = value
                // parse variable value from slot data
                if (variable.displayValue) {
                    variable.parsedValue = (0, exports.parseValue)(variable)
                }
            }
            // if variable is past the slot that has the value
            else if (
                variable.toSlot &&
                bignumber_1.BigNumber.from(variable.toSlot).gt(fromSlot)
            ) {
                break
            }
        }
    })
}
exports.addSlotValues = addSlotValues
const parseValue = (variable) => {
    if (!variable.slotValue) {
        return undefined
    }
    const start = 66 - (variable.byteOffset + variable.byteSize) * 2
    const end = 66 - variable.byteOffset * 2
    const variableValue = variable.slotValue.substring(start, end)
    try {
        // Contracts, structs and enums
        if (variable.attributeType === umlClass_1.AttributeType.UserDefined) {
            return parseUserDefinedValue(variable, variableValue)
        }
        if (variable.attributeType === umlClass_1.AttributeType.Elementary) {
            return parseElementaryValue(variable, variableValue)
        }
        // dynamic arrays
        if (
            variable.attributeType === umlClass_1.AttributeType.Array &&
            variable.dynamic
        ) {
            return (0, utils_1.formatUnits)('0x' + variableValue, 0)
        }
        return undefined
    } catch (err) {
        throw Error(
            `Failed to parse variable ${variable.name} of type ${variable.type}, value "${variableValue}"`,
            { cause: err },
        )
    }
}
exports.parseValue = parseValue
const parseUserDefinedValue = (variable, variableValue) => {
    // TODO need to handle User Defined Value Types introduced in Solidity
    // https://docs.soliditylang.org/en/v0.8.18/types.html#user-defined-value-types
    // https://blog.soliditylang.org/2021/09/27/user-defined-value-types/
    // using byteSize is crude and will be incorrect for aliases types like int160 or uint160
    if (variable.byteSize === 20) {
        return (0, utils_1.getAddress)('0x' + variableValue)
    }
    // this will also be wrong if the alias is to a 1 byte type. eg bytes1, int8 or uint8
    if (variable.byteSize === 1) {
        // assume 1 byte is an enum so convert value to enum index number
        const index = bignumber_1.BigNumber.from(
            '0x' + variableValue,
        ).toNumber()
        // lookup enum value if its available
        return variable?.enumValues ? variable?.enumValues[index] : undefined
    }
    // we don't parse if a struct which has a size of 32 bytes
    return undefined
}
const parseElementaryValue = (variable, variableValue) => {
    // Elementary types
    if (variable.type === 'bool') {
        if (variableValue === '00') {
            return 'false'
        }
        if (variableValue === '01') {
            return 'true'
        }
        throw Error(
            `Failed to parse bool variable "${variable.name}" in slot ${variable.fromSlot}, offset ${variable.byteOffset} and slot value "${variableValue}"`,
        )
    }
    if (variable.type === 'string' || variable.type === 'bytes') {
        if (variable.dynamic) {
            const lastByte = variable.slotValue.slice(-2)
            const size = bignumber_1.BigNumber.from('0x' + lastByte)
            // Check if the last bit is set by AND the size with 0x01
            if (size.and(1).eq(1)) {
                // Return the number of chars or bytes
                return bignumber_1.BigNumber.from(variable.slotValue)
                    .sub(1)
                    .div(2)
                    .toString()
            }
            // The last byte holds the length of the string or bytes in the slot
            const valueHex = '0x' + variableValue.slice(0, size.toNumber())
            if (variable.type === 'bytes') {
                return valueHex
            }
            return `\\"${(0, exports.convert2String)(valueHex)}\\"`
        }
        if (variable.type === 'bytes') {
            return '0x' + variableValue
        }
        return `\\"${(0, exports.convert2String)('0x' + variableValue)}\\"`
    }
    if (variable.type === 'address') {
        return (0, utils_1.getAddress)('0x' + variableValue)
    }
    if (variable.type.match(/^uint([0-9]*)$/)) {
        const parsedValue = (0, utils_1.formatUnits)('0x' + variableValue, 0)
        return (0, utils_1.commify)(parsedValue)
    }
    if (variable.type.match(/^bytes([0-9]+)$/)) {
        return '0x' + variableValue
    }
    if (variable.type.match(/^int([0-9]*)/)) {
        // parse variable value as an unsigned number
        let rawValue = bignumber_1.BigNumber.from('0x' + variableValue)
        // parse the number of bits
        const result = variable.type.match(/^int([0-9]*$)/)
        const bitSize = result[1] ? result[1] : 256
        // Convert the number of bits to the number of hex characters
        const hexSize = bignumber_1.BigNumber.from(bitSize).div(4).toNumber()
        // bit mask has a leading 1 and the rest 0. 0x8 = 1000 binary
        const mask = '0x80' + '0'.repeat(hexSize - 2)
        // is the first bit a 1?
        const negative = rawValue.and(mask)
        if (negative.gt(0)) {
            // Convert unsigned number to a signed negative
            const negativeOne = '0xFF' + 'F'.repeat(hexSize - 2)
            rawValue = bignumber_1.BigNumber.from(negativeOne)
                .sub(rawValue)
                .add(1)
                .mul(-1)
        }
        const parsedValue = (0, utils_1.formatUnits)(rawValue, 0)
        return (0, utils_1.commify)(parsedValue)
    }
    // add fixed point numbers when they are supported by Solidity
    return undefined
}
let jsonRpcId = 0
/**
 * Get storage slot values from JSON-RPC API provider.
 * @param url of Ethereum JSON-RPC API provider. eg Infura or Alchemy
 * @param contractAddress Contract address to get the storage slot values from.
 * If proxied, use proxy and not the implementation contract.
 * @param slotKeys array of 32 byte slot keys as BigNumbers.
 * @param blockTag block number or `latest`
 * @return slotValues array of 32 byte slot values as hexadecimal strings
 */
const getSlotValues = async (
    url,
    contractAddress,
    slotKeys,
    blockTag = 'latest',
) => {
    try {
        if (slotKeys.length === 0) {
            return []
        }
        const block =
            blockTag === 'latest'
                ? blockTag
                : (0, utils_1.hexValue)(bignumber_1.BigNumber.from(blockTag))
        // get cached values and missing slot keys from the cache
        const { cachedValues, missingKeys } =
            SlotValueCache_1.SlotValueCache.readSlotValues(slotKeys)
        // If all values are in the cache then just return the cached values
        if (missingKeys.length === 0) {
            return cachedValues
        }
        // Check we are pointing to the correct chain by checking the contract has code
        const provider = new ethers_1.ethers.providers.JsonRpcProvider(url)
        const code = await provider.getCode(contractAddress, block)
        if (!code || code === '0x') {
            const msg = `Address ${contractAddress} has no code. Check your "-u, --url" option or "NODE_URL" environment variable is pointing to the correct node.\nurl: ${url}`
            console.error(msg)
            throw Error(msg)
        }
        debug(
            `About to get ${slotKeys.length} storage values for ${contractAddress} at block ${blockTag} from slot ${missingKeys[0].toString()}`,
        )
        // Get the values for the missing slot keys
        const payload = missingKeys.map((key) => ({
            id: (jsonRpcId++).toString(),
            jsonrpc: '2.0',
            method: 'eth_getStorageAt',
            params: [contractAddress, key, block],
        }))
        const response = await axios_1.default.post(url, payload)
        if (response.data?.error?.message) {
            throw Error(response.data.error.message)
        }
        if (response.data.length !== missingKeys.length) {
            throw Error(
                `Requested ${missingKeys.length} storage slot values but only got ${response.data.length}`,
            )
        }
        const responseData = response.data
        const sortedResponses = responseData.sort((a, b) =>
            bignumber_1.BigNumber.from(a.id).gt(b.id) ? 1 : -1,
        )
        const missingValues = sortedResponses.map((data) => {
            if (data.error) {
                throw Error(
                    `json rpc call with id ${data.id} failed to get storage values: ${data.error?.message}`,
                )
            }
            return '0x' + data.result.toUpperCase().slice(2)
        })
        // add new values to the cache and return the merged slot values
        return SlotValueCache_1.SlotValueCache.addSlotValues(
            slotKeys,
            missingKeys,
            missingValues,
        )
    } catch (err) {
        throw Error(
            `Failed to get ${slotKeys.length} storage values for contract ${contractAddress} from ${url}`,
            { cause: err },
        )
    }
}
exports.getSlotValues = getSlotValues
/**
 * Get storage slot values from JSON-RPC API provider.
 * @param url of Ethereum JSON-RPC API provider. eg Infura or Alchemy
 * @param contractAddress Contract address to get the storage slot values from.
 * If proxied, use proxy and not the implementation contract.
 * @param slotKey 32 byte slot key as a BigNumber.
 * @param blockTag block number or `latest`
 * @return slotValue 32 byte slot value as hexadecimal string
 */
const getSlotValue = async (url, contractAddress, slotKey, blockTag) => {
    debug(`About to get storage slot ${slotKey} value for ${contractAddress}`)
    const values = await (0, exports.getSlotValues)(
        url,
        contractAddress,
        [slotKey],
        blockTag,
    )
    return values[0]
}
exports.getSlotValue = getSlotValue
/**
 * Calculates the number of string characters or bytes of a string or bytes type.
 * See the following for how string and bytes are stored in storage slots
 * https://docs.soliditylang.org/en/v0.8.17/internals/layout_in_storage.html#bytes-and-string
 * @param variable the variable with the slotValue that is being sized
 * @return bytes the number of bytes of the dynamic slot. If static, zero is return.
 */
const dynamicSlotSize = (variable) => {
    try {
        if (!variable?.slotValue) {
            throw Error('Missing slot value.')
        }
        const last4bits = '0x' + variable.slotValue.slice(-1)
        const last4bitsNum = bignumber_1.BigNumber.from(last4bits).toNumber()
        // If the last 4 bits is an even number then it's not a dynamic slot
        if (last4bitsNum % 2 === 0) {
            return 0
        }
        const sizeRaw = bignumber_1.BigNumber.from(
            variable.slotValue,
        ).toNumber()
        // Adjust the size to bytes
        return (sizeRaw - 1) / 2
    } catch (err) {
        throw Error(
            `Failed to calculate dynamic slot size for variable "${variable?.name}" of type "${variable?.type}" with slot value ${variable?.slotValue}`,
            { cause: err },
        )
    }
}
exports.dynamicSlotSize = dynamicSlotSize
const convert2String = (bytes) => {
    if (
        bytes ===
        '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
        return ''
    }
    const rawString = (0, utils_1.toUtf8String)(bytes)
    return (0, exports.escapeString)(rawString)
}
exports.convert2String = convert2String
const escapeString = (text) => {
    return text.replace(/(?=[<>&"])/g, '\\')
}
exports.escapeString = escapeString
// # sourceMappingURL=slotValues.js.map
