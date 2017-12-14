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
import { EagerGarbageCollector } from '../local/eager_garbage_collector';
import { LocalViewChanges } from '../local/local_view_changes';
import { QueryData, QueryPurpose } from '../local/query_data';
import { ReferenceSet } from '../local/reference_set';
import { NoDocument } from '../model/document';
import { DocumentKey } from '../model/document_key';
import { CurrentStatusUpdate, RemoteEvent } from '../remote/remote_event';
import { assert, fail } from '../util/assert';
import * as log from '../util/log';
import { primitiveComparator } from '../util/misc';
import * as objUtils from '../util/obj';
import { ObjectMap } from '../util/obj_map';
import { SortedMap } from '../util/sorted_map';
import { isNullOrUndefined } from '../util/types';
import { Query } from './query';
import { SnapshotVersion } from './snapshot_version';
import { TargetIdGenerator } from './target_id_generator';
import { AddedLimboDocument, RemovedLimboDocument, View } from './view';
var LOG_TAG = 'SyncEngine';
/**
 * QueryView contains all of the data that SyncEngine needs to keep track of for
 * a particular query.
 */
var QueryView = /** @class */ (function () {
    function QueryView(
        /**
         * The query itself.
         */
        query, 
        /**
         * The target number created by the client that is used in the watch
         * stream to identify this query.
         */
        targetId, 
        /**
         * An identifier from the datastore backend that indicates the last state
         * of the results that was received. This can be used to indicate where
         * to continue receiving new doc changes for the query.
         */
        resumeToken, 
        /**
         * The view is responsible for computing the final merged truth of what
         * docs are in the query. It gets notified of local and remote changes,
         * and applies the query filters and limits to determine the most correct
         * possible results.
         */
        view) {
        this.query = query;
        this.targetId = targetId;
        this.resumeToken = resumeToken;
        this.view = view;
    }
    return QueryView;
}());
/**
 * SyncEngine is the central controller in the client SDK architecture. It is
 * the glue code between the EventManager, LocalStore, and RemoteStore. Some of
 * SyncEngine's responsibilities include:
 * 1. Coordinating client requests and remote events between the EventManager
 *    and the local and remote data stores.
 * 2. Managing a View object for each query, providing the unified view between
 *    the local and remote data stores.
 * 3. Notifying the RemoteStore when the LocalStore has new mutations in its
 *    queue that need sending to the backend.
 *
 * The SyncEngine’s methods should only ever be called by methods running in the
 * global async queue.
 */
var SyncEngine = /** @class */ (function () {
    function SyncEngine(localStore, remoteStore, currentUser) {
        this.localStore = localStore;
        this.remoteStore = remoteStore;
        this.currentUser = currentUser;
        this.viewHandler = null;
        this.errorHandler = null;
        this.queryViewsByQuery = new ObjectMap(function (q) {
            return q.canonicalId();
        });
        this.queryViewsByTarget = {};
        this.limboTargetsByKey = new SortedMap(DocumentKey.comparator);
        this.limboKeysByTarget = {};
        this.limboDocumentRefs = new ReferenceSet();
        this.limboCollector = new EagerGarbageCollector();
        /** Stores user completion handlers, indexed by User and BatchId. */
        this.mutationUserCallbacks = {};
        this.targetIdGenerator = TargetIdGenerator.forSyncEngine();
    }
    /** Subscribes view and error handler. Can be called only once. */
    SyncEngine.prototype.subscribe = function (viewHandler, errorHandler) {
        assert(viewHandler !== null && errorHandler !== null, 'View and error handlers cannot be null');
        assert(this.viewHandler === null && this.errorHandler === null, 'SyncEngine already has a subscriber.');
        this.viewHandler = viewHandler;
        this.errorHandler = errorHandler;
        this.limboCollector.addGarbageSource(this.limboDocumentRefs);
    };
    /**
     * Initiates the new listen, resolves promise when listen enqueued to the
     * server. All the subsequent view snapshots or errors are sent to the
     * subscribed handlers. Returns the targetId of the query.
     */
    SyncEngine.prototype.listen = function (query) {
        var _this = this;
        this.assertSubscribed('listen()');
        assert(!this.queryViewsByQuery.has(query), 'We already listen to the query: ' + query);
        return this.localStore.allocateQuery(query).then(function (queryData) {
            return _this.localStore
                .executeQuery(query)
                .then(function (docs) {
                return _this.localStore
                    .remoteDocumentKeys(queryData.targetId)
                    .then(function (remoteKeys) {
                    var view = new View(query, remoteKeys);
                    var viewDocChanges = view.computeDocChanges(docs);
                    var viewChange = view.applyChanges(viewDocChanges);
                    assert(viewChange.limboChanges.length === 0, 'View returned limbo docs before target ack from the server.');
                    assert(!!viewChange.snapshot, 'applyChanges for new view should always return a snapshot');
                    var data = new QueryView(query, queryData.targetId, queryData.resumeToken, view);
                    _this.queryViewsByQuery.set(query, data);
                    _this.queryViewsByTarget[queryData.targetId] = data;
                    _this.viewHandler([viewChange.snapshot]);
                    _this.remoteStore.listen(queryData);
                });
            })
                .then(function () {
                return queryData.targetId;
            });
        });
    };
    /** Stops listening to the query. */
    SyncEngine.prototype.unlisten = function (query) {
        var _this = this;
        this.assertSubscribed('unlisten()');
        var queryView = this.queryViewsByQuery.get(query);
        assert(!!queryView, 'Trying to unlisten on query not found:' + query);
        return this.localStore.releaseQuery(query).then(function () {
            _this.remoteStore.unlisten(queryView.targetId);
            return _this.removeAndCleanupQuery(queryView).then(function () {
                return _this.localStore.collectGarbage();
            });
        });
    };
    /**
     * Initiates the write of local mutation batch which involves adding the
     * writes to the mutation queue, notifying the remote store about new
     * mutations and raising events for any changes this write caused.
     *
     * The promise returned by this call is resolved when the above steps
     * have completed, *not* when the write was acked by the backend. The
     * userCallback is resolved once the write was acked/rejected by the
     * backend (or failed locally for any other reason).
     */
    SyncEngine.prototype.write = function (batch, userCallback) {
        var _this = this;
        this.assertSubscribed('write()');
        return this.localStore
            .localWrite(batch)
            .then(function (result) {
            _this.addMutationCallback(result.batchId, userCallback);
            return _this.emitNewSnapsAndNotifyLocalStore(result.changes);
        })
            .then(function () {
            return _this.remoteStore.fillWritePipeline();
        });
    };
    // TODO(klimt): Wrap the given error in a standard Firestore error object.
    SyncEngine.prototype.wrapUpdateFunctionError = function (error) {
        return error;
    };
    /**
     * Takes an updateFunction in which a set of reads and writes can be performed
     * atomically. In the updateFunction, the client can read and write values
     * using the supplied transaction object. After the updateFunction, all
     * changes will be committed. If some other client has changed any of the data
     * referenced, then the updateFunction will be called again. If the
     * updateFunction still fails after the given number of retries, then the
     * transaction will be rejection.
     *
     * The transaction object passed to the updateFunction contains methods for
     * accessing documents and collections. Unlike other datastore access, data
     * accessed with the transaction will not reflect local changes that have not
     * been committed. For this reason, it is required that all reads are
     * performed before any writes. Transactions must be performed while online.
     *
     * The promise returned is resolved when the transaction is fully committed.
     */
    SyncEngine.prototype.runTransaction = function (updateFunction, retries) {
        var _this = this;
        if (retries === void 0) { retries = 5; }
        assert(retries >= 0, 'Got negative number of retries for transaction.');
        var transaction = this.remoteStore.createTransaction();
        var wrappedUpdateFunction = function () {
            try {
                var userPromise = updateFunction(transaction);
                if (isNullOrUndefined(userPromise) ||
                    !userPromise.catch ||
                    !userPromise.then) {
                    return Promise.reject(Error('Transaction callback must return a Promise'));
                }
                return userPromise.catch(function (e) {
                    return Promise.reject(_this.wrapUpdateFunctionError(e));
                });
            }
            catch (e) {
                return Promise.reject(_this.wrapUpdateFunctionError(e));
            }
        };
        return wrappedUpdateFunction().then(function (result) {
            return transaction
                .commit()
                .then(function () {
                return result;
            })
                .catch(function (error) {
                if (retries === 0) {
                    return Promise.reject(error);
                }
                // TODO(klimt): Put in a retry delay?
                return _this.runTransaction(updateFunction, retries - 1);
            });
        });
    };
    SyncEngine.prototype.applyRemoteEvent = function (remoteEvent) {
        var _this = this;
        this.assertSubscribed('applyRemoteEvent()');
        // Make sure limbo documents are deleted if there were no results
        objUtils.forEachNumber(remoteEvent.targetChanges, function (targetId, targetChange) {
            var limboKey = _this.limboKeysByTarget[targetId];
            if (limboKey &&
                targetChange.currentStatusUpdate ===
                    CurrentStatusUpdate.MarkCurrent &&
                !remoteEvent.documentUpdates.get(limboKey)) {
                // When listening to a query the server responds with a snapshot
                // containing documents matching the query and a current marker
                // telling us we're now in sync. It's possible for these to arrive
                // as separate remote events or as a single remote event.
                // For a document query, there will be no documents sent in the
                // response if the document doesn't exist.
                //
                // If the snapshot arrives separately from the current marker,
                // we handle it normally and updateTrackedLimbos will resolve the
                // limbo status of the document, removing it from limboDocumentRefs.
                // This works because clients only initiate limbo resolution when
                // a target is current and because all current targets are
                // always at a consistent snapshot.
                //
                // However, if the document doesn't exist and the current marker
                // arrives, the document is not present in the snapshot and our
                // normal view handling would consider the document to remain in
                // limbo indefinitely because there are no updates to the document.
                // To avoid this, we specially handle this just this case here:
                // synthesizing a delete.
                //
                // TODO(dimond): Ideally we would have an explicit lookup query
                // instead resulting in an explicit delete message and we could
                // remove this special logic.
                remoteEvent.addDocumentUpdate(new NoDocument(limboKey, remoteEvent.snapshotVersion));
            }
        });
        return this.localStore.applyRemoteEvent(remoteEvent).then(function (changes) {
            return _this.emitNewSnapsAndNotifyLocalStore(changes, remoteEvent);
        });
    };
    SyncEngine.prototype.rejectListen = function (targetId, err) {
        var _this = this;
        this.assertSubscribed('rejectListens()');
        var limboKey = this.limboKeysByTarget[targetId];
        if (limboKey) {
            // Since this query failed, we won't want to manually unlisten to it.
            // So go ahead and remove it from bookkeeping.
            this.limboTargetsByKey = this.limboTargetsByKey.remove(limboKey);
            delete this.limboKeysByTarget[targetId];
            // TODO(klimt): We really only should do the following on permission
            // denied errors, but we don't have the cause code here.
            // It's a limbo doc. Create a synthetic event saying it was deleted.
            // This is kind of a hack. Ideally, we would have a method in the local
            // store to purge a document. However, it would be tricky to keep all of
            // the local store's invariants with another method.
            var docMap = new SortedMap(DocumentKey.comparator);
            docMap = docMap.insert(limboKey, new NoDocument(limboKey, SnapshotVersion.forDeletedDoc()));
            var event_1 = new RemoteEvent(SnapshotVersion.MIN, {}, docMap);
            return this.applyRemoteEvent(event_1);
        }
        else {
            var queryView_1 = this.queryViewsByTarget[targetId];
            assert(!!queryView_1, 'Unknown targetId: ' + targetId);
            return this.localStore.releaseQuery(queryView_1.query).then(function () {
                return _this.removeAndCleanupQuery(queryView_1).then(function () {
                    _this.errorHandler(queryView_1.query, err);
                });
            });
        }
    };
    SyncEngine.prototype.applySuccessfulWrite = function (mutationBatchResult) {
        var _this = this;
        this.assertSubscribed('applySuccessfulWrite()');
        // The local store may or may not be able to apply the write result and
        // raise events immediately (depending on whether the watcher is caught
        // up), so we raise user callbacks first so that they consistently happen
        // before listen events.
        this.processUserCallback(mutationBatchResult.batch.batchId, 
        /*error=*/ null);
        return this.localStore
            .acknowledgeBatch(mutationBatchResult)
            .then(function (changes) {
            return _this.emitNewSnapsAndNotifyLocalStore(changes);
        });
    };
    SyncEngine.prototype.rejectFailedWrite = function (batchId, error) {
        var _this = this;
        this.assertSubscribed('rejectFailedWrite()');
        // The local store may or may not be able to apply the write result and
        // raise events immediately (depending on whether the watcher is caught up),
        // so we raise user callbacks first so that they consistently happen before
        // listen events.
        this.processUserCallback(batchId, error);
        return this.localStore.rejectBatch(batchId).then(function (changes) {
            return _this.emitNewSnapsAndNotifyLocalStore(changes);
        });
    };
    SyncEngine.prototype.addMutationCallback = function (batchId, callback) {
        var newCallbacks = this.mutationUserCallbacks[this.currentUser.toKey()];
        if (!newCallbacks) {
            newCallbacks = new SortedMap(primitiveComparator);
        }
        newCallbacks = newCallbacks.insert(batchId, callback);
        this.mutationUserCallbacks[this.currentUser.toKey()] = newCallbacks;
    };
    /**
     * Resolves or rejects the user callback for the given batch and then discards
     * it.
     */
    SyncEngine.prototype.processUserCallback = function (batchId, error) {
        var newCallbacks = this.mutationUserCallbacks[this.currentUser.toKey()];
        // NOTE: Mutations restored from persistence won't have callbacks, so it's
        // okay for there to be no callback for this ID.
        if (newCallbacks) {
            var callback = newCallbacks.get(batchId);
            if (callback) {
                assert(batchId === newCallbacks.minKey(), 'Mutation callbacks processed out-of-order?');
                if (error) {
                    callback.reject(error);
                }
                else {
                    callback.resolve();
                }
                newCallbacks = newCallbacks.remove(batchId);
            }
            this.mutationUserCallbacks[this.currentUser.toKey()] = newCallbacks;
        }
    };
    SyncEngine.prototype.removeAndCleanupQuery = function (queryView) {
        this.queryViewsByQuery.delete(queryView.query);
        delete this.queryViewsByTarget[queryView.targetId];
        this.limboDocumentRefs.removeReferencesForId(queryView.targetId);
        return this.gcLimboDocuments();
    };
    SyncEngine.prototype.updateTrackedLimbos = function (targetId, limboChanges) {
        for (var _i = 0, limboChanges_1 = limboChanges; _i < limboChanges_1.length; _i++) {
            var limboChange = limboChanges_1[_i];
            if (limboChange instanceof AddedLimboDocument) {
                this.limboDocumentRefs.addReference(limboChange.key, targetId);
                this.trackLimboChange(limboChange);
            }
            else if (limboChange instanceof RemovedLimboDocument) {
                log.debug(LOG_TAG, 'Document no longer in limbo: ' + limboChange.key);
                this.limboDocumentRefs.removeReference(limboChange.key, targetId);
            }
            else {
                fail('Unknown limbo change: ' + JSON.stringify(limboChange));
            }
        }
        return this.gcLimboDocuments();
    };
    SyncEngine.prototype.trackLimboChange = function (limboChange) {
        var key = limboChange.key;
        if (!this.limboTargetsByKey.get(key)) {
            log.debug(LOG_TAG, 'New document in limbo: ' + key);
            var limboTargetId = this.targetIdGenerator.next();
            var query = Query.atPath(key.path);
            this.limboKeysByTarget[limboTargetId] = key;
            this.remoteStore.listen(new QueryData(query, limboTargetId, QueryPurpose.Listen));
            this.limboTargetsByKey = this.limboTargetsByKey.insert(key, limboTargetId);
        }
    };
    SyncEngine.prototype.gcLimboDocuments = function () {
        var _this = this;
        // HACK: We can use a null transaction here, because we know that the
        // reference set is entirely within memory and doesn't need a store engine.
        return this.limboCollector
            .collectGarbage(null)
            .next(function (keys) {
            keys.forEach(function (key) {
                var limboTargetId = _this.limboTargetsByKey.get(key);
                if (limboTargetId === null) {
                    // This target already got removed, because the query failed.
                    return;
                }
                _this.remoteStore.unlisten(limboTargetId);
                _this.limboTargetsByKey = _this.limboTargetsByKey.remove(key);
                delete _this.limboKeysByTarget[limboTargetId];
            });
        })
            .toPromise();
    };
    // Visible for testing
    SyncEngine.prototype.currentLimboDocs = function () {
        return this.limboTargetsByKey;
    };
    SyncEngine.prototype.emitNewSnapsAndNotifyLocalStore = function (changes, remoteEvent) {
        var _this = this;
        var newSnaps = [];
        var docChangesInAllViews = [];
        var queriesProcessed = [];
        this.queryViewsByQuery.forEach(function (_, queryView) {
            queriesProcessed.push(Promise.resolve()
                .then(function () {
                var viewDocChanges = queryView.view.computeDocChanges(changes);
                if (!viewDocChanges.needsRefill) {
                    return viewDocChanges;
                }
                // The query has a limit and some docs were removed, so we need
                // to re-run the query against the local store to make sure we
                // didn't lose any good docs that had been past the limit.
                return _this.localStore.executeQuery(queryView.query).then(function (docs) {
                    return queryView.view.computeDocChanges(docs, viewDocChanges);
                });
            })
                .then(function (viewDocChanges) {
                var targetChange = remoteEvent && remoteEvent.targetChanges[queryView.targetId];
                var viewChange = queryView.view.applyChanges(viewDocChanges, targetChange);
                return _this.updateTrackedLimbos(queryView.targetId, viewChange.limboChanges).then(function () {
                    if (viewChange.snapshot) {
                        newSnaps.push(viewChange.snapshot);
                        var docChanges = LocalViewChanges.fromSnapshot(viewChange.snapshot);
                        docChangesInAllViews.push(docChanges);
                    }
                });
            }));
        });
        return Promise.all(queriesProcessed)
            .then(function () {
            _this.viewHandler(newSnaps);
            return _this.localStore.notifyLocalViewChanges(docChangesInAllViews);
        })
            .then(function () {
            return _this.localStore.collectGarbage();
        });
    };
    SyncEngine.prototype.assertSubscribed = function (fnName) {
        assert(this.viewHandler !== null && this.errorHandler !== null, 'Trying to call ' + fnName + ' before calling subscribe().');
    };
    SyncEngine.prototype.handleUserChange = function (user) {
        var _this = this;
        this.currentUser = user;
        return this.localStore
            .handleUserChange(user)
            .then(function (changes) {
            return _this.emitNewSnapsAndNotifyLocalStore(changes);
        })
            .then(function () {
            return _this.remoteStore.handleUserChange(user);
        });
    };
    return SyncEngine;
}());
export { SyncEngine };

//# sourceMappingURL=sync_engine.js.map
