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
var types_1 = require("./types");
var view_snapshot_1 = require("./view_snapshot");
var document_set_1 = require("../model/document_set");
var assert_1 = require("../util/assert");
var obj_map_1 = require("../util/obj_map");
/**
 * Holds the listeners and the last received ViewSnapshot for a query being
 * tracked by EventManager.
 */
var QueryListenersInfo = /** @class */ (function () {
    function QueryListenersInfo() {
        this.listeners = [];
    }
    return QueryListenersInfo;
}());
/**
 * EventManager is responsible for mapping queries to query event emitters.
 * It handles "fan-out". -- Identical queries will re-use the same watch on the
 * backend.
 */
var EventManager = /** @class */ (function () {
    function EventManager(syncEngine) {
        this.syncEngine = syncEngine;
        this.queries = new obj_map_1.ObjectMap(function (q) {
            return q.canonicalId();
        });
        this.onlineState = types_1.OnlineState.Unknown;
        this.syncEngine.subscribe(this.onChange.bind(this), this.onError.bind(this));
    }
    EventManager.prototype.listen = function (listener) {
        var query = listener.query;
        var firstListen = false;
        var queryInfo = this.queries.get(query);
        if (!queryInfo) {
            firstListen = true;
            queryInfo = new QueryListenersInfo();
            this.queries.set(query, queryInfo);
        }
        queryInfo.listeners.push(listener);
        listener.onOnlineStateChanged(this.onlineState);
        if (queryInfo.viewSnap)
            listener.onViewSnapshot(queryInfo.viewSnap);
        if (firstListen) {
            return this.syncEngine.listen(query).then(function (targetId) {
                queryInfo.targetId = targetId;
                return targetId;
            });
        }
        else {
            return Promise.resolve(queryInfo.targetId);
        }
    };
    EventManager.prototype.unlisten = function (listener) {
        var query = listener.query;
        var lastListen = false;
        var queryInfo = this.queries.get(query);
        if (queryInfo) {
            var i = queryInfo.listeners.indexOf(listener);
            if (i >= 0) {
                queryInfo.listeners.splice(i, 1);
                lastListen = queryInfo.listeners.length === 0;
            }
        }
        if (lastListen) {
            this.queries.delete(query);
            return this.syncEngine.unlisten(query);
        }
        else {
            return Promise.resolve();
        }
    };
    EventManager.prototype.onChange = function (viewSnaps) {
        for (var _i = 0, viewSnaps_1 = viewSnaps; _i < viewSnaps_1.length; _i++) {
            var viewSnap = viewSnaps_1[_i];
            var query = viewSnap.query;
            var queryInfo = this.queries.get(query);
            if (queryInfo) {
                for (var _a = 0, _b = queryInfo.listeners; _a < _b.length; _a++) {
                    var listener = _b[_a];
                    listener.onViewSnapshot(viewSnap);
                }
                queryInfo.viewSnap = viewSnap;
            }
        }
    };
    EventManager.prototype.onError = function (query, error) {
        var queryInfo = this.queries.get(query);
        if (queryInfo) {
            for (var _i = 0, _a = queryInfo.listeners; _i < _a.length; _i++) {
                var listener = _a[_i];
                listener.onError(error);
            }
        }
        // Remove all listeners. NOTE: We don't need to call syncEngine.unlisten()
        // after an error.
        this.queries.delete(query);
    };
    EventManager.prototype.onOnlineStateChanged = function (onlineState) {
        this.onlineState = onlineState;
        this.queries.forEach(function (_, queryInfo) {
            for (var _i = 0, _a = queryInfo.listeners; _i < _a.length; _i++) {
                var listener = _a[_i];
                listener.onOnlineStateChanged(onlineState);
            }
        });
    };
    return EventManager;
}());
exports.EventManager = EventManager;
/**
 * QueryListener takes a series of internal view snapshots and determines
 * when to raise the event.
 *
 * It uses an Observer to dispatch events.
 */
var QueryListener = /** @class */ (function () {
    function QueryListener(query, queryObserver, options) {
        this.query = query;
        this.queryObserver = queryObserver;
        /**
         * Initial snapshots (e.g. from cache) may not be propagated to the wrapped
         * observer. This flag is set to true once we've actually raised an event.
         */
        this.raisedInitialEvent = false;
        this.onlineState = types_1.OnlineState.Unknown;
        this.options = options || {};
    }
    QueryListener.prototype.onViewSnapshot = function (snap) {
        assert_1.assert(snap.docChanges.length > 0 || snap.syncStateChanged, 'We got a new snapshot with no changes?');
        if (!this.options.includeDocumentMetadataChanges) {
            // Remove the metadata only changes.
            var docChanges = [];
            for (var _i = 0, _a = snap.docChanges; _i < _a.length; _i++) {
                var docChange = _a[_i];
                if (docChange.type !== view_snapshot_1.ChangeType.Metadata) {
                    docChanges.push(docChange);
                }
            }
            snap = {
                query: snap.query,
                docs: snap.docs,
                oldDocs: snap.oldDocs,
                docChanges: docChanges,
                fromCache: snap.fromCache,
                hasPendingWrites: snap.hasPendingWrites,
                syncStateChanged: snap.syncStateChanged
            };
        }
        if (!this.raisedInitialEvent) {
            if (this.shouldRaiseInitialEvent(snap, this.onlineState)) {
                this.raiseInitialEvent(snap);
            }
        }
        else if (this.shouldRaiseEvent(snap)) {
            this.queryObserver.next(snap);
        }
        this.snap = snap;
    };
    QueryListener.prototype.onError = function (error) {
        this.queryObserver.error(error);
    };
    QueryListener.prototype.onOnlineStateChanged = function (onlineState) {
        this.onlineState = onlineState;
        if (this.snap &&
            !this.raisedInitialEvent &&
            this.shouldRaiseInitialEvent(this.snap, onlineState)) {
            this.raiseInitialEvent(this.snap);
        }
    };
    QueryListener.prototype.shouldRaiseInitialEvent = function (snap, onlineState) {
        assert_1.assert(!this.raisedInitialEvent, 'Determining whether to raise first event but already had first event');
        // Always raise the first event when we're synced
        if (!snap.fromCache) {
            return true;
        }
        // NOTE: We consider OnlineState.Unknown as online (it should become Failed
        // or Online if we wait long enough).
        var maybeOnline = onlineState !== types_1.OnlineState.Failed;
        // Don't raise the event if we're online, aren't synced yet (checked
        // above) and are waiting for a sync.
        if (this.options.waitForSyncWhenOnline && maybeOnline) {
            assert_1.assert(snap.fromCache, 'Waiting for sync, but snapshot is not from cache');
            return false;
        }
        // Raise data from cache if we have any documents or we are offline
        return !snap.docs.isEmpty() || onlineState === types_1.OnlineState.Failed;
    };
    QueryListener.prototype.shouldRaiseEvent = function (snap) {
        // We don't need to handle includeDocumentMetadataChanges here because
        // the Metadata only changes have already been stripped out if needed.
        // At this point the only changes we will see are the ones we should
        // propagate.
        if (snap.docChanges.length > 0) {
            return true;
        }
        var hasPendingWritesChanged = this.snap && this.snap.hasPendingWrites !== snap.hasPendingWrites;
        if (snap.syncStateChanged || hasPendingWritesChanged) {
            return this.options.includeQueryMetadataChanges === true;
        }
        // Generally we should have hit one of the cases above, but it's possible
        // to get here if there were only metadata docChanges and they got
        // stripped out.
        return false;
    };
    QueryListener.prototype.raiseInitialEvent = function (snap) {
        assert_1.assert(!this.raisedInitialEvent, 'Trying to raise initial events for second time');
        snap = {
            query: snap.query,
            docs: snap.docs,
            oldDocs: document_set_1.DocumentSet.emptySet(snap.docs),
            docChanges: QueryListener.getInitialViewChanges(snap),
            fromCache: snap.fromCache,
            hasPendingWrites: snap.hasPendingWrites,
            syncStateChanged: true
        };
        this.raisedInitialEvent = true;
        this.queryObserver.next(snap);
    };
    /** Returns changes as if all documents in the snap were added. */
    QueryListener.getInitialViewChanges = function (snap) {
        var result = [];
        snap.docs.forEach(function (doc) {
            result.push({ type: view_snapshot_1.ChangeType.Added, doc: doc });
        });
        return result;
    };
    return QueryListener;
}());
exports.QueryListener = QueryListener;

//# sourceMappingURL=event_manager.js.map
