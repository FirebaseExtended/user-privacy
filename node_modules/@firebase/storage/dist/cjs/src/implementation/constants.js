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
/**
 * @fileoverview Constants used in the Firebase Storage library.
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Domain and scheme for API calls.
 */
exports.domainBase = 'https://firebasestorage.googleapis.com';
/**
 * Domain and scheme for object downloads.
 */
exports.downloadBase = 'https://firebasestorage.googleapis.com';
/**
 * Base URL for non-upload calls to the API.
 */
exports.apiBaseUrl = '/v0';
/**
 * Base URL for upload calls to the API.
 */
exports.apiUploadBaseUrl = '/v0';
function setDomainBase(domainBase) {
    domainBase = domainBase;
}
exports.setDomainBase = setDomainBase;
exports.configOption = 'storageBucket';
/**
 * 1 minute
 */
exports.shortMaxOperationRetryTime = 1 * 60 * 1000;
/**
 * 2 minutes
 */
exports.defaultMaxOperationRetryTime = 2 * 60 * 1000;
/**
 * 10 minutes
 */
exports.defaultMaxUploadRetryTime = 10 * 60 * 100;
/**
 * This is the value of Number.MIN_SAFE_INTEGER, which is not well supported
 * enough for us to use it directly.
 */
exports.minSafeInteger = -9007199254740991;

//# sourceMappingURL=constants.js.map
