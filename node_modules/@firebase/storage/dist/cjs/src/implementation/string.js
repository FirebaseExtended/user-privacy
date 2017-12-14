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
var errorsExports = require("./error");
exports.StringFormat = {
    RAW: 'raw',
    BASE64: 'base64',
    BASE64URL: 'base64url',
    DATA_URL: 'data_url'
};
function formatValidator(stringFormat) {
    switch (stringFormat) {
        case exports.StringFormat.RAW:
        case exports.StringFormat.BASE64:
        case exports.StringFormat.BASE64URL:
        case exports.StringFormat.DATA_URL:
            return;
        default:
            throw 'Expected one of the event types: [' +
                exports.StringFormat.RAW +
                ', ' +
                exports.StringFormat.BASE64 +
                ', ' +
                exports.StringFormat.BASE64URL +
                ', ' +
                exports.StringFormat.DATA_URL +
                '].';
    }
}
exports.formatValidator = formatValidator;
/**
 * @struct
 */
var StringData = /** @class */ (function () {
    function StringData(data, opt_contentType) {
        this.data = data;
        this.contentType = opt_contentType || null;
    }
    return StringData;
}());
exports.StringData = StringData;
function dataFromString(format, string) {
    switch (format) {
        case exports.StringFormat.RAW:
            return new StringData(utf8Bytes_(string));
        case exports.StringFormat.BASE64:
        case exports.StringFormat.BASE64URL:
            return new StringData(base64Bytes_(format, string));
        case exports.StringFormat.DATA_URL:
            return new StringData(dataURLBytes_(string), dataURLContentType_(string));
    }
    // assert(false);
    throw errorsExports.unknown();
}
exports.dataFromString = dataFromString;
function utf8Bytes_(string) {
    var b = [];
    for (var i = 0; i < string.length; i++) {
        var c = string.charCodeAt(i);
        if (c <= 127) {
            b.push(c);
        }
        else {
            if (c <= 2047) {
                b.push(192 | (c >> 6), 128 | (c & 63));
            }
            else {
                if ((c & 64512) == 55296) {
                    // The start of a surrogate pair.
                    var valid = i < string.length - 1 &&
                        (string.charCodeAt(i + 1) & 64512) == 56320;
                    if (!valid) {
                        // The second surrogate wasn't there.
                        b.push(239, 191, 189);
                    }
                    else {
                        var hi = c;
                        var lo = string.charCodeAt(++i);
                        c = 65536 | ((hi & 1023) << 10) | (lo & 1023);
                        b.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
                    }
                }
                else {
                    if ((c & 64512) == 56320) {
                        // Invalid low surrogate.
                        b.push(239, 191, 189);
                    }
                    else {
                        b.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
                    }
                }
            }
        }
    }
    return new Uint8Array(b);
}
exports.utf8Bytes_ = utf8Bytes_;
function percentEncodedBytes_(string) {
    var decoded;
    try {
        decoded = decodeURIComponent(string);
    }
    catch (e) {
        throw errorsExports.invalidFormat(exports.StringFormat.DATA_URL, 'Malformed data URL.');
    }
    return utf8Bytes_(decoded);
}
exports.percentEncodedBytes_ = percentEncodedBytes_;
function base64Bytes_(format, string) {
    switch (format) {
        case exports.StringFormat.BASE64: {
            var hasMinus = string.indexOf('-') !== -1;
            var hasUnder = string.indexOf('_') !== -1;
            if (hasMinus || hasUnder) {
                var invalidChar = hasMinus ? '-' : '_';
                throw errorsExports.invalidFormat(format, "Invalid character '" +
                    invalidChar +
                    "' found: is it base64url encoded?");
            }
            break;
        }
        case exports.StringFormat.BASE64URL: {
            var hasPlus = string.indexOf('+') !== -1;
            var hasSlash = string.indexOf('/') !== -1;
            if (hasPlus || hasSlash) {
                var invalidChar = hasPlus ? '+' : '/';
                throw errorsExports.invalidFormat(format, "Invalid character '" + invalidChar + "' found: is it base64 encoded?");
            }
            string = string.replace(/-/g, '+').replace(/_/g, '/');
            break;
        }
    }
    var bytes;
    try {
        bytes = atob(string);
    }
    catch (e) {
        throw errorsExports.invalidFormat(format, 'Invalid character found');
    }
    var array = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) {
        array[i] = bytes.charCodeAt(i);
    }
    return array;
}
exports.base64Bytes_ = base64Bytes_;
/**
 * @struct
 */
var DataURLParts = /** @class */ (function () {
    function DataURLParts(dataURL) {
        this.base64 = false;
        this.contentType = null;
        var matches = dataURL.match(/^data:([^,]+)?,/);
        if (matches === null) {
            throw errorsExports.invalidFormat(exports.StringFormat.DATA_URL, "Must be formatted 'data:[<mediatype>][;base64],<data>");
        }
        var middle = matches[1] || null;
        if (middle != null) {
            this.base64 = endsWith(middle, ';base64');
            this.contentType = this.base64
                ? middle.substring(0, middle.length - ';base64'.length)
                : middle;
        }
        this.rest = dataURL.substring(dataURL.indexOf(',') + 1);
    }
    return DataURLParts;
}());
function dataURLBytes_(string) {
    var parts = new DataURLParts(string);
    if (parts.base64) {
        return base64Bytes_(exports.StringFormat.BASE64, parts.rest);
    }
    else {
        return percentEncodedBytes_(parts.rest);
    }
}
exports.dataURLBytes_ = dataURLBytes_;
function dataURLContentType_(string) {
    var parts = new DataURLParts(string);
    return parts.contentType;
}
exports.dataURLContentType_ = dataURLContentType_;
function endsWith(s, end) {
    var longEnough = s.length >= end.length;
    if (!longEnough) {
        return false;
    }
    return s.substring(s.length - end.length) === end;
}

//# sourceMappingURL=string.js.map
