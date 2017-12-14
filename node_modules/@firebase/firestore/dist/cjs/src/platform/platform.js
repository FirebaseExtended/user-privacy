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
/**
 * Provides singleton helpers where setup code can inject a platform at runtime.
 * setPlatform needs to be set before Firestore is used and must be set exactly
 * once.
 */
var PlatformSupport = /** @class */ (function () {
    function PlatformSupport() {
    }
    PlatformSupport.setPlatform = function (platform) {
        if (PlatformSupport.platform) {
            assert_1.fail('Platform already defined');
        }
        PlatformSupport.platform = platform;
    };
    PlatformSupport.getPlatform = function () {
        if (!PlatformSupport.platform) {
            assert_1.fail('Platform not set');
        }
        return PlatformSupport.platform;
    };
    return PlatformSupport;
}());
exports.PlatformSupport = PlatformSupport;
/**
 * Returns the representation of an empty "proto" byte string for the
 * platform.
 */
function emptyByteString() {
    return PlatformSupport.getPlatform().emptyByteString;
}
exports.emptyByteString = emptyByteString;

//# sourceMappingURL=platform.js.map
