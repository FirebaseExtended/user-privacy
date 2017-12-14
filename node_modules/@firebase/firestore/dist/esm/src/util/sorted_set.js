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
import { SortedMap } from './sorted_map';
/**
 * SortedSet is an immutable (copy-on-write) collection that holds elements
 * in order specified by the provided comparator.
 *
 * NOTE: if provided comparator returns 0 for two elements, we consider them to
 * be equal!
 */
var SortedSet = /** @class */ (function () {
    function SortedSet(comparator) {
        this.comparator = comparator;
        this.data = new SortedMap(this.comparator);
    }
    /**
     * Creates a SortedSet from the keys of the map.
     * This is currently implemented as an O(n) copy.
     */
    SortedSet.fromMapKeys = function (map) {
        var keys = new SortedSet(map.comparator);
        map.forEach(function (key) {
            keys = keys.add(key);
        });
        return keys;
    };
    SortedSet.prototype.has = function (elem) {
        return this.data.get(elem) !== null;
    };
    SortedSet.prototype.first = function () {
        return this.data.minKey();
    };
    SortedSet.prototype.last = function () {
        return this.data.maxKey();
    };
    Object.defineProperty(SortedSet.prototype, "size", {
        get: function () {
            return this.data.size;
        },
        enumerable: true,
        configurable: true
    });
    SortedSet.prototype.indexOf = function (elem) {
        return this.data.indexOf(elem);
    };
    /** Iterates elements in order defined by "comparator" */
    SortedSet.prototype.forEach = function (cb) {
        this.data.inorderTraversal(function (k, v) {
            cb(k);
            return false;
        });
    };
    /** Iterates over `elem`s such that: range[0] <= elem < range[1]. */
    SortedSet.prototype.forEachInRange = function (range, cb) {
        var iter = this.data.getIteratorFrom(range[0]);
        while (iter.hasNext()) {
            var elem = iter.getNext();
            if (this.comparator(elem.key, range[1]) >= 0)
                return;
            cb(elem.key);
        }
    };
    /**
     * Iterates over `elem`s such that: start <= elem until false is returned.
     */
    SortedSet.prototype.forEachWhile = function (cb, start) {
        var iter;
        if (start !== undefined) {
            iter = this.data.getIteratorFrom(start);
        }
        else {
            iter = this.data.getIterator();
        }
        while (iter.hasNext()) {
            var elem = iter.getNext();
            var result = cb(elem.key);
            if (!result)
                return;
        }
    };
    /** Finds the least element greater than or equal to `elem`. */
    SortedSet.prototype.firstAfterOrEqual = function (elem) {
        var iter = this.data.getIteratorFrom(elem);
        return iter.hasNext() ? iter.getNext().key : null;
    };
    /** Inserts or updates an element */
    SortedSet.prototype.add = function (elem) {
        return this.copy(this.data.remove(elem).insert(elem, true));
    };
    /** Deletes an element */
    SortedSet.prototype.delete = function (elem) {
        if (!this.has(elem))
            return this;
        return this.copy(this.data.remove(elem));
    };
    SortedSet.prototype.isEmpty = function () {
        return this.data.isEmpty();
    };
    SortedSet.prototype.unionWith = function (other) {
        var result = this;
        other.forEach(function (elem) {
            result = result.add(elem);
        });
        return result;
    };
    SortedSet.prototype.equals = function (other) {
        if (!(other instanceof SortedSet))
            return false;
        if (this.size !== other.size)
            return false;
        var thisIt = this.data.getIterator();
        var otherIt = other.data.getIterator();
        while (thisIt.hasNext()) {
            var thisElem = thisIt.getNext().key;
            var otherElem = otherIt.getNext().key;
            if (this.comparator(thisElem, otherElem) !== 0)
                return false;
        }
        return true;
    };
    SortedSet.prototype.toString = function () {
        var result = [];
        this.forEach(function (elem) { return result.push(elem); });
        return 'SortedSet(' + result.toString() + ')';
    };
    SortedSet.prototype.copy = function (data) {
        var result = new SortedSet(this.comparator);
        result.data = data;
        return result;
    };
    return SortedSet;
}());
export { SortedSet };

//# sourceMappingURL=sorted_set.js.map
