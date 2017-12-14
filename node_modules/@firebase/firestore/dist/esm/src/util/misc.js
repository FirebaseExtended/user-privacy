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
// tslint:disable-next-line:class-as-namespace
var AutoId = /** @class */ (function () {
    function AutoId() {
    }
    AutoId.newId = function () {
        // Alphanumeric characters
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var autoId = '';
        for (var i = 0; i < 20; i++) {
            autoId += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        assert(autoId.length === 20, 'Invalid auto ID: ' + autoId);
        return autoId;
    };
    return AutoId;
}());
export { AutoId };
export function primitiveComparator(left, right) {
    if (left < right)
        return -1;
    if (left > right)
        return 1;
    return 0;
}
/** Helper to compare nullable (or undefined-able) objects using equals(). */
export function equals(left, right) {
    if (left !== null && left !== undefined) {
        return !!(right && left.equals(right));
    }
    else {
        // HACK: Explicitly cast since TypeScript's type narrowing apparently isn't
        // smart enough.
        return left === right;
    }
}
/** Helper to compare arrays using equals(). */
export function arrayEquals(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    for (var i = 0; i < left.length; i++) {
        if (!left[i].equals(right[i])) {
            return false;
        }
    }
    return true;
}
/**
 * Returns the largest lexicographically smaller string of equal or smaller
 * length. Returns an empty string if there is no such predecessor (if the input
 * is empty).
 *
 * Strings returned from this method can be invalid UTF-16 but this is sufficent
 * in use for indexeddb because that depends on lexicographical ordering but
 * shouldn't be used elsewhere.
 */
export function immediatePredecessor(s) {
    // We can decrement the last character in the string and be done
    // unless that character is 0 (0x0000), in which case we have to erase the
    // last character.
    var lastIndex = s.length - 1;
    if (s.length === 0) {
        // Special case the empty string.
        return '';
    }
    else if (s.charAt(lastIndex) === '\0') {
        return s.substring(0, lastIndex);
    }
    else {
        return (s.substring(0, lastIndex) +
            String.fromCharCode(s.charCodeAt(lastIndex) - 1));
    }
}
/**
 * Returns the immediate lexicographically-following string. This is useful to
 * construct an inclusive range for indexeddb iterators.
 */
export function immediateSuccessor(s) {
    // Return the input string, with an additional NUL byte appended.
    return s + '\0';
}

//# sourceMappingURL=misc.js.map
