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
 * @fileoverview Functions to create and manipulate URLs for the server API.
 */
var constants = require("./constants");
var object = require("./object");
function makeNormalUrl(urlPart) {
    return constants.domainBase + constants.apiBaseUrl + urlPart;
}
exports.makeNormalUrl = makeNormalUrl;
function makeDownloadUrl(urlPart) {
    return constants.downloadBase + constants.apiBaseUrl + urlPart;
}
exports.makeDownloadUrl = makeDownloadUrl;
function makeUploadUrl(urlPart) {
    return constants.domainBase + constants.apiUploadBaseUrl + urlPart;
}
exports.makeUploadUrl = makeUploadUrl;
function makeQueryString(params) {
    var encode = encodeURIComponent;
    var queryPart = '?';
    object.forEach(params, function (key, val) {
        var nextPart = encode(key) + '=' + encode(val);
        queryPart = queryPart + nextPart + '&';
    });
    // Chop off the extra '&' or '?' on the end
    queryPart = queryPart.slice(0, -1);
    return queryPart;
}
exports.makeQueryString = makeQueryString;

//# sourceMappingURL=url.js.map
