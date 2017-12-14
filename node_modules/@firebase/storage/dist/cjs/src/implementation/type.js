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
/**
 * @return False if the object is undefined or null, true otherwise.
 */
function isDef(p) {
    return p != null;
}
exports.isDef = isDef;
function isJustDef(p) {
    return p !== void 0;
}
exports.isJustDef = isJustDef;
function isFunction(p) {
    return typeof p === 'function';
}
exports.isFunction = isFunction;
function isObject(p) {
    return typeof p === 'object';
}
exports.isObject = isObject;
function isNonNullObject(p) {
    return isObject(p) && p !== null;
}
exports.isNonNullObject = isNonNullObject;
function isNonArrayObject(p) {
    return isObject(p) && !Array.isArray(p);
}
exports.isNonArrayObject = isNonArrayObject;
function isString(p) {
    return typeof p === 'string' || p instanceof String;
}
exports.isString = isString;
function isNumber(p) {
    return typeof p === 'number' || p instanceof Number;
}
exports.isNumber = isNumber;
function isNativeBlob(p) {
    return isNativeBlobDefined() && p instanceof Blob;
}
exports.isNativeBlob = isNativeBlob;
function isNativeBlobDefined() {
    return typeof Blob !== 'undefined';
}
exports.isNativeBlobDefined = isNativeBlobDefined;

//# sourceMappingURL=type.js.map
