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
import { BATCHID_UNKNOWN, MutationBatch } from '../model/mutation_batch';
import { assert, fail } from '../util/assert';
import { immediatePredecessor, primitiveComparator } from '../util/misc';
import { SortedSet } from '../util/sorted_set';
import * as EncodedResourcePath from './encoded_resource_path';
import { DbDocumentMutation, DbMutationBatch, DbMutationQueue } from './indexeddb_schema';
import { PersistencePromise } from './persistence_promise';
import { SimpleDbTransaction } from './simple_db';
/** A mutation queue for a specific user, backed by IndexedDB. */
var IndexedDbMutationQueue = /** @class */ (function () {
    function IndexedDbMutationQueue(
        /**
         * The normalized userId (e.g. null UID => "" userId) used to store /
         * retrieve mutations.
         */
        userId, serializer) {
        this.userId = userId;
        this.serializer = serializer;
        this.garbageCollector = null;
    }
    /**
     * Creates a new mutation queue for the given user.
     * @param user The user for which to create a mutation queue.
     * @param serializer The serializer to use when persisting to IndexedDb.
     */
    IndexedDbMutationQueue.forUser = function (user, serializer) {
        // TODO(mcg): Figure out what constraints there are on userIDs
        // In particular, are there any reserved characters? are empty ids allowed?
        // For the moment store these together in the same mutations table assuming
        // that empty userIDs aren't allowed.
        assert(user.uid !== '', 'UserID must not be an empty string.');
        var userId = user.isUnauthenticated() ? '' : user.uid;
        return new IndexedDbMutationQueue(userId, serializer);
    };
    IndexedDbMutationQueue.prototype.start = function (transaction) {
        var _this = this;
        return IndexedDbMutationQueue.loadNextBatchIdFromDb(transaction)
            .next(function (nextBatchId) {
            _this.nextBatchId = nextBatchId;
            return mutationQueuesStore(transaction).get(_this.userId);
        })
            .next(function (metadata) {
            if (!metadata) {
                metadata = new DbMutationQueue(_this.userId, BATCHID_UNKNOWN, 
                /*lastStreamToken=*/ '');
            }
            _this.metadata = metadata;
            // On restart, nextBatchId may end up lower than
            // lastAcknowledgedBatchId since it's computed from the queue
            // contents, and there may be no mutations in the queue. In this
            // case, we need to reset lastAcknowledgedBatchId (which is safe
            // since the queue must be empty).
            if (_this.metadata.lastAcknowledgedBatchId >= _this.nextBatchId) {
                return _this.checkEmpty(transaction).next(function (empty) {
                    assert(empty, 'Reset nextBatchID is only possible when the queue is empty');
                    _this.metadata.lastAcknowledgedBatchId = BATCHID_UNKNOWN;
                    return mutationQueuesStore(transaction).put(_this.metadata);
                });
            }
            else {
                return PersistencePromise.resolve();
            }
        });
    };
    /**
     * Returns one larger than the largest batch ID that has been stored. If there
     * are no mutations returns 0. Note that batch IDs are global.
     */
    IndexedDbMutationQueue.loadNextBatchIdFromDb = function (txn) {
        var maxBatchId = BATCHID_UNKNOWN;
        return mutationsStore(txn)
            .iterate({ reverse: true }, function (key, batch, control) {
            var userId = key[0], batchId = key[1];
            if (batchId > maxBatchId) {
                maxBatchId = batch.batchId;
            }
            if (userId === '') {
                // We can't compute a predecessor for the empty string, since it
                // is lexographically first. That also means that no other
                // userIds can come before this one, so we can just exit early.
                control.done();
            }
            else {
                var nextUser = immediatePredecessor(userId);
                control.skip([nextUser]);
            }
        })
            .next(function () { return maxBatchId + 1; });
    };
    IndexedDbMutationQueue.prototype.checkEmpty = function (transaction) {
        var empty = true;
        var range = IDBKeyRange.bound(this.keyForBatchId(Number.NEGATIVE_INFINITY), this.keyForBatchId(Number.POSITIVE_INFINITY));
        return mutationsStore(transaction)
            .iterate({ range: range }, function (key, value, control) {
            empty = false;
            control.done();
        })
            .next(function () { return empty; });
    };
    IndexedDbMutationQueue.prototype.getNextBatchId = function (transaction) {
        return PersistencePromise.resolve(this.nextBatchId);
    };
    IndexedDbMutationQueue.prototype.getHighestAcknowledgedBatchId = function (transaction) {
        return PersistencePromise.resolve(this.metadata.lastAcknowledgedBatchId);
    };
    IndexedDbMutationQueue.prototype.acknowledgeBatch = function (transaction, batch, streamToken) {
        var batchId = batch.batchId;
        assert(batchId > this.metadata.lastAcknowledgedBatchId, 'Mutation batchIDs must be acknowledged in order');
        this.metadata.lastAcknowledgedBatchId = batchId;
        this.metadata.lastStreamToken = validateStreamToken(streamToken);
        return mutationQueuesStore(transaction).put(this.metadata);
    };
    IndexedDbMutationQueue.prototype.getLastStreamToken = function (transaction) {
        return PersistencePromise.resolve(this.metadata.lastStreamToken);
    };
    IndexedDbMutationQueue.prototype.setLastStreamToken = function (transaction, streamToken) {
        this.metadata.lastStreamToken = validateStreamToken(streamToken);
        return mutationQueuesStore(transaction).put(this.metadata);
    };
    IndexedDbMutationQueue.prototype.addMutationBatch = function (transaction, localWriteTime, mutations) {
        var _this = this;
        var batchId = this.nextBatchId;
        this.nextBatchId++;
        var batch = new MutationBatch(batchId, localWriteTime, mutations);
        var dbBatch = this.serializer.toDbMutationBatch(this.userId, batch);
        return mutationsStore(transaction)
            .put(dbBatch)
            .next(function () {
            var promises = [];
            for (var _i = 0, mutations_1 = mutations; _i < mutations_1.length; _i++) {
                var mutation = mutations_1[_i];
                var encodedPath = EncodedResourcePath.encode(mutation.key.path);
                var indexKey = DbDocumentMutation.key(_this.userId, mutation.key.path, batchId);
                documentMutationsStore(transaction).put(indexKey, DbDocumentMutation.PLACEHOLDER);
            }
            return PersistencePromise.waitFor(promises);
        })
            .next(function () {
            return batch;
        });
    };
    IndexedDbMutationQueue.prototype.lookupMutationBatch = function (transaction, batchId) {
        var _this = this;
        return mutationsStore(transaction)
            .get(this.keyForBatchId(batchId))
            .next(function (dbBatch) {
            return dbBatch ? _this.serializer.fromDbMutationBatch(dbBatch) : null;
        });
    };
    IndexedDbMutationQueue.prototype.getNextMutationBatchAfterBatchId = function (transaction, batchId) {
        var _this = this;
        var range = IDBKeyRange.lowerBound(this.keyForBatchId(batchId + 1));
        var foundBatch = null;
        return mutationsStore(transaction)
            .iterate({ range: range }, function (key, dbBatch, control) {
            if (dbBatch.userId === _this.userId) {
                assert(dbBatch.batchId > batchId, 'Should have found mutation after ' + batchId);
                foundBatch = _this.serializer.fromDbMutationBatch(dbBatch);
            }
            control.done();
        })
            .next(function () { return foundBatch; });
    };
    IndexedDbMutationQueue.prototype.getAllMutationBatches = function (transaction) {
        var _this = this;
        var range = IDBKeyRange.bound(this.keyForBatchId(BATCHID_UNKNOWN), this.keyForBatchId(Number.POSITIVE_INFINITY));
        return mutationsStore(transaction)
            .loadAll(range)
            .next(function (dbBatches) {
            return dbBatches.map(function (dbBatch) { return _this.serializer.fromDbMutationBatch(dbBatch); });
        });
    };
    IndexedDbMutationQueue.prototype.getAllMutationBatchesThroughBatchId = function (transaction, batchId) {
        var _this = this;
        var range = IDBKeyRange.bound(this.keyForBatchId(BATCHID_UNKNOWN), this.keyForBatchId(batchId));
        return mutationsStore(transaction)
            .loadAll(range)
            .next(function (dbBatches) {
            return dbBatches.map(function (dbBatch) { return _this.serializer.fromDbMutationBatch(dbBatch); });
        });
    };
    IndexedDbMutationQueue.prototype.getAllMutationBatchesAffectingDocumentKey = function (transaction, documentKey) {
        var _this = this;
        // Scan the document-mutation index starting with a prefix starting with
        // the given documentKey.
        var indexPrefix = DbDocumentMutation.prefixForPath(this.userId, documentKey.path);
        var indexStart = IDBKeyRange.lowerBound(indexPrefix);
        var results = [];
        return documentMutationsStore(transaction)
            .iterate({ range: indexStart }, function (indexKey, _, control) {
            var userID = indexKey[0], encodedPath = indexKey[1], batchID = indexKey[2];
            // Only consider rows matching exactly the specific key of
            // interest. Note that because we order by path first, and we
            // order terminators before path separators, we'll encounter all
            // the index rows for documentKey contiguously. In particular, all
            // the rows for documentKey will occur before any rows for
            // documents nested in a subcollection beneath documentKey so we
            // can stop as soon as we hit any such row.
            var path = EncodedResourcePath.decode(encodedPath);
            if (userID !== _this.userId || !documentKey.path.equals(path)) {
                control.done();
                return;
            }
            var mutationKey = _this.keyForBatchId(batchID);
            // Look up the mutation batch in the store.
            // PORTING NOTE: because iteration is callback driven in the web,
            // we just look up the key instead of keeping an open iterator
            // like iOS.
            return mutationsStore(transaction)
                .get(mutationKey)
                .next(function (dbBatch) {
                if (dbBatch === null) {
                    fail('Dangling document-mutation reference found: ' +
                        indexKey +
                        ' which points to ' +
                        mutationKey);
                }
                results.push(_this.serializer.fromDbMutationBatch(dbBatch));
            });
        })
            .next(function () { return results; });
    };
    IndexedDbMutationQueue.prototype.getAllMutationBatchesAffectingQuery = function (transaction, query) {
        var _this = this;
        assert(!query.isDocumentQuery(), "Document queries shouldn't go down this path");
        var queryPath = query.path;
        var immediateChildrenLength = queryPath.length + 1;
        // TODO(mcg): Actually implement a single-collection query
        //
        // This is actually executing an ancestor query, traversing the whole
        // subtree below the collection which can be horrifically inefficient for
        // some structures. The right way to solve this is to implement the full
        // value index, but that's not in the cards in the near future so this is
        // the best we can do for the moment.
        //
        // Since we don't yet index the actual properties in the mutations, our
        // current approach is to just return all mutation batches that affect
        // documents in the collection being queried.
        var indexPrefix = DbDocumentMutation.prefixForPath(this.userId, queryPath);
        var encodedQueryPath = indexPrefix[1];
        var indexStart = IDBKeyRange.lowerBound(indexPrefix);
        // Collect up unique batchIDs encountered during a scan of the index. Use a
        // SortedSet to accumulate batch IDs so they can be traversed in order in a
        // scan of the main table.
        var uniqueBatchIDs = new SortedSet(primitiveComparator);
        return documentMutationsStore(transaction)
            .iterate({ range: indexStart }, function (indexKey, _, control) {
            var userID = indexKey[0], encodedPath = indexKey[1], batchID = indexKey[2];
            var path = EncodedResourcePath.decode(encodedPath);
            if (userID !== _this.userId || !queryPath.isPrefixOf(path)) {
                control.done();
                return;
            }
            // Rows with document keys more than one segment longer than the
            // query path can't be matches. For example, a query on 'rooms'
            // can't match the document /rooms/abc/messages/xyx.
            // TODO(mcg): we'll need a different scanner when we implement
            // ancestor queries.
            if (path.length !== immediateChildrenLength) {
                return;
            }
            uniqueBatchIDs = uniqueBatchIDs.add(batchID);
        })
            .next(function () {
            var results = [];
            var promises = [];
            // TODO(rockwood): Implement this using iterate.
            uniqueBatchIDs.forEach(function (batchID) {
                var mutationKey = _this.keyForBatchId(batchID);
                promises.push(mutationsStore(transaction)
                    .get(mutationKey)
                    .next(function (mutation) {
                    if (mutation === null) {
                        fail('Dangling document-mutation reference found, ' +
                            'which points to ' +
                            mutationKey);
                    }
                    results.push(_this.serializer.fromDbMutationBatch(mutation));
                }));
            });
            return PersistencePromise.waitFor(promises).next(function () { return results; });
        });
    };
    IndexedDbMutationQueue.prototype.removeMutationBatches = function (transaction, batches) {
        var txn = mutationsStore(transaction);
        var indexTxn = documentMutationsStore(transaction);
        var promises = [];
        var _loop_1 = function (batch) {
            var range = IDBKeyRange.only(this_1.keyForBatchId(batch.batchId));
            var numDeleted = 0;
            var removePromise = txn.iterate({ range: range }, function (key, value, control) {
                numDeleted++;
                return control.delete();
            });
            promises.push(removePromise.next(function () {
                assert(numDeleted === 1, 'Dangling document-mutation reference found: Missing batch ' +
                    batch.batchId);
            }));
            for (var _i = 0, _a = batch.mutations; _i < _a.length; _i++) {
                var mutation = _a[_i];
                var indexKey = DbDocumentMutation.key(this_1.userId, mutation.key.path, batch.batchId);
                promises.push(indexTxn.delete(indexKey));
                if (this_1.garbageCollector !== null) {
                    this_1.garbageCollector.addPotentialGarbageKey(mutation.key);
                }
            }
        };
        var this_1 = this;
        for (var _i = 0, batches_1 = batches; _i < batches_1.length; _i++) {
            var batch = batches_1[_i];
            _loop_1(batch);
        }
        return PersistencePromise.waitFor(promises);
    };
    IndexedDbMutationQueue.prototype.performConsistencyCheck = function (txn) {
        var _this = this;
        return this.checkEmpty(txn).next(function (empty) {
            if (!empty) {
                return PersistencePromise.resolve();
            }
            // Verify that there are no entries in the documentMutations index if
            // the queue is empty.
            var startRange = IDBKeyRange.lowerBound(DbDocumentMutation.prefixForUser(_this.userId));
            var danglingMutationReferences = [];
            return documentMutationsStore(txn)
                .iterate({ range: startRange }, function (key, _, control) {
                var userID = key[0];
                if (userID !== _this.userId) {
                    control.done();
                    return;
                }
                else {
                    var path = EncodedResourcePath.decode(key[1]);
                    danglingMutationReferences.push(path);
                }
            })
                .next(function () {
                assert(danglingMutationReferences.length === 0, 'Document leak -- detected dangling mutation references when queue is empty. Dangling keys: ' +
                    danglingMutationReferences.map(function (p) { return p.canonicalString(); }));
            });
        });
    };
    IndexedDbMutationQueue.prototype.setGarbageCollector = function (gc) {
        this.garbageCollector = gc;
    };
    IndexedDbMutationQueue.prototype.containsKey = function (txn, key) {
        var _this = this;
        var indexKey = DbDocumentMutation.prefixForPath(this.userId, key.path);
        var encodedPath = indexKey[1];
        var startRange = IDBKeyRange.lowerBound(indexKey);
        var containsKey = false;
        return documentMutationsStore(txn)
            .iterate({ range: startRange, keysOnly: true }, function (key, _, control) {
            var userID = key[0], keyPath = key[1], batchID = key[2];
            if (userID === _this.userId && keyPath === encodedPath) {
                containsKey = true;
            }
            control.done();
        })
            .next(function () { return containsKey; });
    };
    /**
     * Creates a [userId, batchId] key for use with the DbMutationQueue object
     * store.
     */
    IndexedDbMutationQueue.prototype.keyForBatchId = function (batchId) {
        return [this.userId, batchId];
    };
    return IndexedDbMutationQueue;
}());
export { IndexedDbMutationQueue };
function validateStreamToken(token) {
    assert(typeof token === 'string', 'Persisting non-string stream token not supported.');
    return token;
}
/**
 * Helper to get a typed SimpleDbStore for the mutations object store.
 */
function mutationsStore(txn) {
    return getStore(txn, DbMutationBatch.store);
}
/**
 * Helper to get a typed SimpleDbStore for the mutationQueues object store.
 */
function documentMutationsStore(txn) {
    return getStore(txn, DbDocumentMutation.store);
}
/**
 * Helper to get a typed SimpleDbStore for the mutationQueues object store.
 */
function mutationQueuesStore(txn) {
    return getStore(txn, DbMutationQueue.store);
}
/**
 * Helper to get a typed SimpleDbStore from a transaction.
 */
function getStore(txn, store) {
    if (txn instanceof SimpleDbTransaction) {
        return txn.store(store);
    }
    else {
        return fail('Invalid transaction object provided!');
    }
}

//# sourceMappingURL=indexeddb_mutation_queue.js.map
