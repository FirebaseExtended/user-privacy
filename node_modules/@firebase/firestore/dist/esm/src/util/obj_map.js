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
import * as objUtil from './obj';
/**
 * A map implementation that uses objects as keys. Objects must implement the
 * Equatable interface and must be immutable. Entries in the map are stored
 * together with the key being produced from the mapKeyFn. This map
 * automatically handles collisions of keys.
 */
var ObjectMap = /** @class */ (function () {
    function ObjectMap(mapKeyFn) {
        this.mapKeyFn = mapKeyFn;
        /**
         * The inner map for a key -> value pair. Due to the possibility of
         * collisions we keep a list of entries that we do a linear search through
         * to find an actual match. Note that collisions should be rare, so we still
         * expect near constant time lookups in practice.
         */
        this.inner = {};
    }
    /** Get a value for this key, or undefined if it does not exist. */
    ObjectMap.prototype.get = function (key) {
        var id = this.mapKeyFn(key);
        var matches = this.inner[id];
        if (matches === undefined) {
            return undefined;
        }
        for (var _i = 0, matches_1 = matches; _i < matches_1.length; _i++) {
            var _a = matches_1[_i], otherKey = _a[0], value = _a[1];
            if (otherKey.equals(key)) {
                return value;
            }
        }
        return undefined;
    };
    ObjectMap.prototype.has = function (key) {
        return this.get(key) !== undefined;
    };
    /** Put this key and value in the map. */
    ObjectMap.prototype.set = function (key, value) {
        var id = this.mapKeyFn(key);
        var matches = this.inner[id];
        if (matches === undefined) {
            this.inner[id] = [[key, value]];
            return;
        }
        for (var i = 0; i < matches.length; i++) {
            if (matches[i][0].equals(key)) {
                matches[i] = [key, value];
                return;
            }
        }
        matches.push([key, value]);
    };
    /**
     * Remove this key from the map. Returns a boolean if anything was deleted.
     */
    ObjectMap.prototype.delete = function (key) {
        var id = this.mapKeyFn(key);
        var matches = this.inner[id];
        if (matches === undefined) {
            return false;
        }
        for (var i = 0; i < matches.length; i++) {
            if (matches[i][0].equals(key)) {
                if (matches.length === 1) {
                    delete this.inner[id];
                }
                else {
                    matches.splice(i, 1);
                }
                return true;
            }
        }
        return false;
    };
    ObjectMap.prototype.forEach = function (fn) {
        objUtil.forEach(this.inner, function (_, entries) {
            for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                var _a = entries_1[_i], k = _a[0], v = _a[1];
                fn(k, v);
            }
        });
    };
    ObjectMap.prototype.isEmpty = function () {
        return objUtil.isEmpty(this.inner);
    };
    return ObjectMap;
}());
export { ObjectMap };

//# sourceMappingURL=obj_map.js.map
