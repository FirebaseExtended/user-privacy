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
var collections_1 = require("../model/collections");
var document_1 = require("../model/document");
var document_set_1 = require("../model/document_set");
var remote_event_1 = require("../remote/remote_event");
var assert_1 = require("../util/assert");
var view_snapshot_1 = require("./view_snapshot");
var AddedLimboDocument = /** @class */ (function () {
    function AddedLimboDocument(key) {
        this.key = key;
    }
    return AddedLimboDocument;
}());
exports.AddedLimboDocument = AddedLimboDocument;
var RemovedLimboDocument = /** @class */ (function () {
    function RemovedLimboDocument(key) {
        this.key = key;
    }
    return RemovedLimboDocument;
}());
exports.RemovedLimboDocument = RemovedLimboDocument;
/**
 * View is responsible for computing the final merged truth of what docs are in
 * a query. It gets notified of local and remote changes to docs, and applies
 * the query filters and limits to determine the most correct possible results.
 */
var View = /** @class */ (function () {
    function View(query, 
        /** Documents included in the remote target */
        syncedDocuments) {
        this.query = query;
        this.syncedDocuments = syncedDocuments;
        this.syncState = null;
        /**
         * A flag whether the view is current with the backend. A view is considered
         * current after it has seen the current flag from the backend and did not
         * lose consistency within the watch stream (e.g. because of an existence
         * filter mismatch).
         */
        this.current = false;
        /** Documents in the view but not in the remote target */
        this.limboDocuments = collections_1.documentKeySet();
        /** Document Keys that have local changes */
        this.mutatedKeys = collections_1.documentKeySet();
        this.documentSet = new document_set_1.DocumentSet(query.docComparator.bind(query));
    }
    /**
     * Iterates over a set of doc changes, applies the query limit, and computes
     * what the new results should be, what the changes were, and whether we may
     * need to go back to the local cache for more results. Does not make any
     * changes to the view.
     * @param docChanges The doc changes to apply to this view.
     * @param previousChanges If this is being called with a refill, then start
     *        with this set of docs and changes instead of the current view.
     * @return a new set of docs, changes, and refill flag.
     */
    View.prototype.computeDocChanges = function (docChanges, previousChanges) {
        var _this = this;
        var changeSet = previousChanges
            ? previousChanges.changeSet
            : new view_snapshot_1.DocumentChangeSet();
        var oldDocumentSet = previousChanges
            ? previousChanges.documentSet
            : this.documentSet;
        var newMutatedKeys = previousChanges
            ? previousChanges.mutatedKeys
            : this.mutatedKeys;
        var newDocumentSet = oldDocumentSet;
        var needsRefill = false;
        // Track the last doc in a (full) limit. This is necessary, because some
        // update (a delete, or an update moving a doc past the old limit) might
        // mean there is some other document in the local cache that either should
        // come (1) between the old last limit doc and the new last document, in the
        // case of updates, or (2) after the new last document, in the case of
        // deletes. So we keep this doc at the old limit to compare the updates to.
        //
        // Note that this should never get used in a refill (when previousChanges is
        // set), because there will only be adds -- no deletes or updates.
        var lastDocInLimit = this.query.hasLimit() && oldDocumentSet.size === this.query.limit
            ? oldDocumentSet.last()
            : null;
        docChanges.inorderTraversal(function (key, newMaybeDoc) {
            var oldDoc = oldDocumentSet.get(key);
            var newDoc = newMaybeDoc instanceof document_1.Document ? newMaybeDoc : null;
            if (newDoc) {
                assert_1.assert(key.equals(newDoc.key), 'Mismatching keys found in document changes: ' +
                    key +
                    ' != ' +
                    newDoc.key);
                newDoc = _this.query.matches(newDoc) ? newDoc : null;
            }
            if (newDoc) {
                newDocumentSet = newDocumentSet.add(newDoc);
                if (newDoc.hasLocalMutations) {
                    newMutatedKeys = newMutatedKeys.add(key);
                }
                else {
                    newMutatedKeys = newMutatedKeys.delete(key);
                }
            }
            else {
                newDocumentSet = newDocumentSet.delete(key);
                newMutatedKeys = newMutatedKeys.delete(key);
            }
            // Calculate change
            if (oldDoc && newDoc) {
                var docsEqual = oldDoc.data.equals(newDoc.data);
                if (!docsEqual ||
                    oldDoc.hasLocalMutations !== newDoc.hasLocalMutations) {
                    // only report a change if document actually changed
                    if (docsEqual) {
                        changeSet.track({ type: view_snapshot_1.ChangeType.Metadata, doc: newDoc });
                    }
                    else {
                        changeSet.track({ type: view_snapshot_1.ChangeType.Modified, doc: newDoc });
                    }
                    if (lastDocInLimit &&
                        _this.query.docComparator(newDoc, lastDocInLimit) > 0) {
                        // This doc moved from inside the limit to after the limit.
                        // That means there may be some doc in the local cache that's
                        // actually less than this one.
                        needsRefill = true;
                    }
                }
            }
            else if (!oldDoc && newDoc) {
                changeSet.track({ type: view_snapshot_1.ChangeType.Added, doc: newDoc });
            }
            else if (oldDoc && !newDoc) {
                changeSet.track({ type: view_snapshot_1.ChangeType.Removed, doc: oldDoc });
                if (lastDocInLimit) {
                    // A doc was removed from a full limit query. We'll need to
                    // requery from the local cache to see if we know about some other
                    // doc that should be in the results.
                    needsRefill = true;
                }
            }
        });
        if (this.query.hasLimit()) {
            // TODO(klimt): Make DocumentSet size be constant time.
            while (newDocumentSet.size > this.query.limit) {
                var oldDoc = newDocumentSet.last();
                newDocumentSet = newDocumentSet.delete(oldDoc.key);
                changeSet.track({ type: view_snapshot_1.ChangeType.Removed, doc: oldDoc });
            }
        }
        assert_1.assert(!needsRefill || !previousChanges, 'View was refilled using docs that themselves needed refilling.');
        return {
            documentSet: newDocumentSet,
            changeSet: changeSet,
            needsRefill: needsRefill,
            mutatedKeys: newMutatedKeys
        };
    };
    /**
     * Updates the view with the given ViewDocumentChanges and updates limbo docs
     * and sync state from the given (optional) target change.
     * @param docChanges The set of changes to make to the view's docs.
     * @param targetChange A target change to apply for computing limbo docs and
     *        sync state.
     * @return A new ViewChange with the given docs, changes, and sync state.
     */
    View.prototype.applyChanges = function (docChanges, targetChange) {
        var _this = this;
        assert_1.assert(!docChanges.needsRefill, 'Cannot apply changes that need a refill');
        var oldDocs = this.documentSet;
        this.documentSet = docChanges.documentSet;
        this.mutatedKeys = docChanges.mutatedKeys;
        // Sort changes based on type and query comparator
        var changes = docChanges.changeSet.getChanges();
        changes.sort(function (c1, c2) {
            return (compareChangeType(c1.type, c2.type) ||
                _this.query.docComparator(c1.doc, c2.doc));
        });
        var limboChanges = this.applyTargetChange(targetChange);
        var synced = this.limboDocuments.size === 0 && this.current;
        var newSyncState = synced ? view_snapshot_1.SyncState.Synced : view_snapshot_1.SyncState.Local;
        var syncStateChanged = newSyncState !== this.syncState;
        this.syncState = newSyncState;
        if (changes.length === 0 && !syncStateChanged) {
            // no changes
            return { limboChanges: limboChanges };
        }
        else {
            return {
                snapshot: {
                    query: this.query,
                    docs: docChanges.documentSet,
                    oldDocs: oldDocs,
                    docChanges: changes,
                    fromCache: newSyncState === view_snapshot_1.SyncState.Local,
                    syncStateChanged: syncStateChanged,
                    hasPendingWrites: !docChanges.mutatedKeys.isEmpty()
                },
                limboChanges: limboChanges
            };
        }
    };
    /**
     * Returns whether the doc for the given key should be in limbo.
     */
    View.prototype.shouldBeInLimbo = function (key) {
        // If the remote end says it's part of this query, it's not in limbo.
        if (this.syncedDocuments.has(key)) {
            return false;
        }
        // The local store doesn't think it's a result, so it shouldn't be in limbo.
        if (!this.documentSet.has(key)) {
            return false;
        }
        // If there are local changes to the doc, they might explain why the server
        // doesn't know that it's part of the query. So don't put it in limbo.
        // TODO(klimt): Ideally, we would only consider changes that might actually
        // affect this specific query.
        if (this.documentSet.get(key).hasLocalMutations) {
            return false;
        }
        // Everything else is in limbo.
        return true;
    };
    /**
     * Updates syncedDocuments, current, and limbo docs based on the given change.
     * Returns the list of changes to which docs are in limbo.
     */
    View.prototype.applyTargetChange = function (targetChange) {
        var _this = this;
        if (targetChange) {
            var targetMapping = targetChange.mapping;
            if (targetMapping instanceof remote_event_1.ResetMapping) {
                this.syncedDocuments = targetMapping.documents;
            }
            else if (targetMapping instanceof remote_event_1.UpdateMapping) {
                this.syncedDocuments = targetMapping.applyToKeySet(this.syncedDocuments);
            }
            switch (targetChange.currentStatusUpdate) {
                case remote_event_1.CurrentStatusUpdate.MarkCurrent:
                    this.current = true;
                    break;
                case remote_event_1.CurrentStatusUpdate.MarkNotCurrent:
                    this.current = false;
                    break;
                case remote_event_1.CurrentStatusUpdate.None:
                    break;
                default:
                    assert_1.fail('Unknown current status update: ' + targetChange.currentStatusUpdate);
            }
        }
        // Recompute the set of limbo docs.
        // TODO(klimt): Do this incrementally so that it's not quadratic when
        // updating many documents.
        var oldLimboDocuments = this.limboDocuments;
        this.limboDocuments = collections_1.documentKeySet();
        if (this.current) {
            this.documentSet.forEach(function (doc) {
                if (_this.shouldBeInLimbo(doc.key)) {
                    _this.limboDocuments = _this.limboDocuments.add(doc.key);
                }
            });
        }
        // Diff the new limbo docs with the old limbo docs.
        var changes = [];
        oldLimboDocuments.forEach(function (key) {
            if (!_this.limboDocuments.has(key)) {
                changes.push(new RemovedLimboDocument(key));
            }
        });
        this.limboDocuments.forEach(function (key) {
            if (!oldLimboDocuments.has(key)) {
                changes.push(new AddedLimboDocument(key));
            }
        });
        return changes;
    };
    return View;
}());
exports.View = View;
function compareChangeType(c1, c2) {
    var order = function (change) {
        switch (change) {
            case view_snapshot_1.ChangeType.Added:
                return 1;
            case view_snapshot_1.ChangeType.Modified:
                return 2;
            case view_snapshot_1.ChangeType.Metadata:
                // A metadata change is converted to a modified change at the public
                // api layer.  Since we sort by document key and then change type,
                // metadata and modified changes must be sorted equivalently.
                return 2;
            case view_snapshot_1.ChangeType.Removed:
                return 0;
            default:
                return assert_1.fail('Unknown ChangeType: ' + change);
        }
    };
    return order(c1) - order(c2);
}

//# sourceMappingURL=view.js.map
