"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
var constants_1 = require("./constants");
var FirebaseStorageError = /** @class */ (function () {
    function FirebaseStorageError(code, message) {
        this.code_ = prependCode(code);
        this.message_ = 'Firebase Storage: ' + message;
        this.serverResponse_ = null;
        this.name_ = 'FirebaseError';
    }
    FirebaseStorageError.prototype.codeProp = function () {
        return this.code;
    };
    FirebaseStorageError.prototype.codeEquals = function (code) {
        return prependCode(code) === this.codeProp();
    };
    FirebaseStorageError.prototype.serverResponseProp = function () {
        return this.serverResponse_;
    };
    FirebaseStorageError.prototype.setServerResponseProp = function (serverResponse) {
        this.serverResponse_ = serverResponse;
    };
    Object.defineProperty(FirebaseStorageError.prototype, "name", {
        get: function () {
            return this.name_;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FirebaseStorageError.prototype, "code", {
        get: function () {
            return this.code_;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FirebaseStorageError.prototype, "message", {
        get: function () {
            return this.message_;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(FirebaseStorageError.prototype, "serverResponse", {
        get: function () {
            return this.serverResponse_;
        },
        enumerable: true,
        configurable: true
    });
    return FirebaseStorageError;
}());
exports.FirebaseStorageError = FirebaseStorageError;
exports.errors = {};
exports.Code = {
    // Shared between all platforms
    UNKNOWN: 'unknown',
    OBJECT_NOT_FOUND: 'object-not-found',
    BUCKET_NOT_FOUND: 'bucket-not-found',
    PROJECT_NOT_FOUND: 'project-not-found',
    QUOTA_EXCEEDED: 'quota-exceeded',
    UNAUTHENTICATED: 'unauthenticated',
    UNAUTHORIZED: 'unauthorized',
    RETRY_LIMIT_EXCEEDED: 'retry-limit-exceeded',
    INVALID_CHECKSUM: 'invalid-checksum',
    CANCELED: 'canceled',
    // JS specific
    INVALID_EVENT_NAME: 'invalid-event-name',
    INVALID_URL: 'invalid-url',
    INVALID_DEFAULT_BUCKET: 'invalid-default-bucket',
    NO_DEFAULT_BUCKET: 'no-default-bucket',
    CANNOT_SLICE_BLOB: 'cannot-slice-blob',
    SERVER_FILE_WRONG_SIZE: 'server-file-wrong-size',
    NO_DOWNLOAD_URL: 'no-download-url',
    INVALID_ARGUMENT: 'invalid-argument',
    INVALID_ARGUMENT_COUNT: 'invalid-argument-count',
    APP_DELETED: 'app-deleted',
    INVALID_ROOT_OPERATION: 'invalid-root-operation',
    INVALID_FORMAT: 'invalid-format',
    INTERNAL_ERROR: 'internal-error'
};
function prependCode(code) {
    return 'storage/' + code;
}
exports.prependCode = prependCode;
function unknown() {
    var message = 'An unknown error occurred, please check the error payload for ' +
        'server response.';
    return new FirebaseStorageError(exports.Code.UNKNOWN, message);
}
exports.unknown = unknown;
function objectNotFound(path) {
    return new FirebaseStorageError(exports.Code.OBJECT_NOT_FOUND, "Object '" + path + "' does not exist.");
}
exports.objectNotFound = objectNotFound;
function bucketNotFound(bucket) {
    return new FirebaseStorageError(exports.Code.BUCKET_NOT_FOUND, "Bucket '" + bucket + "' does not exist.");
}
exports.bucketNotFound = bucketNotFound;
function projectNotFound(project) {
    return new FirebaseStorageError(exports.Code.PROJECT_NOT_FOUND, "Project '" + project + "' does not exist.");
}
exports.projectNotFound = projectNotFound;
function quotaExceeded(bucket) {
    return new FirebaseStorageError(exports.Code.QUOTA_EXCEEDED, "Quota for bucket '" +
        bucket +
        "' exceeded, please view quota on " +
        'https://firebase.google.com/pricing/.');
}
exports.quotaExceeded = quotaExceeded;
function unauthenticated() {
    var message = 'User is not authenticated, please authenticate using Firebase ' +
        'Authentication and try again.';
    return new FirebaseStorageError(exports.Code.UNAUTHENTICATED, message);
}
exports.unauthenticated = unauthenticated;
function unauthorized(path) {
    return new FirebaseStorageError(exports.Code.UNAUTHORIZED, "User does not have permission to access '" + path + "'.");
}
exports.unauthorized = unauthorized;
function retryLimitExceeded() {
    return new FirebaseStorageError(exports.Code.RETRY_LIMIT_EXCEEDED, 'Max retry time for operation exceeded, please try again.');
}
exports.retryLimitExceeded = retryLimitExceeded;
function invalidChecksum(path, checksum, calculated) {
    return new FirebaseStorageError(exports.Code.INVALID_CHECKSUM, "Uploaded/downloaded object '" +
        path +
        "' has checksum '" +
        checksum +
        "' which does not match '" +
        calculated +
        "'. Please retry the upload/download.");
}
exports.invalidChecksum = invalidChecksum;
function canceled() {
    return new FirebaseStorageError(exports.Code.CANCELED, 'User canceled the upload/download.');
}
exports.canceled = canceled;
function invalidEventName(name) {
    return new FirebaseStorageError(exports.Code.INVALID_EVENT_NAME, "Invalid event name '" + name + "'.");
}
exports.invalidEventName = invalidEventName;
function invalidUrl(url) {
    return new FirebaseStorageError(exports.Code.INVALID_URL, "Invalid URL '" + url + "'.");
}
exports.invalidUrl = invalidUrl;
function invalidDefaultBucket(bucket) {
    return new FirebaseStorageError(exports.Code.INVALID_DEFAULT_BUCKET, "Invalid default bucket '" + bucket + "'.");
}
exports.invalidDefaultBucket = invalidDefaultBucket;
function noDefaultBucket() {
    return new FirebaseStorageError(exports.Code.NO_DEFAULT_BUCKET, 'No default bucket ' +
        "found. Did you set the '" +
        constants_1.configOption +
        "' property when initializing the app?");
}
exports.noDefaultBucket = noDefaultBucket;
function cannotSliceBlob() {
    return new FirebaseStorageError(exports.Code.CANNOT_SLICE_BLOB, 'Cannot slice blob for upload. Please retry the upload.');
}
exports.cannotSliceBlob = cannotSliceBlob;
function serverFileWrongSize() {
    return new FirebaseStorageError(exports.Code.SERVER_FILE_WRONG_SIZE, 'Server recorded incorrect upload file size, please retry the upload.');
}
exports.serverFileWrongSize = serverFileWrongSize;
function noDownloadURL() {
    return new FirebaseStorageError(exports.Code.NO_DOWNLOAD_URL, 'The given file does not have any download URLs.');
}
exports.noDownloadURL = noDownloadURL;
function invalidArgument(index, fnName, message) {
    return new FirebaseStorageError(exports.Code.INVALID_ARGUMENT, 'Invalid argument in `' + fnName + '` at index ' + index + ': ' + message);
}
exports.invalidArgument = invalidArgument;
function invalidArgumentCount(argMin, argMax, fnName, real) {
    var countPart;
    var plural;
    if (argMin === argMax) {
        countPart = argMin;
        plural = argMin === 1 ? 'argument' : 'arguments';
    }
    else {
        countPart = 'between ' + argMin + ' and ' + argMax;
        plural = 'arguments';
    }
    return new FirebaseStorageError(exports.Code.INVALID_ARGUMENT_COUNT, 'Invalid argument count in `' +
        fnName +
        '`: Expected ' +
        countPart +
        ' ' +
        plural +
        ', received ' +
        real +
        '.');
}
exports.invalidArgumentCount = invalidArgumentCount;
function appDeleted() {
    return new FirebaseStorageError(exports.Code.APP_DELETED, 'The Firebase app was deleted.');
}
exports.appDeleted = appDeleted;
/**
 * @param name The name of the operation that was invalid.
 */
function invalidRootOperation(name) {
    return new FirebaseStorageError(exports.Code.INVALID_ROOT_OPERATION, "The operation '" +
        name +
        "' cannot be performed on a root reference, create a non-root " +
        "reference using child, such as .child('file.png').");
}
exports.invalidRootOperation = invalidRootOperation;
/**
 * @param format The format that was not valid.
 * @param message A message describing the format violation.
 */
function invalidFormat(format, message) {
    return new FirebaseStorageError(exports.Code.INVALID_FORMAT, "String does not match format '" + format + "': " + message);
}
exports.invalidFormat = invalidFormat;
/**
 * @param message A message describing the internal error.
 */
function internalError(message) {
    throw new FirebaseStorageError(exports.Code.INTERNAL_ERROR, 'Internal error: ' + message);
}
exports.internalError = internalError;

//# sourceMappingURL=error.js.map
