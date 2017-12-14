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
import { documentKeySet } from '../model/collections';
import { PersistencePromise } from './persistence_promise';
/**
 * A garbage collector implementation that eagerly collects documents as soon as
 * they're no longer referenced in any of its registered GarbageSources.
 *
 * This implementation keeps track of a set of keys that are potentially garbage
 * without keeping an exact reference count. During collectGarbage, the
 * collector verifies that all potential garbage keys actually have no
 * references by consulting its list of garbage sources.
 */
var EagerGarbageCollector = /** @class */ (function () {
    function EagerGarbageCollector() {
        this.isEager = true;
        /**
         * The garbage collectible sources to double-check during garbage collection.
         */
        this.sources = [];
        /**
         * A set of potentially garbage keys.
         * PORTING NOTE: This would be a mutable set if Javascript had one.
         */
        this.potentialGarbage = documentKeySet();
    }
    EagerGarbageCollector.prototype.addGarbageSource = function (garbageSource) {
        this.sources.push(garbageSource);
        garbageSource.setGarbageCollector(this);
    };
    EagerGarbageCollector.prototype.removeGarbageSource = function (garbageSource) {
        this.sources.splice(this.sources.indexOf(garbageSource), 1);
        garbageSource.setGarbageCollector(null);
    };
    EagerGarbageCollector.prototype.addPotentialGarbageKey = function (key) {
        this.potentialGarbage = this.potentialGarbage.add(key);
    };
    EagerGarbageCollector.prototype.collectGarbage = function (txn) {
        var _this = this;
        var promises = [];
        var garbageKeys = documentKeySet();
        this.potentialGarbage.forEach(function (key) {
            var hasRefsPromise = _this.documentHasAnyReferences(txn, key);
            promises.push(hasRefsPromise.next(function (hasRefs) {
                // If there are no references, get the key.
                if (!hasRefs) {
                    garbageKeys = garbageKeys.add(key);
                }
                return PersistencePromise.resolve();
            }));
        });
        // Clear locally retained potential keys and returned confirmed garbage.
        this.potentialGarbage = documentKeySet();
        return PersistencePromise.waitFor(promises).next(function () { return garbageKeys; });
    };
    EagerGarbageCollector.prototype.documentHasAnyReferences = function (txn, key) {
        var initial = PersistencePromise.resolve(false);
        return this.sources
            .map(function (source) { return function () { return source.containsKey(txn, key); }; })
            .reduce(function (promise, nextPromise) {
            return promise.next(function (result) {
                if (result) {
                    return PersistencePromise.resolve(true);
                }
                else {
                    return nextPromise();
                }
            });
        }, initial);
    };
    return EagerGarbageCollector;
}());
export { EagerGarbageCollector };

//# sourceMappingURL=eager_garbage_collector.js.map
