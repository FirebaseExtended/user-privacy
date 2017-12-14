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
var snapshot_version_1 = require("../core/snapshot_version");
var timestamp_1 = require("../core/timestamp");
var collections_1 = require("../model/collections");
var document_key_1 = require("../model/document_key");
var assert_1 = require("../util/assert");
var misc_1 = require("../util/misc");
var EncodedResourcePath = require("./encoded_resource_path");
var indexeddb_schema_1 = require("./indexeddb_schema");
var persistence_promise_1 = require("./persistence_promise");
var simple_db_1 = require("./simple_db");
var IndexedDbQueryCache = /** @class */ (function () {
    function IndexedDbQueryCache(serializer) {
        this.serializer = serializer;
        /**
         * The last received snapshot version. We store this seperately from the
         * metadata to avoid the extra conversion to/from DbTimestamp.
         */
        this.lastRemoteSnapshotVersion = snapshot_version_1.SnapshotVersion.MIN;
        /**
         * A cached copy of the metadata for the query cache.
         */
        this.metadata = new indexeddb_schema_1.DbTargetGlobal(
        /*highestTargetId=*/ 0, 
        /*lastListenSequenceNumber=*/ 0, snapshot_version_1.SnapshotVersion.MIN.toTimestamp());
        /** The garbage collector to notify about potential garbage keys. */
        this.garbageCollector = null;
    }
    IndexedDbQueryCache.prototype.start = function (transaction) {
        var _this = this;
        return globalTargetStore(transaction)
            .get(indexeddb_schema_1.DbTargetGlobal.key)
            .next(function (metadata) {
            if (metadata !== null) {
                _this.metadata = metadata;
                var lastSavedVersion = metadata.lastRemoteSnapshotVersion;
                _this.lastRemoteSnapshotVersion = snapshot_version_1.SnapshotVersion.fromTimestamp(new timestamp_1.Timestamp(lastSavedVersion.seconds, lastSavedVersion.nanos));
            }
            return persistence_promise_1.PersistencePromise.resolve();
        });
    };
    IndexedDbQueryCache.prototype.getHighestTargetId = function () {
        return this.metadata.highestTargetId;
    };
    IndexedDbQueryCache.prototype.getLastRemoteSnapshotVersion = function () {
        return this.lastRemoteSnapshotVersion;
    };
    IndexedDbQueryCache.prototype.setLastRemoteSnapshotVersion = function (transaction, snapshotVersion) {
        this.lastRemoteSnapshotVersion = snapshotVersion;
        this.metadata.lastRemoteSnapshotVersion = snapshotVersion.toTimestamp();
        return globalTargetStore(transaction).put(indexeddb_schema_1.DbTargetGlobal.key, this.metadata);
    };
    IndexedDbQueryCache.prototype.addQueryData = function (transaction, queryData) {
        var _this = this;
        var targetId = queryData.targetId;
        var addedQueryPromise = targetsStore(transaction).put(this.serializer.toDbTarget(queryData));
        if (targetId > this.metadata.highestTargetId) {
            this.metadata.highestTargetId = targetId;
            return addedQueryPromise.next(function () {
                return globalTargetStore(transaction).put(indexeddb_schema_1.DbTargetGlobal.key, _this.metadata);
            });
        }
        else {
            return addedQueryPromise;
        }
    };
    IndexedDbQueryCache.prototype.removeQueryData = function (transaction, queryData) {
        return this.removeMatchingKeysForTargetId(transaction, queryData.targetId).next(function () {
            targetsStore(transaction).delete(queryData.targetId);
        });
    };
    IndexedDbQueryCache.prototype.getQueryData = function (transaction, query) {
        var _this = this;
        // Iterating by the canonicalId may yield more than one result because
        // canonicalId values are not required to be unique per target. This query
        // depends on the queryTargets index to be efficent.
        var canonicalId = query.canonicalId();
        var range = IDBKeyRange.bound([canonicalId, Number.NEGATIVE_INFINITY], [canonicalId, Number.POSITIVE_INFINITY]);
        var result = null;
        return targetsStore(transaction)
            .iterate({ range: range, index: indexeddb_schema_1.DbTarget.queryTargetsIndexName }, function (key, value, control) {
            var found = _this.serializer.fromDbTarget(value);
            // After finding a potential match, check that the query is
            // actually equal to the requested query.
            if (query.equals(found.query)) {
                result = found;
                control.done();
            }
        })
            .next(function () { return result; });
    };
    IndexedDbQueryCache.prototype.addMatchingKeys = function (txn, keys, targetId) {
        // PORTING NOTE: The reverse index (documentsTargets) is maintained by
        // Indexeddb.
        var promises = [];
        var store = documentTargetStore(txn);
        keys.forEach(function (key) {
            var path = EncodedResourcePath.encode(key.path);
            promises.push(store.put(new indexeddb_schema_1.DbTargetDocument(targetId, path)));
        });
        return persistence_promise_1.PersistencePromise.waitFor(promises);
    };
    IndexedDbQueryCache.prototype.removeMatchingKeys = function (txn, keys, targetId) {
        var _this = this;
        // PORTING NOTE: The reverse index (documentsTargets) is maintained by
        // IndexedDb.
        var promises = [];
        var store = documentTargetStore(txn);
        keys.forEach(function (key) {
            var path = EncodedResourcePath.encode(key.path);
            promises.push(store.delete([targetId, path]));
            if (_this.garbageCollector !== null) {
                _this.garbageCollector.addPotentialGarbageKey(key);
            }
        });
        return persistence_promise_1.PersistencePromise.waitFor(promises);
    };
    IndexedDbQueryCache.prototype.removeMatchingKeysForTargetId = function (txn, targetId) {
        var store = documentTargetStore(txn);
        var range = IDBKeyRange.bound([targetId], [targetId + 1], 
        /*lowerOpen=*/ false, 
        /*upperOpen=*/ true);
        return this.notifyGCForRemovedKeys(txn, range).next(function () {
            return store.delete(range);
        });
    };
    IndexedDbQueryCache.prototype.notifyGCForRemovedKeys = function (txn, range) {
        var _this = this;
        var store = documentTargetStore(txn);
        if (this.garbageCollector !== null && this.garbageCollector.isEager) {
            // In order to generate garbage events properly, we need to read these
            // keys before deleting.
            return store.iterate({ range: range, keysOnly: true }, function (key, _, control) {
                var path = EncodedResourcePath.decode(key[1]);
                var docKey = new document_key_1.DocumentKey(path);
                // Paranoid assertion in case the the collector is set to null
                // during the iteration.
                assert_1.assert(_this.garbageCollector !== null, 'GarbageCollector for query cache set to null during key removal.');
                _this.garbageCollector.addPotentialGarbageKey(docKey);
            });
        }
        else {
            return persistence_promise_1.PersistencePromise.resolve();
        }
    };
    IndexedDbQueryCache.prototype.getMatchingKeysForTargetId = function (txn, targetId) {
        var promises = [];
        var range = IDBKeyRange.bound([targetId], [targetId + 1], 
        /*lowerOpen=*/ false, 
        /*upperOpen=*/ true);
        var store = documentTargetStore(txn);
        var result = collections_1.documentKeySet();
        return store
            .iterate({ range: range, keysOnly: true }, function (key, _, control) {
            var path = EncodedResourcePath.decode(key[1]);
            var docKey = new document_key_1.DocumentKey(path);
            result = result.add(docKey);
        })
            .next(function () { return result; });
    };
    IndexedDbQueryCache.prototype.setGarbageCollector = function (gc) {
        this.garbageCollector = gc;
    };
    IndexedDbQueryCache.prototype.containsKey = function (txn, key) {
        assert_1.assert(txn !== null, 'Persistence Transaction cannot be null for query cache containsKey');
        var path = EncodedResourcePath.encode(key.path);
        var range = IDBKeyRange.bound([path], [misc_1.immediateSuccessor(path)], 
        /*lowerOpen=*/ false, 
        /*upperOpen=*/ true);
        var count = 0;
        return documentTargetStore(txn)
            .iterate({
            index: indexeddb_schema_1.DbTargetDocument.documentTargetsIndex,
            keysOnly: true,
            range: range
        }, function (key, _, control) {
            count++;
            control.done();
        })
            .next(function () { return count > 0; });
    };
    return IndexedDbQueryCache;
}());
exports.IndexedDbQueryCache = IndexedDbQueryCache;
/**
 * Helper to get a typed SimpleDbStore for the queries object store.
 */
function targetsStore(txn) {
    return getStore(txn, indexeddb_schema_1.DbTarget.store);
}
/**
 * Helper to get a typed SimpleDbStore for the target globals object store.
 */
function globalTargetStore(txn) {
    return getStore(txn, indexeddb_schema_1.DbTargetGlobal.store);
}
/**
 * Helper to get a typed SimpleDbStore for the document target object store.
 */
function documentTargetStore(txn) {
    return getStore(txn, indexeddb_schema_1.DbTargetDocument.store);
}
/**
 * Helper to get a typed SimpleDbStore from a transaction.
 */
function getStore(txn, store) {
    if (txn instanceof simple_db_1.SimpleDbTransaction) {
        return txn.store(store);
    }
    else {
        return assert_1.fail('Invalid transaction object provided!');
    }
}

//# sourceMappingURL=indexeddb_query_cache.js.map
