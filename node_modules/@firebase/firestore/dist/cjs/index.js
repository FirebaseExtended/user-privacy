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
require("./src/platform_browser/browser_init");
var config_1 = require("./src/platform/config");
function registerFirestore(instance) {
    config_1.configureForFirebase(instance);
}
exports.registerFirestore = registerFirestore;
registerFirestore(app_1.default);

//# sourceMappingURL=index.js.map
