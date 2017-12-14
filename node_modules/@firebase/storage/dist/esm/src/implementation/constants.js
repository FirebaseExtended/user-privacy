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
/**
 * Domain and scheme for API calls.
 */
export var domainBase = 'https://firebasestorage.googleapis.com';
/**
 * Domain and scheme for object downloads.
 */
export var downloadBase = 'https://firebasestorage.googleapis.com';
/**
 * Base URL for non-upload calls to the API.
 */
export var apiBaseUrl = '/v0';
/**
 * Base URL for upload calls to the API.
 */
export var apiUploadBaseUrl = '/v0';
export function setDomainBase(domainBase) {
    domainBase = domainBase;
}
export var configOption = 'storageBucket';
/**
 * 1 minute
 */
export var shortMaxOperationRetryTime = 1 * 60 * 1000;
/**
 * 2 minutes
 */
export var defaultMaxOperationRetryTime = 2 * 60 * 1000;
/**
 * 10 minutes
 */
export var defaultMaxUploadRetryTime = 10 * 60 * 100;
/**
 * This is the value of Number.MIN_SAFE_INTEGER, which is not well supported
 * enough for us to use it directly.
 */
export var minSafeInteger = -9007199254740991;

//# sourceMappingURL=constants.js.map
