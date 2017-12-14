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
Object.defineProperty(exports, "__esModule", { value: true });
var assert_1 = require("./assert");
function contains(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
exports.contains = contains;
function get(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
}
exports.get = get;
function size(obj) {
    var count = 0;
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            count++;
        }
    }
    return count;
}
exports.size = size;
/** Returns the given value if it's defined or the defaultValue otherwise. */
function defaulted(value, defaultValue) {
    return value !== undefined ? value : defaultValue;
}
exports.defaulted = defaulted;
function forEachNumber(obj, fn) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            var num = parseInt(key, 10);
            if (!isNaN(num)) {
                fn(num, obj[key]);
            }
        }
    }
}
exports.forEachNumber = forEachNumber;
function forEach(obj, fn) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn(key, obj[key]);
        }
    }
}
exports.forEach = forEach;
function lookupOrInsert(obj, key, valFn) {
    if (!contains(obj, key)) {
        obj[key] = valFn();
    }
    return obj[key];
}
exports.lookupOrInsert = lookupOrInsert;
function isEmpty(obj) {
    assert_1.assert(obj != null && typeof obj === 'object', 'isEmpty() expects object parameter.');
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}
exports.isEmpty = isEmpty;
function shallowCopy(obj) {
    assert_1.assert(obj && typeof obj === 'object', 'shallowCopy() expects object parameter.');
    var result = {};
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = obj[key];
        }
    }
    return result;
}
exports.shallowCopy = shallowCopy;

//# sourceMappingURL=obj.js.map
