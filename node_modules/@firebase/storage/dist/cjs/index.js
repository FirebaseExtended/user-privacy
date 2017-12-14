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
var app_1 = require("@firebase/app");
var string_1 = require("./src/implementation/string");
var taskenums_1 = require("./src/implementation/taskenums");
var taskenums_2 = require("./src/implementation/taskenums");
var xhriopool_1 = require("./src/implementation/xhriopool");
var reference_1 = require("./src/reference");
var service_1 = require("./src/service");
/**
 * Type constant for Firebase Storage.
 */
var STORAGE_TYPE = 'storage';
function factory(app, unused, opt_url) {
    return new service_1.Service(app, new xhriopool_1.XhrIoPool(), opt_url);
}
function registerStorage(instance) {
    var namespaceExports = {
        // no-inline
        TaskState: taskenums_2.TaskState,
        TaskEvent: taskenums_1.TaskEvent,
        StringFormat: string_1.StringFormat,
        Storage: service_1.Service,
        Reference: reference_1.Reference
    };
    instance.INTERNAL.registerService(STORAGE_TYPE, factory, namespaceExports, undefined, 
    // Allow multiple storage instances per app.
    true);
}
exports.registerStorage = registerStorage;
registerStorage(app_1.default);

//# sourceMappingURL=index.js.map
