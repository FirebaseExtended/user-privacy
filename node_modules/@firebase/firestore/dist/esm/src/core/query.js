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
import { Document } from '../model/document';
import { DocumentKey } from '../model/document_key';
import { DoubleValue, NullValue, RefValue } from '../model/field_value';
import { FieldPath } from '../model/path';
import { assert, fail } from '../util/assert';
import { Code, FirestoreError } from '../util/error';
import { isNullOrUndefined } from '../util/types';
var Query = /** @class */ (function () {
    function Query(path, explicitOrderBy, filters, limit, startAt, endAt) {
        if (explicitOrderBy === void 0) { explicitOrderBy = []; }
        if (filters === void 0) { filters = []; }
        if (limit === void 0) { limit = null; }
        if (startAt === void 0) { startAt = null; }
        if (endAt === void 0) { endAt = null; }
        this.path = path;
        this.explicitOrderBy = explicitOrderBy;
        this.filters = filters;
        this.limit = limit;
        this.startAt = startAt;
        this.endAt = endAt;
        this.memoizedCanonicalId = null;
        this.memoizedOrderBy = null;
        if (this.startAt) {
            this.assertValidBound(this.startAt);
        }
        if (this.endAt) {
            this.assertValidBound(this.endAt);
        }
    }
    Query.atPath = function (path) {
        return new Query(path);
    };
    Object.defineProperty(Query.prototype, "orderBy", {
        get: function () {
            if (this.memoizedOrderBy === null) {
                var inequalityField = this.getInequalityFilterField();
                var firstOrderByField = this.getFirstOrderByField();
                if (inequalityField !== null && firstOrderByField === null) {
                    // In order to implicitly add key ordering, we must also add the
                    // inequality filter field for it to be a valid query.
                    // Note that the default inequality field and key ordering is ascending.
                    if (inequalityField.isKeyField()) {
                        this.memoizedOrderBy = [KEY_ORDERING_ASC];
                    }
                    else {
                        this.memoizedOrderBy = [
                            new OrderBy(inequalityField),
                            KEY_ORDERING_ASC
                        ];
                    }
                }
                else {
                    assert(inequalityField === null ||
                        (firstOrderByField !== null &&
                            inequalityField.equals(firstOrderByField)), 'First orderBy should match inequality field.');
                    this.memoizedOrderBy = [];
                    var foundKeyOrdering = false;
                    for (var _i = 0, _a = this.explicitOrderBy; _i < _a.length; _i++) {
                        var orderBy = _a[_i];
                        this.memoizedOrderBy.push(orderBy);
                        if (orderBy.field.isKeyField()) {
                            foundKeyOrdering = true;
                        }
                    }
                    if (!foundKeyOrdering) {
                        // The order of the implicit key ordering always matches the last
                        // explicit order by
                        var lastDirection = this.explicitOrderBy.length > 0
                            ? this.explicitOrderBy[this.explicitOrderBy.length - 1].dir
                            : Direction.ASCENDING;
                        this.memoizedOrderBy.push(lastDirection === Direction.ASCENDING
                            ? KEY_ORDERING_ASC
                            : KEY_ORDERING_DESC);
                    }
                }
            }
            return this.memoizedOrderBy;
        },
        enumerable: true,
        configurable: true
    });
    Query.prototype.addFilter = function (filter) {
        assert(this.getInequalityFilterField() == null ||
            !(filter instanceof RelationFilter) ||
            !filter.isInequality() ||
            filter.field.equals(this.getInequalityFilterField()), 'Query must only have one inequality field.');
        assert(!DocumentKey.isDocumentKey(this.path), 'No filtering allowed for document query');
        var newFilters = this.filters.concat([filter]);
        return new Query(this.path, this.explicitOrderBy.slice(), newFilters, this.limit, this.startAt, this.endAt);
    };
    Query.prototype.addOrderBy = function (orderBy) {
        assert(!DocumentKey.isDocumentKey(this.path), 'No ordering allowed for document query');
        assert(!this.startAt && !this.endAt, 'Bounds must be set after orderBy');
        // TODO(dimond): validate that orderBy does not list the same key twice.
        var newOrderBy = this.explicitOrderBy.concat([orderBy]);
        return new Query(this.path, newOrderBy, this.filters.slice(), this.limit, this.startAt, this.endAt);
    };
    Query.prototype.withLimit = function (limit) {
        return new Query(this.path, this.explicitOrderBy.slice(), this.filters.slice(), limit, this.startAt, this.endAt);
    };
    Query.prototype.withStartAt = function (bound) {
        return new Query(this.path, this.explicitOrderBy.slice(), this.filters.slice(), this.limit, bound, this.endAt);
    };
    Query.prototype.withEndAt = function (bound) {
        return new Query(this.path, this.explicitOrderBy.slice(), this.filters.slice(), this.limit, this.startAt, bound);
    };
    // TODO(b/29183165): This is used to get a unique string from a query to, for
    // example, use as a dictionary key, but the implementation is subject to
    // collisions. Make it collision-free.
    Query.prototype.canonicalId = function () {
        if (this.memoizedCanonicalId === null) {
            var canonicalId = this.path.canonicalString();
            canonicalId += '|f:';
            for (var _i = 0, _a = this.filters; _i < _a.length; _i++) {
                var filter = _a[_i];
                canonicalId += filter.canonicalId();
                canonicalId += ',';
            }
            canonicalId += '|ob:';
            // TODO(dimond): make this collision resistant
            for (var _b = 0, _c = this.orderBy; _b < _c.length; _b++) {
                var orderBy = _c[_b];
                canonicalId += orderBy.canonicalId();
                canonicalId += ',';
            }
            if (!isNullOrUndefined(this.limit)) {
                canonicalId += '|l:';
                canonicalId += this.limit;
            }
            if (this.startAt) {
                canonicalId += '|lb:';
                canonicalId += this.startAt.canonicalId();
            }
            if (this.endAt) {
                canonicalId += '|ub:';
                canonicalId += this.endAt.canonicalId();
            }
            this.memoizedCanonicalId = canonicalId;
        }
        return this.memoizedCanonicalId;
    };
    Query.prototype.toString = function () {
        var str = 'Query(' + this.path.canonicalString();
        if (this.filters.length > 0) {
            str += ", filters: [" + this.filters.join(', ') + "]";
        }
        if (!isNullOrUndefined(this.limit)) {
            str += ', limit: ' + this.limit;
        }
        if (this.explicitOrderBy.length > 0) {
            str += ", orderBy: [" + this.explicitOrderBy.join(', ') + "]";
        }
        if (this.startAt) {
            str += ', startAt: ' + this.startAt.canonicalId();
        }
        if (this.endAt) {
            str += ', endAt: ' + this.endAt.canonicalId();
        }
        return str + ')';
    };
    Query.prototype.equals = function (other) {
        if (this.limit !== other.limit) {
            return false;
        }
        if (this.orderBy.length !== other.orderBy.length) {
            return false;
        }
        for (var i = 0; i < this.orderBy.length; i++) {
            if (!this.orderBy[i].equals(other.orderBy[i])) {
                return false;
            }
        }
        if (this.filters.length !== other.filters.length) {
            return false;
        }
        for (var i = 0; i < this.filters.length; i++) {
            if (!this.filters[i].equals(other.filters[i])) {
                return false;
            }
        }
        if (!this.path.equals(other.path)) {
            return false;
        }
        if (this.startAt !== null
            ? !this.startAt.equals(other.startAt)
            : other.startAt !== null) {
            return false;
        }
        return this.endAt !== null
            ? this.endAt.equals(other.endAt)
            : other.endAt === null;
    };
    Query.prototype.docComparator = function (d1, d2) {
        var comparedOnKeyField = false;
        for (var _i = 0, _a = this.orderBy; _i < _a.length; _i++) {
            var orderBy = _a[_i];
            var comp = orderBy.compare(d1, d2);
            if (comp !== 0)
                return comp;
            comparedOnKeyField = comparedOnKeyField || orderBy.field.isKeyField();
        }
        // Assert that we actually compared by key
        assert(comparedOnKeyField, "orderBy used that doesn't compare on key field");
        return 0;
    };
    Query.prototype.matches = function (doc) {
        return (this.matchesAncestor(doc) &&
            this.matchesOrderBy(doc) &&
            this.matchesFilters(doc) &&
            this.matchesBounds(doc));
    };
    Query.prototype.hasLimit = function () {
        return !isNullOrUndefined(this.limit);
    };
    Query.prototype.getFirstOrderByField = function () {
        return this.explicitOrderBy.length > 0
            ? this.explicitOrderBy[0].field
            : null;
    };
    Query.prototype.getInequalityFilterField = function () {
        for (var _i = 0, _a = this.filters; _i < _a.length; _i++) {
            var filter = _a[_i];
            if (filter instanceof RelationFilter && filter.isInequality()) {
                return filter.field;
            }
        }
        return null;
    };
    Query.prototype.isDocumentQuery = function () {
        return DocumentKey.isDocumentKey(this.path) && this.filters.length === 0;
    };
    Query.prototype.matchesAncestor = function (doc) {
        var docPath = doc.key.path;
        if (DocumentKey.isDocumentKey(this.path)) {
            // exact match for document queries
            return this.path.equals(docPath);
        }
        else {
            // shallow ancestor queries by default
            return (this.path.isPrefixOf(docPath) && this.path.length === docPath.length - 1);
        }
    };
    /**
     * A document must have a value for every ordering clause in order to show up
     * in the results.
     */
    Query.prototype.matchesOrderBy = function (doc) {
        for (var _i = 0, _a = this.explicitOrderBy; _i < _a.length; _i++) {
            var orderBy = _a[_i];
            // order by key always matches
            if (!orderBy.field.isKeyField() &&
                doc.field(orderBy.field) === undefined) {
                return false;
            }
        }
        return true;
    };
    Query.prototype.matchesFilters = function (doc) {
        for (var _i = 0, _a = this.filters; _i < _a.length; _i++) {
            var filter = _a[_i];
            if (!filter.matches(doc)) {
                return false;
            }
        }
        return true;
    };
    /**
     * Makes sure a document is within the bounds, if provided.
     */
    Query.prototype.matchesBounds = function (doc) {
        if (this.startAt && !this.startAt.sortsBeforeDocument(this.orderBy, doc)) {
            return false;
        }
        if (this.endAt && this.endAt.sortsBeforeDocument(this.orderBy, doc)) {
            return false;
        }
        return true;
    };
    Query.prototype.assertValidBound = function (bound) {
        assert(bound.position.length <= this.orderBy.length, 'Bound is longer than orderBy');
    };
    return Query;
}());
export { Query };
var RelationOp = /** @class */ (function () {
    function RelationOp(name) {
        this.name = name;
    }
    RelationOp.fromString = function (op) {
        switch (op) {
            case '<':
                return RelationOp.LESS_THAN;
            case '<=':
                return RelationOp.LESS_THAN_OR_EQUAL;
            case '==':
                return RelationOp.EQUAL;
            case '>=':
                return RelationOp.GREATER_THAN_OR_EQUAL;
            case '>':
                return RelationOp.GREATER_THAN;
            default:
                return fail('Unknown relation: ' + op);
        }
    };
    RelationOp.prototype.toString = function () {
        return this.name;
    };
    RelationOp.prototype.equals = function (other) {
        return this.name === other.name;
    };
    RelationOp.LESS_THAN = new RelationOp('<');
    RelationOp.LESS_THAN_OR_EQUAL = new RelationOp('<=');
    RelationOp.EQUAL = new RelationOp('==');
    RelationOp.GREATER_THAN = new RelationOp('>');
    RelationOp.GREATER_THAN_OR_EQUAL = new RelationOp('>=');
    return RelationOp;
}());
export { RelationOp };
var RelationFilter = /** @class */ (function () {
    function RelationFilter(field, op, value) {
        this.field = field;
        this.op = op;
        this.value = value;
    }
    RelationFilter.prototype.matches = function (doc) {
        if (this.field.isKeyField()) {
            assert(this.value instanceof RefValue, 'Comparing on key, but filter value not a RefValue');
            var refValue = this.value;
            var comparison = DocumentKey.comparator(doc.key, refValue.key);
            return this.matchesComparison(comparison);
        }
        else {
            var val = doc.field(this.field);
            return val !== undefined && this.matchesValue(val);
        }
    };
    RelationFilter.prototype.matchesValue = function (value) {
        // Only compare types with matching backend order (such as double and int).
        if (this.value.typeOrder !== value.typeOrder) {
            return false;
        }
        return this.matchesComparison(value.compareTo(this.value));
    };
    RelationFilter.prototype.matchesComparison = function (comparison) {
        switch (this.op) {
            case RelationOp.LESS_THAN:
                return comparison < 0;
            case RelationOp.LESS_THAN_OR_EQUAL:
                return comparison <= 0;
            case RelationOp.EQUAL:
                return comparison === 0;
            case RelationOp.GREATER_THAN:
                return comparison > 0;
            case RelationOp.GREATER_THAN_OR_EQUAL:
                return comparison >= 0;
            default:
                return fail('Unknown relation op' + this.op);
        }
    };
    RelationFilter.prototype.isInequality = function () {
        return this.op !== RelationOp.EQUAL;
    };
    RelationFilter.prototype.canonicalId = function () {
        // TODO(b/29183165): Technically, this won't be unique if two values have
        // the same description, such as the int 3 and the string "3". So we should
        // add the types in here somehow, too.
        return (this.field.canonicalString() + this.op.toString() + this.value.toString());
    };
    RelationFilter.prototype.equals = function (other) {
        if (other instanceof RelationFilter) {
            return (this.op.equals(other.op) &&
                this.field.equals(other.field) &&
                this.value.equals(other.value));
        }
        else {
            return false;
        }
    };
    RelationFilter.prototype.toString = function () {
        return this.field.canonicalString() + " " + this.op + " " + this.value.value();
    };
    return RelationFilter;
}());
export { RelationFilter };
/**
 * Filter that matches 'null' values.
 */
var NullFilter = /** @class */ (function () {
    function NullFilter(field) {
        this.field = field;
    }
    NullFilter.prototype.matches = function (doc) {
        var val = doc.field(this.field);
        return val !== undefined && val.value() === null;
    };
    NullFilter.prototype.canonicalId = function () {
        return this.field.canonicalString() + ' IS null';
    };
    NullFilter.prototype.toString = function () {
        return this.field.canonicalString() + " IS null";
    };
    NullFilter.prototype.equals = function (other) {
        if (other instanceof NullFilter) {
            return this.field.equals(other.field);
        }
        else {
            return false;
        }
    };
    return NullFilter;
}());
export { NullFilter };
/**
 * Filter that matches 'NaN' values.
 */
var NanFilter = /** @class */ (function () {
    function NanFilter(field) {
        this.field = field;
    }
    NanFilter.prototype.matches = function (doc) {
        var val = doc.field(this.field).value();
        return typeof val === 'number' && isNaN(val);
    };
    NanFilter.prototype.canonicalId = function () {
        return this.field.canonicalString() + ' IS NaN';
    };
    NanFilter.prototype.toString = function () {
        return this.field.canonicalString() + " IS NaN";
    };
    NanFilter.prototype.equals = function (other) {
        if (other instanceof NanFilter) {
            return this.field.equals(other.field);
        }
        else {
            return false;
        }
    };
    return NanFilter;
}());
export { NanFilter };
/**
 * Creates a filter based on the provided arguments.
 */
export function fieldFilter(field, op, value) {
    if (value.equals(NullValue.INSTANCE)) {
        if (op !== RelationOp.EQUAL) {
            throw new FirestoreError(Code.INVALID_ARGUMENT, 'Invalid query. You can only perform equals ' + 'comparisons on null.');
        }
        return new NullFilter(field);
    }
    else if (value.equals(DoubleValue.NAN)) {
        if (op !== RelationOp.EQUAL) {
            throw new FirestoreError(Code.INVALID_ARGUMENT, 'Invalid query. You can only perform equals ' + 'comparisons on NaN.');
        }
        return new NanFilter(field);
    }
    else {
        return new RelationFilter(field, op, value);
    }
}
/**
 * The direction of sorting in an order by.
 */
var Direction = /** @class */ (function () {
    function Direction(name) {
        this.name = name;
    }
    Direction.prototype.toString = function () {
        return this.name;
    };
    Direction.ASCENDING = new Direction('asc');
    Direction.DESCENDING = new Direction('desc');
    return Direction;
}());
export { Direction };
/**
 * Represents a bound of a query.
 *
 * The bound is specified with the given components representing a position and
 * whether it's just before or just after the position (relative to whatever the
 * query order is).
 *
 * The position represents a logical index position for a query. It's a prefix
 * of values for the (potentially implicit) order by clauses of a query.
 *
 * Bound provides a function to determine whether a document comes before or
 * after a bound. This is influenced by whether the position is just before or
 * just after the provided values.
 */
var Bound = /** @class */ (function () {
    function Bound(position, before) {
        this.position = position;
        this.before = before;
    }
    Bound.prototype.canonicalId = function () {
        // TODO(b/29183165): Make this collision robust.
        var canonicalId = this.before ? 'b:' : 'a:';
        for (var _i = 0, _a = this.position; _i < _a.length; _i++) {
            var component = _a[_i];
            canonicalId += component.toString();
        }
        return canonicalId;
    };
    /**
     * Returns true if a document sorts before a bound using the provided sort
     * order.
     */
    Bound.prototype.sortsBeforeDocument = function (orderBy, doc) {
        assert(this.position.length <= orderBy.length, "Bound has more components than query's orderBy");
        var comparison = 0;
        for (var i = 0; i < this.position.length; i++) {
            var orderByComponent = orderBy[i];
            var component = this.position[i];
            if (orderByComponent.field.isKeyField()) {
                assert(component instanceof RefValue, 'Bound has a non-key value where the key path is being used.');
                comparison = DocumentKey.comparator(component.key, doc.key);
            }
            else {
                var docValue = doc.field(orderByComponent.field);
                assert(docValue !== undefined, 'Field should exist since document matched the orderBy already.');
                comparison = component.compareTo(docValue);
            }
            if (orderByComponent.dir === Direction.DESCENDING) {
                comparison = comparison * -1;
            }
            if (comparison !== 0) {
                break;
            }
        }
        return this.before ? comparison <= 0 : comparison < 0;
    };
    Bound.prototype.equals = function (other) {
        if (other === null) {
            return false;
        }
        if (this.before !== other.before ||
            this.position.length !== other.position.length) {
            return false;
        }
        for (var i = 0; i < this.position.length; i++) {
            var thisPosition = this.position[i];
            var otherPosition = other.position[i];
            return thisPosition.equals(otherPosition);
        }
        return true;
    };
    return Bound;
}());
export { Bound };
/**
 * An ordering on a field, in some Direction. Direction defaults to ASCENDING.
 */
var OrderBy = /** @class */ (function () {
    function OrderBy(field, dir) {
        this.field = field;
        if (dir === undefined) {
            dir = Direction.ASCENDING;
        }
        this.dir = dir;
        this.isKeyOrderBy = field.isKeyField();
    }
    OrderBy.prototype.compare = function (d1, d2) {
        var comparison = this.isKeyOrderBy
            ? Document.compareByKey(d1, d2)
            : Document.compareByField(this.field, d1, d2);
        switch (this.dir) {
            case Direction.ASCENDING:
                return comparison;
            case Direction.DESCENDING:
                return -1 * comparison;
            default:
                return fail('Unknown direction: ' + this.dir);
        }
    };
    OrderBy.prototype.canonicalId = function () {
        // TODO(b/29183165): Make this collision robust.
        return this.field.canonicalString() + this.dir.toString();
    };
    OrderBy.prototype.toString = function () {
        return this.field.canonicalString() + " (" + this.dir + ")";
    };
    OrderBy.prototype.equals = function (other) {
        return this.dir === other.dir && this.field.equals(other.field);
    };
    return OrderBy;
}());
export { OrderBy };
var KEY_ORDERING_ASC = new OrderBy(FieldPath.keyField(), Direction.ASCENDING);
var KEY_ORDERING_DESC = new OrderBy(FieldPath.keyField(), Direction.DESCENDING);

//# sourceMappingURL=query.js.map
