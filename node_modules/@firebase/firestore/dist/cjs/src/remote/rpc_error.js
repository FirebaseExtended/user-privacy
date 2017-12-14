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
var assert_1 = require("../util/assert");
var error_1 = require("../util/error");
var log = require("../util/log");
/**
 * Error Codes describing the different ways GRPC can fail. These are copied
 * directly from GRPC's sources here:
 *
 * https://github.com/grpc/grpc/blob/bceec94ea4fc5f0085d81235d8e1c06798dc341a/include/grpc%2B%2B/impl/codegen/status_code_enum.h
 *
 * Important! The names of these identifiers matter because the string forms
 * are used for reverse lookups from the webchannel stream. Do NOT change the
 * names of these identifiers.
 */
var RpcCode;
(function (RpcCode) {
    RpcCode[RpcCode["OK"] = 0] = "OK";
    RpcCode[RpcCode["CANCELLED"] = 1] = "CANCELLED";
    RpcCode[RpcCode["UNKNOWN"] = 2] = "UNKNOWN";
    RpcCode[RpcCode["INVALID_ARGUMENT"] = 3] = "INVALID_ARGUMENT";
    RpcCode[RpcCode["DEADLINE_EXCEEDED"] = 4] = "DEADLINE_EXCEEDED";
    RpcCode[RpcCode["NOT_FOUND"] = 5] = "NOT_FOUND";
    RpcCode[RpcCode["ALREADY_EXISTS"] = 6] = "ALREADY_EXISTS";
    RpcCode[RpcCode["PERMISSION_DENIED"] = 7] = "PERMISSION_DENIED";
    RpcCode[RpcCode["UNAUTHENTICATED"] = 16] = "UNAUTHENTICATED";
    RpcCode[RpcCode["RESOURCE_EXHAUSTED"] = 8] = "RESOURCE_EXHAUSTED";
    RpcCode[RpcCode["FAILED_PRECONDITION"] = 9] = "FAILED_PRECONDITION";
    RpcCode[RpcCode["ABORTED"] = 10] = "ABORTED";
    RpcCode[RpcCode["OUT_OF_RANGE"] = 11] = "OUT_OF_RANGE";
    RpcCode[RpcCode["UNIMPLEMENTED"] = 12] = "UNIMPLEMENTED";
    RpcCode[RpcCode["INTERNAL"] = 13] = "INTERNAL";
    RpcCode[RpcCode["UNAVAILABLE"] = 14] = "UNAVAILABLE";
    RpcCode[RpcCode["DATA_LOSS"] = 15] = "DATA_LOSS";
})(RpcCode || (RpcCode = {}));
function isPermanentError(code) {
    switch (code) {
        case error_1.Code.OK:
            return assert_1.fail('Treated status OK as error');
        case error_1.Code.CANCELLED:
        case error_1.Code.UNKNOWN:
        case error_1.Code.DEADLINE_EXCEEDED:
        case error_1.Code.RESOURCE_EXHAUSTED:
        case error_1.Code.INTERNAL:
        case error_1.Code.UNAVAILABLE:
        // Unauthenticated means something went wrong with our token and we need
        // to retry with new credentials which will happen automatically.
        // TODO(b/37325376): Give up after second unauthenticated error.
        case error_1.Code.UNAUTHENTICATED:
            return false;
        case error_1.Code.INVALID_ARGUMENT:
        case error_1.Code.NOT_FOUND:
        case error_1.Code.ALREADY_EXISTS:
        case error_1.Code.PERMISSION_DENIED:
        case error_1.Code.FAILED_PRECONDITION:
        // Aborted might be retried in some scenarios, but that is dependant on
        // the context and should handled individually by the calling code.
        // See https://cloud.google.com/apis/design/errors.
        case error_1.Code.ABORTED:
        case error_1.Code.OUT_OF_RANGE:
        case error_1.Code.UNIMPLEMENTED:
        case error_1.Code.DATA_LOSS:
            return true;
        default:
            return assert_1.fail('Unknown status code: ' + code);
    }
}
exports.isPermanentError = isPermanentError;
/**
 * Maps an error Code from a GRPC status identifier like 'NOT_FOUND'.
 *
 * @returns The Code equivalent to the given status string or undefined if
 *     there is no match.
 */
function mapCodeFromRpcStatus(status) {
    // tslint:disable-next-line:no-any lookup by string
    var code = RpcCode[status];
    if (code === undefined) {
        return undefined;
    }
    return mapCodeFromRpcCode(code);
}
exports.mapCodeFromRpcStatus = mapCodeFromRpcStatus;
/**
 * Maps an error Code from GRPC status code number, like 0, 1, or 14. These
 * are not the same as HTTP status codes.
 *
 * @returns The Code equivalent to the given GRPC status code. Fails if there
 *     is no match.
 */
function mapCodeFromRpcCode(code) {
    if (code === undefined) {
        // This shouldn't normally happen, but in certain error cases (like trying
        // to send invalid proto messages) we may get an error with no GRPC code.
        log.error('GRPC error has no .code');
        return error_1.Code.UNKNOWN;
    }
    switch (code) {
        case RpcCode.OK:
            return error_1.Code.OK;
        case RpcCode.CANCELLED:
            return error_1.Code.CANCELLED;
        case RpcCode.UNKNOWN:
            return error_1.Code.UNKNOWN;
        case RpcCode.DEADLINE_EXCEEDED:
            return error_1.Code.DEADLINE_EXCEEDED;
        case RpcCode.RESOURCE_EXHAUSTED:
            return error_1.Code.RESOURCE_EXHAUSTED;
        case RpcCode.INTERNAL:
            return error_1.Code.INTERNAL;
        case RpcCode.UNAVAILABLE:
            return error_1.Code.UNAVAILABLE;
        case RpcCode.UNAUTHENTICATED:
            return error_1.Code.UNAUTHENTICATED;
        case RpcCode.INVALID_ARGUMENT:
            return error_1.Code.INVALID_ARGUMENT;
        case RpcCode.NOT_FOUND:
            return error_1.Code.NOT_FOUND;
        case RpcCode.ALREADY_EXISTS:
            return error_1.Code.ALREADY_EXISTS;
        case RpcCode.PERMISSION_DENIED:
            return error_1.Code.PERMISSION_DENIED;
        case RpcCode.FAILED_PRECONDITION:
            return error_1.Code.FAILED_PRECONDITION;
        case RpcCode.ABORTED:
            return error_1.Code.ABORTED;
        case RpcCode.OUT_OF_RANGE:
            return error_1.Code.OUT_OF_RANGE;
        case RpcCode.UNIMPLEMENTED:
            return error_1.Code.UNIMPLEMENTED;
        case RpcCode.DATA_LOSS:
            return error_1.Code.DATA_LOSS;
        default:
            return assert_1.fail('Unknown status code: ' + code);
    }
}
exports.mapCodeFromRpcCode = mapCodeFromRpcCode;
/**
 * Maps an RPC code from a Code. This is the reverse operation from
 * mapCodeFromRpcCode and should really only be used in tests.
 */
function mapRpcCodeFromCode(code) {
    if (code === undefined) {
        return RpcCode.OK;
    }
    switch (code) {
        case error_1.Code.OK:
            return RpcCode.OK;
        case error_1.Code.CANCELLED:
            return RpcCode.CANCELLED;
        case error_1.Code.UNKNOWN:
            return RpcCode.UNKNOWN;
        case error_1.Code.DEADLINE_EXCEEDED:
            return RpcCode.DEADLINE_EXCEEDED;
        case error_1.Code.RESOURCE_EXHAUSTED:
            return RpcCode.RESOURCE_EXHAUSTED;
        case error_1.Code.INTERNAL:
            return RpcCode.INTERNAL;
        case error_1.Code.UNAVAILABLE:
            return RpcCode.UNAVAILABLE;
        case error_1.Code.UNAUTHENTICATED:
            return RpcCode.UNAUTHENTICATED;
        case error_1.Code.INVALID_ARGUMENT:
            return RpcCode.INVALID_ARGUMENT;
        case error_1.Code.NOT_FOUND:
            return RpcCode.NOT_FOUND;
        case error_1.Code.ALREADY_EXISTS:
            return RpcCode.ALREADY_EXISTS;
        case error_1.Code.PERMISSION_DENIED:
            return RpcCode.PERMISSION_DENIED;
        case error_1.Code.FAILED_PRECONDITION:
            return RpcCode.FAILED_PRECONDITION;
        case error_1.Code.ABORTED:
            return RpcCode.ABORTED;
        case error_1.Code.OUT_OF_RANGE:
            return RpcCode.OUT_OF_RANGE;
        case error_1.Code.UNIMPLEMENTED:
            return RpcCode.UNIMPLEMENTED;
        case error_1.Code.DATA_LOSS:
            return RpcCode.DATA_LOSS;
        default:
            return assert_1.fail('Unknown status code: ' + code);
    }
}
exports.mapRpcCodeFromCode = mapRpcCodeFromCode;
/**
 * Converts an HTTP Status Code to the equivalent error code.
 *
 * @param status An HTTP Status Code, like 200, 404, 503, etc.
 * @returns The equivalent Code. Unknown status codes are mapped to
 *     Code.UNKNOWN.
 */
function mapCodeFromHttpStatus(status) {
    // The canonical error codes for Google APIs [1] specify mapping onto HTTP
    // status codes but the mapping is not bijective. In each case of ambiguity
    // this function chooses a primary error.
    //
    // [1]
    // https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto
    switch (status) {
        case 200:// OK
            return error_1.Code.OK;
        case 400:// Bad Request
            return error_1.Code.INVALID_ARGUMENT;
        // Other possibilities based on the forward mapping
        // return Code.FAILED_PRECONDITION;
        // return Code.OUT_OF_RANGE;
        case 401:// Unauthorized
            return error_1.Code.UNAUTHENTICATED;
        case 403:// Forbidden
            return error_1.Code.PERMISSION_DENIED;
        case 404:// Not Found
            return error_1.Code.NOT_FOUND;
        case 409:// Conflict
            return error_1.Code.ABORTED;
        // Other possibilities:
        // return Code.ALREADY_EXISTS;
        case 416:// Range Not Satisfiable
            return error_1.Code.OUT_OF_RANGE;
        case 429:// Too Many Requests
            return error_1.Code.RESOURCE_EXHAUSTED;
        case 499:// Client Closed Request
            return error_1.Code.CANCELLED;
        case 500:// Internal Server Error
            return error_1.Code.UNKNOWN;
        // Other possibilities:
        // return Code.INTERNAL;
        // return Code.DATA_LOSS;
        case 501:// Unimplemented
            return error_1.Code.UNIMPLEMENTED;
        case 503:// Service Unavailable
            return error_1.Code.UNAVAILABLE;
        case 504:// Gateway Timeout
            return error_1.Code.DEADLINE_EXCEEDED;
        default:
            if (status >= 200 && status < 300)
                return error_1.Code.OK;
            if (status >= 400 && status < 500)
                return error_1.Code.FAILED_PRECONDITION;
            if (status >= 500 && status < 600)
                return error_1.Code.INTERNAL;
            return error_1.Code.UNKNOWN;
    }
}
exports.mapCodeFromHttpStatus = mapCodeFromHttpStatus;

//# sourceMappingURL=rpc_error.js.map
