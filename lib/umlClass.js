'use strict'
Object.defineProperty(exports, '__esModule', { value: true })
exports.UmlClass =
    exports.ReferenceType =
    exports.AttributeType =
    exports.OperatorStereotype =
    exports.ClassStereotype =
    exports.Visibility =
        void 0
let Visibility
;(function (Visibility) {
    Visibility[(Visibility.None = 0)] = 'None'
    Visibility[(Visibility.Public = 1)] = 'Public'
    Visibility[(Visibility.External = 2)] = 'External'
    Visibility[(Visibility.Internal = 3)] = 'Internal'
    Visibility[(Visibility.Private = 4)] = 'Private'
})(Visibility || (exports.Visibility = Visibility = {}))
let ClassStereotype
;(function (ClassStereotype) {
    ClassStereotype[(ClassStereotype.None = 0)] = 'None'
    ClassStereotype[(ClassStereotype.Library = 1)] = 'Library'
    ClassStereotype[(ClassStereotype.Interface = 2)] = 'Interface'
    ClassStereotype[(ClassStereotype.Abstract = 3)] = 'Abstract'
    ClassStereotype[(ClassStereotype.Contract = 4)] = 'Contract'
    ClassStereotype[(ClassStereotype.Struct = 5)] = 'Struct'
    ClassStereotype[(ClassStereotype.Enum = 6)] = 'Enum'
    ClassStereotype[(ClassStereotype.Constant = 7)] = 'Constant'
    ClassStereotype[(ClassStereotype.Import = 8)] = 'Import'
})(ClassStereotype || (exports.ClassStereotype = ClassStereotype = {}))
let OperatorStereotype
;(function (OperatorStereotype) {
    OperatorStereotype[(OperatorStereotype.None = 0)] = 'None'
    OperatorStereotype[(OperatorStereotype.Modifier = 1)] = 'Modifier'
    OperatorStereotype[(OperatorStereotype.Event = 2)] = 'Event'
    OperatorStereotype[(OperatorStereotype.Payable = 3)] = 'Payable'
    OperatorStereotype[(OperatorStereotype.Fallback = 4)] = 'Fallback'
    OperatorStereotype[(OperatorStereotype.Abstract = 5)] = 'Abstract'
})(OperatorStereotype || (exports.OperatorStereotype = OperatorStereotype = {}))
let AttributeType
;(function (AttributeType) {
    AttributeType[(AttributeType.Elementary = 0)] = 'Elementary'
    AttributeType[(AttributeType.UserDefined = 1)] = 'UserDefined'
    AttributeType[(AttributeType.Function = 2)] = 'Function'
    AttributeType[(AttributeType.Array = 3)] = 'Array'
    AttributeType[(AttributeType.Mapping = 4)] = 'Mapping'
})(AttributeType || (exports.AttributeType = AttributeType = {}))
let ReferenceType
;(function (ReferenceType) {
    ReferenceType[(ReferenceType.Memory = 0)] = 'Memory'
    ReferenceType[(ReferenceType.Storage = 1)] = 'Storage'
})(ReferenceType || (exports.ReferenceType = ReferenceType = {}))
class UmlClass {
    constructor(properties) {
        this.imports = []
        this.constants = []
        this.attributes = []
        this.operators = []
        this.enums = []
        this.structs = []
        this.associations = {}
        if (!properties || !properties.name) {
            throw TypeError(
                'Failed to instantiate UML Class with no name property',
            )
        }
        Object.assign(this, properties)
        // Generate a unique identifier for this UML Class
        this.id = UmlClass.idCounter++
    }

    addAssociation(association) {
        if (!association || !association.targetUmlClassName) {
            throw TypeError(
                'Failed to add association. targetUmlClassName was missing',
            )
        }
        // If association doesn't already exist
        if (!this.associations[association.targetUmlClassName]) {
            this.associations[association.targetUmlClassName] = association
        }
        // associate already exists
        else {
            // If new attribute reference type is Storage
            if (association.referenceType === ReferenceType.Storage) {
                this.associations[
                    association.targetUmlClassName
                ].referenceType = ReferenceType.Storage
            }
        }
    }

    /**
     * Gets the immediate parent contracts this class inherits from.
     * Does not include any grand parent associations. That has to be done recursively.
     */
    getParentContracts() {
        return Object.values(this.associations).filter(
            (association) => association.realization,
        )
    }
}
exports.UmlClass = UmlClass
UmlClass.idCounter = 0
// # sourceMappingURL=umlClass.js.map
