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
import { assert } from './assert';
export function contains(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
export function get(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : null;
}
export function size(obj) {
    var count = 0;
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            count++;
        }
    }
    return count;
}
/** Returns the given value if it's defined or the defaultValue otherwise. */
export function defaulted(value, defaultValue) {
    return value !== undefined ? value : defaultValue;
}
export function forEachNumber(obj, fn) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            var num = parseInt(key, 10);
            if (!isNaN(num)) {
                fn(num, obj[key]);
            }
        }
    }
}
export function forEach(obj, fn) {
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn(key, obj[key]);
        }
    }
}
export function lookupOrInsert(obj, key, valFn) {
    if (!contains(obj, key)) {
        obj[key] = valFn();
    }
    return obj[key];
}
export function isEmpty(obj) {
    assert(obj != null && typeof obj === 'object', 'isEmpty() expects object parameter.');
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            return false;
        }
    }
    return true;
}
export function shallowCopy(obj) {
    assert(obj && typeof obj === 'object', 'shallowCopy() expects object parameter.');
    var result = {};
    for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = obj[key];
        }
    }
    return result;
}

//# sourceMappingURL=obj.js.map
