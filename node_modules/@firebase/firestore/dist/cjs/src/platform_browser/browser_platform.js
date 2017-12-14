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
var serializer_1 = require("../remote/serializer");
var webchannel_connection_1 = require("./webchannel_connection");
var BrowserPlatform = /** @class */ (function () {
    function BrowserPlatform() {
        this.emptyByteString = '';
        this.base64Available = typeof atob !== 'undefined';
    }
    BrowserPlatform.prototype.loadConnection = function (databaseInfo) {
        return Promise.resolve(new webchannel_connection_1.WebChannelConnection(databaseInfo));
    };
    BrowserPlatform.prototype.newSerializer = function (databaseId) {
        return new serializer_1.JsonProtoSerializer(databaseId, { useProto3Json: true });
    };
    BrowserPlatform.prototype.formatJSON = function (value) {
        return JSON.stringify(value);
    };
    BrowserPlatform.prototype.atob = function (encoded) {
        return atob(encoded);
    };
    BrowserPlatform.prototype.btoa = function (raw) {
        return btoa(raw);
    };
    return BrowserPlatform;
}());
exports.BrowserPlatform = BrowserPlatform;

//# sourceMappingURL=browser_platform.js.map
