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
import { SnapshotVersion } from '../core/snapshot_version';
import { ObjectMap } from '../util/obj_map';
import { PersistencePromise } from './persistence_promise';
import { ReferenceSet } from './reference_set';
var MemoryQueryCache = /** @class */ (function () {
    function MemoryQueryCache() {
        /**
         * Maps a query to the data about that query
         */
        this.queries = new ObjectMap(function (q) { return q.canonicalId(); });
        /** The last received snapshot version. */
        this.lastRemoteSnapshotVersion = SnapshotVersion.MIN;
        /** The highest numbered target ID encountered. */
        this.highestTargetId = 0;
        /**
         * A ordered bidirectional mapping between documents and the remote target
         * IDs.
         */
        this.references = new ReferenceSet();
    }
    MemoryQueryCache.prototype.start = function (transaction) {
        // Nothing to do.
        return PersistencePromise.resolve();
    };
    MemoryQueryCache.prototype.getLastRemoteSnapshotVersion = function () {
        return this.lastRemoteSnapshotVersion;
    };
    MemoryQueryCache.prototype.getHighestTargetId = function () {
        return this.highestTargetId;
    };
    MemoryQueryCache.prototype.setLastRemoteSnapshotVersion = function (transaction, snapshotVersion) {
        this.lastRemoteSnapshotVersion = snapshotVersion;
        return PersistencePromise.resolve();
    };
    MemoryQueryCache.prototype.addQueryData = function (transaction, queryData) {
        this.queries.set(queryData.query, queryData);
        var targetId = queryData.targetId;
        if (targetId > this.highestTargetId) {
            this.highestTargetId = targetId;
        }
        return PersistencePromise.resolve();
    };
    MemoryQueryCache.prototype.removeQueryData = function (transaction, queryData) {
        this.queries.delete(queryData.query);
        this.references.removeReferencesForId(queryData.targetId);
        return PersistencePromise.resolve();
    };
    MemoryQueryCache.prototype.getQueryData = function (transaction, query) {
        var queryData = this.queries.get(query) || null;
        return PersistencePromise.resolve(queryData);
    };
    MemoryQueryCache.prototype.addMatchingKeys = function (txn, keys, targetId) {
        this.references.addReferences(keys, targetId);
        return PersistencePromise.resolve();
    };
    MemoryQueryCache.prototype.removeMatchingKeys = function (txn, keys, targetId) {
        this.references.removeReferences(keys, targetId);
        return PersistencePromise.resolve();
    };
    MemoryQueryCache.prototype.removeMatchingKeysForTargetId = function (txn, targetId) {
        this.references.removeReferencesForId(targetId);
        return PersistencePromise.resolve();
    };
    MemoryQueryCache.prototype.getMatchingKeysForTargetId = function (txn, targetId) {
        var matchingKeys = this.references.referencesForId(targetId);
        return PersistencePromise.resolve(matchingKeys);
    };
    MemoryQueryCache.prototype.setGarbageCollector = function (gc) {
        this.references.setGarbageCollector(gc);
    };
    MemoryQueryCache.prototype.containsKey = function (txn, key) {
        return this.references.containsKey(txn, key);
    };
    return MemoryQueryCache;
}());
export { MemoryQueryCache };

//# sourceMappingURL=memory_query_cache.js.map
