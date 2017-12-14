"use strict";
/**
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var assert_1 = require("../util/assert");
var misc_1 = require("../util/misc");
var sorted_map_1 = require("../util/sorted_map");
var document_key_1 = require("./document_key");
var TypeOrder;
(function (TypeOrder) {
    // This order is defined by the backend.
    TypeOrder[TypeOrder["NullValue"] = 0] = "NullValue";
    TypeOrder[TypeOrder["BooleanValue"] = 1] = "BooleanValue";
    TypeOrder[TypeOrder["NumberValue"] = 2] = "NumberValue";
    TypeOrder[TypeOrder["TimestampValue"] = 3] = "TimestampValue";
    TypeOrder[TypeOrder["StringValue"] = 4] = "StringValue";
    TypeOrder[TypeOrder["BlobValue"] = 5] = "BlobValue";
    TypeOrder[TypeOrder["RefValue"] = 6] = "RefValue";
    TypeOrder[TypeOrder["GeoPointValue"] = 7] = "GeoPointValue";
    TypeOrder[TypeOrder["ArrayValue"] = 8] = "ArrayValue";
    TypeOrder[TypeOrder["ObjectValue"] = 9] = "ObjectValue";
})(TypeOrder = exports.TypeOrder || (exports.TypeOrder = {}));
/**
 * A field value represents a datatype as stored by Firestore.
 */
var FieldValue = /** @class */ (function () {
    function FieldValue() {
    }
    FieldValue.prototype.toString = function () {
        var val = this.value();
        return val === null ? 'null' : val.toString();
    };
    FieldValue.prototype.defaultCompareTo = function (other) {
        assert_1.assert(this.typeOrder !== other.typeOrder, 'Default compareTo should not be used for values of same type.');
        var cmp = misc_1.primitiveComparator(this.typeOrder, other.typeOrder);
        return cmp;
    };
    return FieldValue;
}());
exports.FieldValue = FieldValue;
var NullValue = /** @class */ (function (_super) {
    __extends(NullValue, _super);
    function NullValue() {
        var _this = _super.call(this) || this;
        _this.typeOrder = TypeOrder.NullValue;
        // internalValue is unused but we add it to work around
        // https://github.com/Microsoft/TypeScript/issues/15585
        _this.internalValue = null;
        return _this;
    }
    NullValue.prototype.value = function () {
        return null;
    };
    NullValue.prototype.equals = function (other) {
        return other instanceof NullValue;
    };
    NullValue.prototype.compareTo = function (other) {
        if (other instanceof NullValue) {
            return 0;
        }
        return this.defaultCompareTo(other);
    };
    NullValue.INSTANCE = new NullValue();
    return NullValue;
}(FieldValue));
exports.NullValue = NullValue;
var BooleanValue = /** @class */ (function (_super) {
    __extends(BooleanValue, _super);
    function BooleanValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.BooleanValue;
        return _this;
    }
    BooleanValue.prototype.value = function () {
        return this.internalValue;
    };
    BooleanValue.prototype.equals = function (other) {
        return (other instanceof BooleanValue &&
            this.internalValue === other.internalValue);
    };
    BooleanValue.prototype.compareTo = function (other) {
        if (other instanceof BooleanValue) {
            return misc_1.primitiveComparator(this, other);
        }
        return this.defaultCompareTo(other);
    };
    BooleanValue.of = function (value) {
        return value ? BooleanValue.TRUE : BooleanValue.FALSE;
    };
    BooleanValue.TRUE = new BooleanValue(true);
    BooleanValue.FALSE = new BooleanValue(false);
    return BooleanValue;
}(FieldValue));
exports.BooleanValue = BooleanValue;
/** Base class for IntegerValue and DoubleValue. */
var NumberValue = /** @class */ (function (_super) {
    __extends(NumberValue, _super);
    function NumberValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.NumberValue;
        return _this;
    }
    NumberValue.prototype.value = function () {
        return this.internalValue;
    };
    NumberValue.prototype.compareTo = function (other) {
        if (other instanceof NumberValue) {
            return numericComparator(this.internalValue, other.internalValue);
        }
        return this.defaultCompareTo(other);
    };
    return NumberValue;
}(FieldValue));
exports.NumberValue = NumberValue;
/** Utility function to compare doubles (using Firestore semantics for NaN). */
function numericComparator(left, right) {
    if (left < right) {
        return -1;
    }
    else if (left > right) {
        return 1;
    }
    else if (left === right) {
        return 0;
    }
    else {
        // one or both are NaN.
        if (isNaN(left)) {
            return isNaN(right) ? 0 : -1;
        }
        else {
            return 1;
        }
    }
}
/**
 * Utility function to check numbers for equality using Firestore semantics
 * (NaN === NaN, -0.0 !== 0.0).
 */
function numericEquals(left, right) {
    // Implemented based on Object.is() polyfill from
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
    if (left === right) {
        // +0 != -0
        return left !== 0 || 1 / left === 1 / right;
    }
    else {
        // NaN == NaN
        return left !== left && right !== right;
    }
}
var IntegerValue = /** @class */ (function (_super) {
    __extends(IntegerValue, _super);
    function IntegerValue(internalValue) {
        return _super.call(this, internalValue) || this;
    }
    IntegerValue.prototype.equals = function (other) {
        // NOTE: DoubleValue and IntegerValue instances may compareTo() the same,
        // but that doesn't make them equal via equals().
        if (other instanceof IntegerValue) {
            return numericEquals(this.internalValue, other.internalValue);
        }
        else {
            return false;
        }
    };
    return IntegerValue;
}(NumberValue));
exports.IntegerValue = IntegerValue;
var DoubleValue = /** @class */ (function (_super) {
    __extends(DoubleValue, _super);
    function DoubleValue(internalValue) {
        var _this = _super.call(this, internalValue) || this;
        _this.internalValue = internalValue;
        return _this;
    }
    DoubleValue.prototype.equals = function (other) {
        // NOTE: DoubleValue and IntegerValue instances may compareTo() the same,
        // but that doesn't make them equal via equals().
        if (other instanceof DoubleValue) {
            return numericEquals(this.internalValue, other.internalValue);
        }
        else {
            return false;
        }
    };
    DoubleValue.NAN = new DoubleValue(NaN);
    DoubleValue.POSITIVE_INFINITY = new DoubleValue(Infinity);
    DoubleValue.NEGATIVE_INFINITY = new DoubleValue(-Infinity);
    return DoubleValue;
}(NumberValue));
exports.DoubleValue = DoubleValue;
// TODO(b/37267885): Add truncation support
var StringValue = /** @class */ (function (_super) {
    __extends(StringValue, _super);
    function StringValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.StringValue;
        return _this;
    }
    StringValue.prototype.value = function () {
        return this.internalValue;
    };
    StringValue.prototype.equals = function (other) {
        return (other instanceof StringValue && this.internalValue === other.internalValue);
    };
    StringValue.prototype.compareTo = function (other) {
        if (other instanceof StringValue) {
            return misc_1.primitiveComparator(this.internalValue, other.internalValue);
        }
        return this.defaultCompareTo(other);
    };
    return StringValue;
}(FieldValue));
exports.StringValue = StringValue;
var TimestampValue = /** @class */ (function (_super) {
    __extends(TimestampValue, _super);
    function TimestampValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.TimestampValue;
        return _this;
    }
    TimestampValue.prototype.value = function () {
        return this.internalValue.toDate();
    };
    TimestampValue.prototype.equals = function (other) {
        return (other instanceof TimestampValue &&
            this.internalValue.equals(other.internalValue));
    };
    TimestampValue.prototype.compareTo = function (other) {
        if (other instanceof TimestampValue) {
            return this.internalValue.compareTo(other.internalValue);
        }
        else if (other instanceof ServerTimestampValue) {
            // Concrete timestamps come before server timestamps.
            return -1;
        }
        else {
            return this.defaultCompareTo(other);
        }
    };
    return TimestampValue;
}(FieldValue));
exports.TimestampValue = TimestampValue;
/**
 * Represents a locally-applied ServerTimestamp.
 *
 * Notes:
 * - ServerTimestampValue instances are created as the result of applying a
 *   TransformMutation (see TransformMutation.applyTo()). They can only exist in
 *   the local view of a document. Therefore they do not need to be parsed or
 *   serialized.
 * - When evaluated locally (e.g. for snapshot.data()), they evaluate to null.
 * - With respect to other ServerTimestampValues, they sort by their
 *   localWriteTime.
 */
var ServerTimestampValue = /** @class */ (function (_super) {
    __extends(ServerTimestampValue, _super);
    function ServerTimestampValue(localWriteTime) {
        var _this = _super.call(this) || this;
        _this.localWriteTime = localWriteTime;
        _this.typeOrder = TypeOrder.TimestampValue;
        return _this;
    }
    ServerTimestampValue.prototype.value = function () {
        return null;
    };
    ServerTimestampValue.prototype.equals = function (other) {
        return (other instanceof ServerTimestampValue &&
            this.localWriteTime.equals(other.localWriteTime));
    };
    ServerTimestampValue.prototype.compareTo = function (other) {
        if (other instanceof ServerTimestampValue) {
            return this.localWriteTime.compareTo(other.localWriteTime);
        }
        else if (other instanceof TimestampValue) {
            // Server timestamps come after all concrete timestamps.
            return 1;
        }
        else {
            return this.defaultCompareTo(other);
        }
    };
    ServerTimestampValue.prototype.toString = function () {
        return '<ServerTimestamp localTime=' + this.localWriteTime.toString() + '>';
    };
    return ServerTimestampValue;
}(FieldValue));
exports.ServerTimestampValue = ServerTimestampValue;
var BlobValue = /** @class */ (function (_super) {
    __extends(BlobValue, _super);
    function BlobValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.BlobValue;
        return _this;
    }
    BlobValue.prototype.value = function () {
        return this.internalValue;
    };
    BlobValue.prototype.equals = function (other) {
        return (other instanceof BlobValue &&
            this.internalValue._equals(other.internalValue));
    };
    BlobValue.prototype.compareTo = function (other) {
        if (other instanceof BlobValue) {
            return this.internalValue._compareTo(other.internalValue);
        }
        return this.defaultCompareTo(other);
    };
    return BlobValue;
}(FieldValue));
exports.BlobValue = BlobValue;
var RefValue = /** @class */ (function (_super) {
    __extends(RefValue, _super);
    function RefValue(databaseId, key) {
        var _this = _super.call(this) || this;
        _this.databaseId = databaseId;
        _this.key = key;
        _this.typeOrder = TypeOrder.RefValue;
        return _this;
    }
    RefValue.prototype.value = function () {
        return this.key;
    };
    RefValue.prototype.equals = function (other) {
        if (other instanceof RefValue) {
            return (this.key.equals(other.key) && this.databaseId.equals(other.databaseId));
        }
        else {
            return false;
        }
    };
    RefValue.prototype.compareTo = function (other) {
        if (other instanceof RefValue) {
            var cmp = this.databaseId.compareTo(other.databaseId);
            return cmp !== 0 ? cmp : document_key_1.DocumentKey.comparator(this.key, other.key);
        }
        return this.defaultCompareTo(other);
    };
    return RefValue;
}(FieldValue));
exports.RefValue = RefValue;
var GeoPointValue = /** @class */ (function (_super) {
    __extends(GeoPointValue, _super);
    function GeoPointValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.GeoPointValue;
        return _this;
    }
    GeoPointValue.prototype.value = function () {
        return this.internalValue;
    };
    GeoPointValue.prototype.equals = function (other) {
        return (other instanceof GeoPointValue &&
            this.internalValue._equals(other.internalValue));
    };
    GeoPointValue.prototype.compareTo = function (other) {
        if (other instanceof GeoPointValue) {
            return this.internalValue._compareTo(other.internalValue);
        }
        return this.defaultCompareTo(other);
    };
    return GeoPointValue;
}(FieldValue));
exports.GeoPointValue = GeoPointValue;
var ObjectValue = /** @class */ (function (_super) {
    __extends(ObjectValue, _super);
    function ObjectValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.ObjectValue;
        return _this;
    }
    ObjectValue.prototype.value = function () {
        var result = {};
        this.internalValue.inorderTraversal(function (key, val) {
            result[key] = val.value();
        });
        return result;
    };
    ObjectValue.prototype.forEach = function (action) {
        this.internalValue.inorderTraversal(action);
    };
    ObjectValue.prototype.equals = function (other) {
        if (other instanceof ObjectValue) {
            var it1 = this.internalValue.getIterator();
            var it2 = other.internalValue.getIterator();
            while (it1.hasNext() && it2.hasNext()) {
                var next1 = it1.getNext();
                var next2 = it2.getNext();
                if (next1.key !== next2.key || !next1.value.equals(next2.value)) {
                    return false;
                }
            }
            return !it1.hasNext() && !it2.hasNext();
        }
        return false;
    };
    ObjectValue.prototype.compareTo = function (other) {
        if (other instanceof ObjectValue) {
            var it1 = this.internalValue.getIterator();
            var it2 = other.internalValue.getIterator();
            while (it1.hasNext() && it2.hasNext()) {
                var next1 = it1.getNext();
                var next2 = it2.getNext();
                var cmp = misc_1.primitiveComparator(next1.key, next2.key) ||
                    next1.value.compareTo(next2.value);
                if (cmp) {
                    return cmp;
                }
            }
            // Only equal if both iterators are exhausted
            return misc_1.primitiveComparator(it1.hasNext(), it2.hasNext());
        }
        else {
            return this.defaultCompareTo(other);
        }
    };
    ObjectValue.prototype.set = function (path, to) {
        assert_1.assert(!path.isEmpty(), 'Cannot set field for empty path on ObjectValue');
        if (path.length === 1) {
            return this.setChild(path.firstSegment(), to);
        }
        else {
            var child = this.child(path.firstSegment());
            if (!(child instanceof ObjectValue)) {
                child = ObjectValue.EMPTY;
            }
            var newChild = child.set(path.popFirst(), to);
            return this.setChild(path.firstSegment(), newChild);
        }
    };
    ObjectValue.prototype.delete = function (path) {
        assert_1.assert(!path.isEmpty(), 'Cannot delete field for empty path on ObjectValue');
        if (path.length === 1) {
            return new ObjectValue(this.internalValue.remove(path.firstSegment()));
        }
        else {
            // nested field
            var child = this.child(path.firstSegment());
            if (child instanceof ObjectValue) {
                var newChild = child.delete(path.popFirst());
                return new ObjectValue(this.internalValue.insert(path.firstSegment(), newChild));
            }
            else {
                // Don't actually change a primitive value to an object for a delete
                return this;
            }
        }
    };
    ObjectValue.prototype.contains = function (path) {
        return this.field(path) !== undefined;
    };
    ObjectValue.prototype.field = function (path) {
        assert_1.assert(!path.isEmpty(), "Can't get field of empty path");
        var field = this;
        path.forEach(function (pathSegment) {
            if (field instanceof ObjectValue) {
                field = field.internalValue.get(pathSegment) || undefined;
            }
            else {
                field = undefined;
            }
        });
        return field;
    };
    ObjectValue.prototype.toString = function () {
        return JSON.stringify(this.value());
    };
    ObjectValue.prototype.child = function (childName) {
        return this.internalValue.get(childName) || undefined;
    };
    ObjectValue.prototype.setChild = function (childName, value) {
        return new ObjectValue(this.internalValue.insert(childName, value));
    };
    ObjectValue.EMPTY = new ObjectValue(new sorted_map_1.SortedMap(misc_1.primitiveComparator));
    return ObjectValue;
}(FieldValue));
exports.ObjectValue = ObjectValue;
var ArrayValue = /** @class */ (function (_super) {
    __extends(ArrayValue, _super);
    function ArrayValue(internalValue) {
        var _this = _super.call(this) || this;
        _this.internalValue = internalValue;
        _this.typeOrder = TypeOrder.ArrayValue;
        return _this;
    }
    ArrayValue.prototype.value = function () {
        return this.internalValue.map(function (v) { return v.value(); });
    };
    ArrayValue.prototype.forEach = function (action) {
        this.internalValue.forEach(action);
    };
    ArrayValue.prototype.equals = function (other) {
        if (other instanceof ArrayValue) {
            if (this.internalValue.length !== other.internalValue.length) {
                return false;
            }
            for (var i = 0; i < this.internalValue.length; i++) {
                if (!this.internalValue[i].equals(other.internalValue[i])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    };
    ArrayValue.prototype.compareTo = function (other) {
        if (other instanceof ArrayValue) {
            var minLength = Math.min(this.internalValue.length, other.internalValue.length);
            for (var i = 0; i < minLength; i++) {
                var cmp = this.internalValue[i].compareTo(other.internalValue[i]);
                if (cmp) {
                    return cmp;
                }
            }
            return misc_1.primitiveComparator(this.internalValue.length, other.internalValue.length);
        }
        else {
            return this.defaultCompareTo(other);
        }
    };
    ArrayValue.prototype.toString = function () {
        return JSON.stringify(this.value());
    };
    return ArrayValue;
}(FieldValue));
exports.ArrayValue = ArrayValue;

//# sourceMappingURL=field_value.js.map
