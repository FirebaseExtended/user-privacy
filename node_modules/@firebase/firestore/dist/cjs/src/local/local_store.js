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
var target_id_generator_1 = require("../core/target_id_generator");
var timestamp_1 = require("../core/timestamp");
var collections_1 = require("../model/collections");
var mutation_batch_1 = require("../model/mutation_batch");
var remote_event_1 = require("../remote/remote_event");
var assert_1 = require("../util/assert");
var log = require("../util/log");
var objUtils = require("../util/obj");
var local_documents_view_1 = require("./local_documents_view");
var persistence_promise_1 = require("./persistence_promise");
var query_data_1 = require("./query_data");
var reference_set_1 = require("./reference_set");
var remote_document_change_buffer_1 = require("./remote_document_change_buffer");
var LOG_TAG = 'LocalStore';
/**
 * Local storage in the Firestore client. Coordinates persistence components
 * like the mutation queue and remote document cache to present a
 * latency-compensated view of stored data.
 *
 * The LocalStore is responsible for accepting mutations from the Sync Engine.
 * Writes from the client are put into a queue as provisional Mutations until
 * they are processed by the RemoteStore and confirmed as having been written
 * to the server.
 *
 * The local store provides the local version of documents that have been
 * modified locally. It maintains the constraint:
 *
 *   LocalDocument = RemoteDocument + Active(LocalMutations)
 *
 * (Active mutations are those that are enqueued and have not been previously
 * acknowledged or rejected).
 *
 * The RemoteDocument ("ground truth") state is provided via the
 * applyChangeBatch method. It will be some version of a server-provided
 * document OR will be a server-provided document PLUS acknowledged mutations:
 *
 *   RemoteDocument' = RemoteDocument + Acknowledged(LocalMutations)
 *
 * Note that this "dirty" version of a RemoteDocument will not be identical to a
 * server base version, since it has LocalMutations added to it pending getting
 * an authoritative copy from the server.
 *
 * Since LocalMutations can be rejected by the server, we have to be able to
 * revert a LocalMutation that has already been applied to the LocalDocument
 * (typically done by replaying all remaining LocalMutations to the
 * RemoteDocument to re-apply).
 *
 * The LocalStore is responsible for the garbage collection of the documents it
 * contains. For now, it every doc referenced by a view, the mutation queue, or
 * the RemoteStore.
 *
 * It also maintains the persistence of mapping queries to resume tokens and
 * target ids. It needs to know this data about queries to properly know what
 * docs it would be allowed to garbage collect.
 *
 * The LocalStore must be able to efficiently execute queries against its local
 * cache of the documents, to provide the initial set of results before any
 * remote changes have been received.
 *
 * Note: In TypeScript, most methods return Promises since the implementation
 * may rely on fetching data from IndexedDB which is async.
 * These Promises will only be rejected on an I/O error or other internal
 * (unexpected) failure (e.g. failed assert) and always represent an
 * unrecoverable error (should be caught / reported by the async_queue).
 */
var LocalStore = /** @class */ (function () {
    function LocalStore(
        /** Manages our in-memory or durable persistence. */
        persistence, initialUser, 
        /**
         * The garbage collector collects documents that should no longer be
         * cached (e.g. if they are no longer retained by the above reference sets
         * and the garbage collector is performing eager collection).
         */
        garbageCollector) {
        this.persistence = persistence;
        this.garbageCollector = garbageCollector;
        /**
         * The set of document references maintained by any local views.
         */
        this.localViewReferences = new reference_set_1.ReferenceSet();
        /** Maps a targetID to data about its query. */
        this.targetIds = {};
        /** Used to generate targetIDs for queries tracked locally. */
        this.targetIdGenerator = target_id_generator_1.TargetIdGenerator.forLocalStore();
        /**
         * A heldBatchResult is a mutation batch result (from a write acknowledgement)
         * that arrived before the watch stream got notified of a snapshot that
         * includes the write. So we "hold" it until the watch stream catches up. It
         * ensures that the local write remains visible (latency compensation) and
         * doesn't temporarily appear reverted because the watch stream is slower than
         * the write stream and so wasn't reflecting it.
         *
         * NOTE: Eventually we want to move this functionality into the remote store.
         */
        this.heldBatchResults = [];
        this.mutationQueue = persistence.getMutationQueue(initialUser);
        this.remoteDocuments = persistence.getRemoteDocumentCache();
        this.queryCache = persistence.getQueryCache();
        this.localDocuments = new local_documents_view_1.LocalDocumentsView(this.remoteDocuments, this.mutationQueue);
        this.garbageCollector.addGarbageSource(this.localViewReferences);
        this.garbageCollector.addGarbageSource(this.queryCache);
        this.garbageCollector.addGarbageSource(this.mutationQueue);
    }
    /** Performs any initial startup actions required by the local store. */
    LocalStore.prototype.start = function () {
        var _this = this;
        return this.persistence.runTransaction('Start LocalStore', function (txn) {
            return _this.startMutationQueue(txn).next(function () { return _this.startQueryCache(txn); });
        });
    };
    /**
     * Tells the LocalStore that the currently authenticated user has changed.
     *
     * In response the local store switches the mutation queue to the new user and
     * returns any resulting document changes.
     */
    LocalStore.prototype.handleUserChange = function (user) {
        var _this = this;
        return this.persistence.runTransaction('Handle user change', function (txn) {
            // Swap out the mutation queue, grabbing the pending mutation batches
            // before and after.
            var oldBatches;
            return _this.mutationQueue
                .getAllMutationBatches(txn)
                .next(function (promisedOldBatches) {
                oldBatches = promisedOldBatches;
                _this.garbageCollector.removeGarbageSource(_this.mutationQueue);
                _this.mutationQueue = _this.persistence.getMutationQueue(user);
                _this.garbageCollector.addGarbageSource(_this.mutationQueue);
                return _this.startMutationQueue(txn);
            })
                .next(function () {
                // Recreate our LocalDocumentsView using the new
                // MutationQueue.
                _this.localDocuments = new local_documents_view_1.LocalDocumentsView(_this.remoteDocuments, _this.mutationQueue);
                return _this.mutationQueue.getAllMutationBatches(txn);
            })
                .next(function (newBatches) {
                // Union the old/new changed keys.
                var changedKeys = collections_1.documentKeySet();
                for (var _i = 0, _a = [oldBatches, newBatches]; _i < _a.length; _i++) {
                    var batches = _a[_i];
                    for (var _b = 0, batches_1 = batches; _b < batches_1.length; _b++) {
                        var batch = batches_1[_b];
                        for (var _c = 0, _d = batch.mutations; _c < _d.length; _c++) {
                            var mutation = _d[_c];
                            changedKeys = changedKeys.add(mutation.key);
                        }
                    }
                }
                // Return the set of all (potentially) changed documents as the
                // result of the user change.
                return _this.localDocuments.getDocuments(txn, changedKeys);
            });
        });
    };
    LocalStore.prototype.startQueryCache = function (txn) {
        var _this = this;
        return this.queryCache.start(txn).next(function () {
            var targetId = _this.queryCache.getHighestTargetId();
            _this.targetIdGenerator = target_id_generator_1.TargetIdGenerator.forLocalStore(targetId);
        });
    };
    LocalStore.prototype.startMutationQueue = function (txn) {
        var _this = this;
        return this.mutationQueue
            .start(txn)
            .next(function () {
            // If we have any leftover mutation batch results from a prior run,
            // just drop them.
            // TODO(http://b/33446471): We probably need to repopulate
            // heldBatchResults or similar instead, but that is not
            // straightforward since we're not persisting the write ack versions.
            _this.heldBatchResults = [];
            return _this.mutationQueue.getHighestAcknowledgedBatchId(txn);
        })
            .next(function (highestAck) {
            // TODO(mikelehen): This is the only usage of
            // getAllMutationBatchesThroughBatchId(). Consider removing it in
            // favor of a getAcknowledgedBatches() method.
            if (highestAck !== mutation_batch_1.BATCHID_UNKNOWN) {
                return _this.mutationQueue.getAllMutationBatchesThroughBatchId(txn, highestAck);
            }
            else {
                return persistence_promise_1.PersistencePromise.resolve([]);
            }
        })
            .next(function (ackedBatches) {
            if (ackedBatches.length > 0) {
                return _this.mutationQueue.removeMutationBatches(txn, ackedBatches);
            }
            else {
                return persistence_promise_1.PersistencePromise.resolve();
            }
        });
    };
    /* Accept locally generated Mutations and commit them to storage. */
    LocalStore.prototype.localWrite = function (mutations) {
        var _this = this;
        return this.persistence.runTransaction('Locally write mutations', function (txn) {
            var batch;
            var localWriteTime = timestamp_1.Timestamp.now();
            return _this.mutationQueue
                .addMutationBatch(txn, localWriteTime, mutations)
                .next(function (promisedBatch) {
                batch = promisedBatch;
                // TODO(koss): This is doing an N^2 update by replaying ALL the
                // mutations on each document (instead of just the ones added) in
                // this batch.
                var keys = batch.keys();
                return _this.localDocuments.getDocuments(txn, keys);
            })
                .next(function (changedDocuments) {
                return { batchId: batch.batchId, changes: changedDocuments };
            });
        });
    };
    /**
     * Acknowledge the given batch.
     *
     * On the happy path when a batch is acknowledged, the local store will
     *
     *  + remove the batch from the mutation queue;
     *  + apply the changes to the remote document cache;
     *  + recalculate the latency compensated view implied by those changes (there
     *    may be mutations in the queue that affect the documents but haven't been
     *    acknowledged yet); and
     *  + give the changed documents back the sync engine
     *
     * @returns The resulting (modified) documents.
     */
    LocalStore.prototype.acknowledgeBatch = function (batchResult) {
        var _this = this;
        return this.persistence.runTransaction('Acknowledge batch', function (txn) {
            var affected;
            return _this.mutationQueue
                .acknowledgeBatch(txn, batchResult.batch, batchResult.streamToken)
                .next(function () {
                if (_this.shouldHoldBatchResult(batchResult.commitVersion)) {
                    _this.heldBatchResults.push(batchResult);
                    affected = collections_1.documentKeySet();
                    return persistence_promise_1.PersistencePromise.resolve();
                }
                else {
                    var documentBuffer_1 = new remote_document_change_buffer_1.RemoteDocumentChangeBuffer(_this.remoteDocuments);
                    return _this.releaseBatchResults(txn, [batchResult], documentBuffer_1).next(function (promisedAffectedKeys) {
                        affected = promisedAffectedKeys;
                        return documentBuffer_1.apply(txn);
                    });
                }
            })
                .next(function () {
                return _this.mutationQueue.performConsistencyCheck(txn);
            })
                .next(function () {
                return _this.localDocuments.getDocuments(txn, affected);
            });
        });
    };
    /**
     * Remove mutations from the MutationQueue for the specified batch;
     * LocalDocuments will be recalculated.
     *
     * @returns The resulting modified documents.
     */
    LocalStore.prototype.rejectBatch = function (batchId) {
        var _this = this;
        return this.persistence.runTransaction('Reject batch', function (txn) {
            var toReject;
            var affectedKeys;
            return _this.mutationQueue
                .lookupMutationBatch(txn, batchId)
                .next(function (promisedToReject) {
                assert_1.assert(promisedToReject != null, 'Attempt to reject nonexistent batch!');
                toReject = promisedToReject;
                return _this.mutationQueue
                    .getHighestAcknowledgedBatchId(txn)
                    .next(function (lastAcked) {
                    assert_1.assert(batchId > lastAcked, "Acknowledged batches can't be rejected.");
                    return toReject;
                });
            })
                .next(function () {
                return _this.removeMutationBatch(txn, toReject);
            })
                .next(function (promisedAffectedKeys) {
                affectedKeys = promisedAffectedKeys;
                return _this.mutationQueue.performConsistencyCheck(txn);
            })
                .next(function () {
                return _this.localDocuments.getDocuments(txn, affectedKeys);
            });
        });
    };
    /** Returns the last recorded stream token for the current user. */
    LocalStore.prototype.getLastStreamToken = function () {
        var _this = this;
        return this.persistence.runTransaction('Get last stream token', function (txn) {
            return _this.mutationQueue.getLastStreamToken(txn);
        });
    };
    /**
     * Sets the stream token for the current user without acknowledging any
     * mutation batch. This is usually only useful after a stream handshake or in
     * response to an error that requires clearing the stream token.
     */
    LocalStore.prototype.setLastStreamToken = function (streamToken) {
        var _this = this;
        return this.persistence.runTransaction('Set last stream token', function (txn) {
            return _this.mutationQueue.setLastStreamToken(txn, streamToken);
        });
    };
    /**
     * Returns the last consistent snapshot processed (used by the RemoteStore to
     * determine whether to buffer incoming snapshots from the backend).
     */
    LocalStore.prototype.getLastRemoteSnapshotVersion = function () {
        return this.queryCache.getLastRemoteSnapshotVersion();
    };
    /**
     * Update the "ground-state" (remote) documents. We assume that the remote
     * event reflects any write batches that have been acknowledged or rejected
     * (i.e. we do not re-apply local mutations to updates from this event).
     *
     * LocalDocuments are re-calculated if there are remaining mutations in the
     * queue.
     */
    LocalStore.prototype.applyRemoteEvent = function (remoteEvent) {
        var _this = this;
        var documentBuffer = new remote_document_change_buffer_1.RemoteDocumentChangeBuffer(this.remoteDocuments);
        return this.persistence.runTransaction('Apply remote event', function (txn) {
            var promises = [];
            objUtils.forEachNumber(remoteEvent.targetChanges, function (targetId, change) {
                // Do not ref/unref unassigned targetIds - it may lead to leaks.
                var queryData = _this.targetIds[targetId];
                if (!queryData)
                    return;
                var mapping = change.mapping;
                if (mapping) {
                    // First make sure that all references are deleted
                    if (mapping instanceof remote_event_1.ResetMapping) {
                        promises.push(_this.queryCache
                            .removeMatchingKeysForTargetId(txn, targetId)
                            .next(function () {
                            return _this.queryCache.addMatchingKeys(txn, mapping.documents, targetId);
                        }));
                    }
                    else if (mapping instanceof remote_event_1.UpdateMapping) {
                        promises.push(_this.queryCache
                            .removeMatchingKeys(txn, mapping.removedDocuments, targetId)
                            .next(function () {
                            return _this.queryCache.addMatchingKeys(txn, mapping.addedDocuments, targetId);
                        }));
                    }
                    else {
                        return assert_1.fail('Unknown mapping type: ' + JSON.stringify(mapping));
                    }
                }
                // Update the resume token if the change includes one. Don't clear
                // any preexisting value.
                var resumeToken = change.resumeToken;
                if (resumeToken.length > 0) {
                    queryData = queryData.update({
                        resumeToken: resumeToken,
                        snapshotVersion: change.snapshotVersion
                    });
                    _this.targetIds[targetId] = queryData;
                    promises.push(_this.queryCache.addQueryData(txn, queryData));
                }
            });
            var changedDocKeys = collections_1.documentKeySet();
            remoteEvent.documentUpdates.forEach(function (key, doc) {
                changedDocKeys = changedDocKeys.add(key);
                promises.push(documentBuffer.getEntry(txn, key).next(function (existingDoc) {
                    // Make sure we don't apply an old document version to the remote
                    // cache, though we make an exception for SnapshotVersion.MIN which
                    // can happen for manufactured events (e.g. in the case of a limbo
                    // document resolution failing).
                    if (existingDoc == null ||
                        doc.version.equals(snapshot_version_1.SnapshotVersion.MIN) ||
                        doc.version.compareTo(existingDoc.version) >= 0) {
                        documentBuffer.addEntry(doc);
                    }
                    else {
                        log.debug(LOG_TAG, 'Ignoring outdated watch update for ', key, '. Current version:', existingDoc.version, ' Watch version:', doc.version);
                    }
                    // The document might be garbage because it was unreferenced by
                    // everything. Make sure to mark it as garbage if it is...
                    _this.garbageCollector.addPotentialGarbageKey(key);
                }));
            });
            // HACK: The only reason we allow a null snapshot version is so that we
            // can synthesize remote events when we get permission denied errors while
            // trying to resolve the state of a locally cached document that is in
            // limbo.
            var lastRemoteVersion = _this.queryCache.getLastRemoteSnapshotVersion();
            var remoteVersion = remoteEvent.snapshotVersion;
            if (!remoteVersion.equals(snapshot_version_1.SnapshotVersion.MIN)) {
                assert_1.assert(remoteVersion.compareTo(lastRemoteVersion) >= 0, 'Watch stream reverted to previous snapshot?? ' +
                    remoteVersion +
                    ' < ' +
                    lastRemoteVersion);
                promises.push(_this.queryCache.setLastRemoteSnapshotVersion(txn, remoteVersion));
            }
            var releasedWriteKeys;
            return persistence_promise_1.PersistencePromise.waitFor(promises)
                .next(function () { return _this.releaseHeldBatchResults(txn, documentBuffer); })
                .next(function (promisedReleasedWriteKeys) {
                releasedWriteKeys = promisedReleasedWriteKeys;
                return documentBuffer.apply(txn);
            })
                .next(function () {
                return _this.localDocuments.getDocuments(txn, changedDocKeys.unionWith(releasedWriteKeys));
            });
        });
    };
    /**
     * Notify local store of the changed views to locally pin documents.
     */
    LocalStore.prototype.notifyLocalViewChanges = function (viewChanges) {
        var _this = this;
        return this.persistence.runTransaction('Notify local view changes', function (txn) {
            var promises = [];
            var _loop_1 = function (view) {
                promises.push(_this.queryCache
                    .getQueryData(txn, view.query)
                    .next(function (queryData) {
                    assert_1.assert(queryData !== null, 'Local view changes contain unallocated query.');
                    var targetId = queryData.targetId;
                    _this.localViewReferences.addReferences(view.addedKeys, targetId);
                    _this.localViewReferences.removeReferences(view.removedKeys, targetId);
                }));
            };
            for (var _i = 0, viewChanges_1 = viewChanges; _i < viewChanges_1.length; _i++) {
                var view = viewChanges_1[_i];
                _loop_1(view);
            }
            return persistence_promise_1.PersistencePromise.waitFor(promises);
        });
    };
    /**
     * Gets the mutation batch after the passed in batchId in the mutation queue
     * or null if empty.
     * @param afterBatchId If provided, the batch to search after.
     * @returns The next mutation or null if there wasn't one.
     */
    LocalStore.prototype.nextMutationBatch = function (afterBatchId) {
        var _this = this;
        return this.persistence.runTransaction('Get next mutation batch', function (txn) {
            if (afterBatchId === undefined) {
                afterBatchId = mutation_batch_1.BATCHID_UNKNOWN;
            }
            return _this.mutationQueue.getNextMutationBatchAfterBatchId(txn, afterBatchId);
        });
    };
    /**
     * Read the current value of a Document with a given key or null if not
     * found - used for testing.
     */
    LocalStore.prototype.readDocument = function (key) {
        var _this = this;
        return this.persistence.runTransaction('read document', function (txn) {
            return _this.localDocuments.getDocument(txn, key);
        });
    };
    /**
     * Assigns the given query an internal ID so that its results can be pinned so
     * they don't get GC'd. A query must be allocated in the local store before
     * the store can be used to manage its view.
     */
    LocalStore.prototype.allocateQuery = function (query) {
        var _this = this;
        return this.persistence.runTransaction('Allocate query', function (txn) {
            var queryData;
            return _this.queryCache
                .getQueryData(txn, query)
                .next(function (cached) {
                if (cached) {
                    // This query has been listened to previously, so reuse the
                    // previous targetID.
                    // TODO(mcg): freshen last accessed date?
                    queryData = cached;
                    return persistence_promise_1.PersistencePromise.resolve();
                }
                else {
                    var targetId = _this.targetIdGenerator.next();
                    queryData = new query_data_1.QueryData(query, targetId, query_data_1.QueryPurpose.Listen);
                    return _this.queryCache.addQueryData(txn, queryData);
                }
            })
                .next(function () {
                assert_1.assert(!_this.targetIds[queryData.targetId], 'Tried to allocate an already allocated query: ' + query);
                _this.targetIds[queryData.targetId] = queryData;
                return queryData;
            });
        });
    };
    /** Unpin all the documents associated with the given query. */
    LocalStore.prototype.releaseQuery = function (query) {
        var _this = this;
        return this.persistence.runTransaction('Release query', function (txn) {
            return _this.queryCache
                .getQueryData(txn, query)
                .next(function (queryData) {
                assert_1.assert(queryData != null, 'Tried to release nonexistent query: ' + query);
                _this.localViewReferences.removeReferencesForId(queryData.targetId);
                delete _this.targetIds[queryData.targetId];
                if (_this.garbageCollector.isEager) {
                    return _this.queryCache.removeQueryData(txn, queryData);
                }
                else {
                    return persistence_promise_1.PersistencePromise.resolve();
                }
            })
                .next(function () {
                // If this was the last watch target, then we won't get any more
                // watch snapshots, so we should release any held batch results.
                if (objUtils.isEmpty(_this.targetIds)) {
                    var documentBuffer_2 = new remote_document_change_buffer_1.RemoteDocumentChangeBuffer(_this.remoteDocuments);
                    return _this.releaseHeldBatchResults(txn, documentBuffer_2).next(function () {
                        documentBuffer_2.apply(txn);
                    });
                }
                else {
                    return persistence_promise_1.PersistencePromise.resolve();
                }
            });
        });
    };
    /**
     * Runs the specified query against all the documents in the local store and
     * returns the results.
     */
    LocalStore.prototype.executeQuery = function (query) {
        var _this = this;
        return this.persistence.runTransaction('Execute query', function (txn) {
            return _this.localDocuments.getDocumentsMatchingQuery(txn, query);
        });
    };
    /**
     * Returns the keys of the documents that are associated with the given
     * target id in the remote table.
     */
    LocalStore.prototype.remoteDocumentKeys = function (targetId) {
        var _this = this;
        return this.persistence.runTransaction('Remote document keys', function (txn) {
            return _this.queryCache.getMatchingKeysForTargetId(txn, targetId);
        });
    };
    /**
     * Collect garbage if necessary.
     * Should be called periodically by Sync Engine to recover resources. The
     * implementation must guarantee that GC won't happen in other places than
     * this method call.
     */
    LocalStore.prototype.collectGarbage = function () {
        var _this = this;
        // Call collectGarbage regardless of whether isGCEnabled so the referenceSet
        // doesn't continue to accumulate the garbage keys.
        return this.persistence.runTransaction('Garbage collection', function (txn) {
            return _this.garbageCollector.collectGarbage(txn).next(function (garbage) {
                var promises = [];
                garbage.forEach(function (key) {
                    promises.push(_this.remoteDocuments.removeEntry(txn, key));
                });
                return persistence_promise_1.PersistencePromise.waitFor(promises);
            });
        });
    };
    LocalStore.prototype.releaseHeldBatchResults = function (txn, documentBuffer) {
        var toRelease = [];
        for (var _i = 0, _a = this.heldBatchResults; _i < _a.length; _i++) {
            var batchResult = _a[_i];
            if (!this.isRemoteUpToVersion(batchResult.commitVersion)) {
                break;
            }
            toRelease.push(batchResult);
        }
        if (toRelease.length === 0) {
            return persistence_promise_1.PersistencePromise.resolve(collections_1.documentKeySet());
        }
        else {
            this.heldBatchResults.splice(0, toRelease.length);
            return this.releaseBatchResults(txn, toRelease, documentBuffer);
        }
    };
    LocalStore.prototype.isRemoteUpToVersion = function (version) {
        // If there are no watch targets, then we won't get remote snapshots, and
        // we are always "up-to-date."
        var lastRemoteVersion = this.queryCache.getLastRemoteSnapshotVersion();
        return (version.compareTo(lastRemoteVersion) <= 0 ||
            objUtils.isEmpty(this.targetIds));
    };
    LocalStore.prototype.shouldHoldBatchResult = function (version) {
        // Check if watcher isn't up to date or prior results are already held.
        return (!this.isRemoteUpToVersion(version) || this.heldBatchResults.length > 0);
    };
    LocalStore.prototype.releaseBatchResults = function (txn, batchResults, documentBuffer) {
        var _this = this;
        var promiseChain = persistence_promise_1.PersistencePromise.resolve();
        var _loop_2 = function (batchResult) {
            promiseChain = promiseChain.next(function () {
                return _this.applyWriteToRemoteDocuments(txn, batchResult, documentBuffer);
            });
        };
        for (var _i = 0, batchResults_1 = batchResults; _i < batchResults_1.length; _i++) {
            var batchResult = batchResults_1[_i];
            _loop_2(batchResult);
        }
        return promiseChain.next(function () {
            return _this.removeMutationBatches(txn, batchResults.map(function (result) { return result.batch; }));
        });
    };
    LocalStore.prototype.removeMutationBatch = function (txn, batch) {
        return this.removeMutationBatches(txn, [batch]);
    };
    /** Removes all the mutation batches named in the given array. */
    LocalStore.prototype.removeMutationBatches = function (txn, batches) {
        var affectedDocs = collections_1.documentKeySet();
        for (var _i = 0, batches_2 = batches; _i < batches_2.length; _i++) {
            var batch = batches_2[_i];
            for (var _a = 0, _b = batch.mutations; _a < _b.length; _a++) {
                var mutation = _b[_a];
                var key = mutation.key;
                affectedDocs = affectedDocs.add(key);
            }
        }
        return this.mutationQueue
            .removeMutationBatches(txn, batches)
            .next(function () { return affectedDocs; });
    };
    LocalStore.prototype.applyWriteToRemoteDocuments = function (txn, batchResult, documentBuffer) {
        var batch = batchResult.batch;
        var docKeys = batch.keys();
        var promiseChain = persistence_promise_1.PersistencePromise.resolve();
        docKeys.forEach(function (docKey) {
            promiseChain = promiseChain
                .next(function () {
                return documentBuffer.getEntry(txn, docKey);
            })
                .next(function (remoteDoc) {
                var doc = remoteDoc;
                var ackVersion = batchResult.docVersions.get(docKey);
                assert_1.assert(ackVersion !== null, 'ackVersions should contain every doc in the write.');
                if (!doc || doc.version.compareTo(ackVersion) < 0) {
                    doc = batch.applyToRemoteDocument(docKey, doc, batchResult);
                    if (!doc) {
                        assert_1.assert(!remoteDoc, 'Mutation batch ' +
                            batch +
                            ' applied to document ' +
                            remoteDoc +
                            ' resulted in null');
                    }
                    else {
                        documentBuffer.addEntry(doc);
                    }
                }
            });
        });
        return promiseChain;
    };
    return LocalStore;
}());
exports.LocalStore = LocalStore;

//# sourceMappingURL=local_store.js.map
