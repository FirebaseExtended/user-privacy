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
var RESERVED_BITS = 1;
var GeneratorIds;
(function (GeneratorIds) {
    GeneratorIds[GeneratorIds["LocalStore"] = 0] = "LocalStore";
    GeneratorIds[GeneratorIds["SyncEngine"] = 1] = "SyncEngine";
})(GeneratorIds || (GeneratorIds = {}));
/**
 * TargetIdGenerator generates monotonically increasing integer IDs. There are
 * separate generators for different scopes. While these generators will operate
 * independently of each other, they are scoped, such that no two generators
 * will ever produce the same ID. This is useful, because sometimes the backend
 * may group IDs from separate parts of the client into the same ID space.
 */
var TargetIdGenerator = /** @class */ (function () {
    function TargetIdGenerator(generatorId, initAfter) {
        if (initAfter === void 0) { initAfter = 0; }
        this.generatorId = generatorId;
        // Replace the generator part of initAfter with this generator's ID.
        var afterWithoutGenerator = (initAfter >> RESERVED_BITS) << RESERVED_BITS;
        var afterGenerator = initAfter - afterWithoutGenerator;
        if (afterGenerator >= generatorId) {
            // For example, if:
            //   this.generatorId = 0b0000
            //   after = 0b1011
            //   afterGenerator = 0b0001
            // Then:
            //   previous = 0b1010
            //   next = 0b1100
            this.previousId = afterWithoutGenerator | this.generatorId;
        }
        else {
            // For example, if:
            //   this.generatorId = 0b0001
            //   after = 0b1010
            //   afterGenerator = 0b0000
            // Then:
            //   previous = 0b1001
            //   next = 0b1011
            this.previousId =
                (afterWithoutGenerator | this.generatorId) - (1 << RESERVED_BITS);
        }
    }
    TargetIdGenerator.prototype.next = function () {
        this.previousId += 1 << RESERVED_BITS;
        return this.previousId;
    };
    TargetIdGenerator.forLocalStore = function (initAfter) {
        if (initAfter === void 0) { initAfter = 0; }
        return new TargetIdGenerator(GeneratorIds.LocalStore, initAfter);
    };
    TargetIdGenerator.forSyncEngine = function () {
        return new TargetIdGenerator(GeneratorIds.SyncEngine);
    };
    return TargetIdGenerator;
}());
exports.TargetIdGenerator = TargetIdGenerator;

//# sourceMappingURL=target_id_generator.js.map
