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
// Untyped Number alias we can use to check for ES6 methods / properties.
// tslint:disable-next-line:no-any variable-name
var NumberAsAny = Number;
/**
 * Minimum safe integer in Javascript because of floating point precision.
 * Added to not rely on ES6 features.
 */
exports.MIN_SAFE_INTEGER = NumberAsAny.MIN_SAFE_INTEGER || -(Math.pow(2, 53) - 1);
/**
 * Maximum safe integer in Javascript because of floating point precision.
 * Added to not rely on ES6 features.
 */
exports.MAX_SAFE_INTEGER = NumberAsAny.MAX_SAFE_INTEGER || Math.pow(2, 53) - 1;
/**
 * Returns whether an number is an integer, uses native implementation if
 * available.
 * Added to not rely on ES6 features.
 * @param value The value to test for being an integer
 */
exports.isInteger = NumberAsAny.isInteger ||
    (function (value) {
        return typeof value === 'number' &&
            isFinite(value) &&
            Math.floor(value) === value;
    });
/**
 * Returns whether a variable is either undefined or null.
 */
function isNullOrUndefined(value) {
    return value === null || value === undefined;
}
exports.isNullOrUndefined = isNullOrUndefined;
/**
 * Returns whether a value is an integer and in the safe integer range
 * @param value The value to test for being an integer and in the safe range
 */
function isSafeInteger(value) {
    return (exports.isInteger(value) &&
        value <= exports.MAX_SAFE_INTEGER &&
        value >= exports.MIN_SAFE_INTEGER);
}
exports.isSafeInteger = isSafeInteger;
/**
 * Safely checks if the number is NaN.
 */
function safeIsNaN(value) {
    if (NumberAsAny.IsNaN) {
        return NumberAsAny.IsNaN(value);
    }
    else {
        return typeof value === 'number' && isNaN(value);
    }
}
exports.safeIsNaN = safeIsNaN;

//# sourceMappingURL=types.js.map
