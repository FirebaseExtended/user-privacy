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
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var window_controller_1 = require("./src/controllers/window-controller");
var sw_controller_1 = require("./src/controllers/sw-controller");
var app_1 = require("@firebase/app");
function registerMessaging(instance) {
    var messagingName = 'messaging';
    var factoryMethod = function (app) {
        if (self && 'ServiceWorkerGlobalScope' in self) {
            return new sw_controller_1.default(app);
        }
        // Assume we are in the window context.
        return new window_controller_1.default(app);
    };
    var namespaceExports = {
        // no-inline
        Messaging: window_controller_1.default
    };
    instance.INTERNAL.registerService(messagingName, factoryMethod, namespaceExports);
}
exports.registerMessaging = registerMessaging;
registerMessaging(app_1.default);

//# sourceMappingURL=index.js.map
