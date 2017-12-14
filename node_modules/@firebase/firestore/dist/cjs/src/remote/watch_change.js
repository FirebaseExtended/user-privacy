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
var platform_1 = require("../platform/platform");
var assert_1 = require("../util/assert");
var objUtils = require("../util/obj");
var remote_event_1 = require("./remote_event");
/**
 * Represents a changed document and a list of target ids to which this change
 * applies.
 *
 * If document has been deleted NoDocument will be provided.
 */
var DocumentWatchChange = /** @class */ (function () {
    function DocumentWatchChange(
        /** The new document applies to all of these targets. */
        updatedTargetIds, 
        /** The new document is removed from all of these targets. */
        removedTargetIds, 
        /** The key of the document for this change. */
        key, 
        /**
         * The new document or NoDocument if it was deleted. Is null if the
         * document went out of view without the server sending a new document.
         */
        newDoc) {
        this.updatedTargetIds = updatedTargetIds;
        this.removedTargetIds = removedTargetIds;
        this.key = key;
        this.newDoc = newDoc;
    }
    return DocumentWatchChange;
}());
exports.DocumentWatchChange = DocumentWatchChange;
var ExistenceFilterChange = /** @class */ (function () {
    function ExistenceFilterChange(targetId, existenceFilter) {
        this.targetId = targetId;
        this.existenceFilter = existenceFilter;
    }
    return ExistenceFilterChange;
}());
exports.ExistenceFilterChange = ExistenceFilterChange;
var WatchTargetChangeState;
(function (WatchTargetChangeState) {
    WatchTargetChangeState[WatchTargetChangeState["NoChange"] = 0] = "NoChange";
    WatchTargetChangeState[WatchTargetChangeState["Added"] = 1] = "Added";
    WatchTargetChangeState[WatchTargetChangeState["Removed"] = 2] = "Removed";
    WatchTargetChangeState[WatchTargetChangeState["Current"] = 3] = "Current";
    WatchTargetChangeState[WatchTargetChangeState["Reset"] = 4] = "Reset";
})(WatchTargetChangeState = exports.WatchTargetChangeState || (exports.WatchTargetChangeState = {}));
var WatchTargetChange = /** @class */ (function () {
    function WatchTargetChange(
        /** What kind of change occurred to the watch target. */
        state, 
        /** The target IDs that were added/removed/set. */
        targetIds, 
        /**
         * An opaque, server-assigned token that allows watching a query to be
         * resumed after disconnecting without retransmitting all the data that
         * matches the query. The resume token essentially identifies a point in
         * time from which the server should resume sending results.
         */
        resumeToken, 
        /** An RPC error indicating why the watch failed. */
        cause) {
        if (resumeToken === void 0) { resumeToken = platform_1.emptyByteString(); }
        if (cause === void 0) { cause = null; }
        this.state = state;
        this.targetIds = targetIds;
        this.resumeToken = resumeToken;
        this.cause = cause;
    }
    return WatchTargetChange;
}());
exports.WatchTargetChange = WatchTargetChange;
/**
 * A helper class to accumulate watch changes into a RemoteEvent and other
 * target information.
 */
var WatchChangeAggregator = /** @class */ (function () {
    function WatchChangeAggregator(snapshotVersion, listenTargets, pendingTargetResponses) {
        this.snapshotVersion = snapshotVersion;
        this.listenTargets = listenTargets;
        /** The existence filter - if any - for the given target IDs. */
        this.existenceFilters = {};
        /** Keeps track of the current target mappings */
        this.targetChanges = {};
        /** Keeps track of document to update */
        this.documentUpdates = collections_1.maybeDocumentMap();
        /** Whether this aggregator was frozen and can no longer be modified */
        this.frozen = false;
        this.pendingTargetResponses = objUtils.shallowCopy(pendingTargetResponses);
    }
    /** Aggregates a watch change into the current state */
    WatchChangeAggregator.prototype.add = function (watchChange) {
        assert_1.assert(!this.frozen, 'Trying to modify frozen WatchChangeAggregator.');
        if (watchChange instanceof DocumentWatchChange) {
            this.addDocumentChange(watchChange);
        }
        else if (watchChange instanceof WatchTargetChange) {
            this.addTargetChange(watchChange);
        }
        else if (watchChange instanceof ExistenceFilterChange) {
            this.addExistenceFilterChange(watchChange);
        }
        else {
            assert_1.fail('Unknown watch change: ' + watchChange);
        }
    };
    /** Aggregates all provided watch changes to the current state in order */
    WatchChangeAggregator.prototype.addChanges = function (watchChanges) {
        var _this = this;
        assert_1.assert(!this.frozen, 'Trying to modify frozen WatchChangeAggregator.');
        watchChanges.forEach(function (change) { return _this.add(change); });
    };
    /**
     * Converts the current state into a remote event with the snapshot version
     * provided via the constructor.
     */
    WatchChangeAggregator.prototype.createRemoteEvent = function () {
        var _this = this;
        var targetChanges = this.targetChanges;
        // Remove all the non-active targets from the remote event.
        objUtils.forEachNumber(this.targetChanges, function (targetId) {
            if (!_this.isActiveTarget(targetId)) {
                delete targetChanges[targetId];
            }
        });
        // Mark this aggregator as frozen so no further modifications are made
        this.frozen = true;
        return new remote_event_1.RemoteEvent(this.snapshotVersion, targetChanges, this.documentUpdates);
    };
    WatchChangeAggregator.prototype.ensureTargetChange = function (targetId) {
        var change = this.targetChanges[targetId];
        if (!change) {
            // Create an UpdateMapping by default, since resets are always explicit.
            change = {
                currentStatusUpdate: remote_event_1.CurrentStatusUpdate.None,
                snapshotVersion: this.snapshotVersion,
                mapping: new remote_event_1.UpdateMapping(),
                resumeToken: platform_1.emptyByteString()
            };
            this.targetChanges[targetId] = change;
        }
        return change;
    };
    /**
     * We need to wait for watch to ack targets before we process those events,
     * so to know if a target is active, there must be no pending acks we're
     * waiting for and it must be in the current list of targets that the client
     * cares about.
     *
     * This method is visible for testing.
     */
    WatchChangeAggregator.prototype.isActiveTarget = function (targetId) {
        return (!objUtils.contains(this.pendingTargetResponses, targetId) &&
            objUtils.contains(this.listenTargets, targetId));
    };
    WatchChangeAggregator.prototype.addDocumentChange = function (docChange) {
        var relevant = false;
        for (var _i = 0, _a = docChange.updatedTargetIds; _i < _a.length; _i++) {
            var targetId = _a[_i];
            if (this.isActiveTarget(targetId)) {
                var change = this.ensureTargetChange(targetId);
                change.mapping.add(docChange.key);
                relevant = true;
            }
        }
        for (var _b = 0, _c = docChange.removedTargetIds; _b < _c.length; _b++) {
            var targetId = _c[_b];
            if (this.isActiveTarget(targetId)) {
                var change = this.ensureTargetChange(targetId);
                change.mapping.delete(docChange.key);
                relevant = true;
            }
        }
        // Only update the document if there is a new document to replace to an
        // active target that is being listened to, this might be just a target
        // update instead.
        if (docChange.newDoc && relevant) {
            this.documentUpdates = this.documentUpdates.insert(docChange.key, docChange.newDoc);
        }
    };
    WatchChangeAggregator.prototype.addTargetChange = function (targetChange) {
        var _this = this;
        targetChange.targetIds.forEach(function (targetId) {
            var change = _this.ensureTargetChange(targetId);
            switch (targetChange.state) {
                case WatchTargetChangeState.NoChange:
                    if (_this.isActiveTarget(targetId)) {
                        // Creating the change above satisfies the semantics of no-change.
                        applyResumeToken(change, targetChange.resumeToken);
                    }
                    break;
                case WatchTargetChangeState.Added:
                    // We need to decrement the number of pending acks needed from watch
                    // for this targetId.
                    _this.recordTargetResponse(targetId);
                    if (!objUtils.contains(_this.pendingTargetResponses, targetId)) {
                        // We have a freshly added target, so we need to reset any state
                        // that we had previously This can happen e.g. when remove and add
                        // back a target for existence filter mismatches.
                        change.mapping = new remote_event_1.UpdateMapping();
                        change.currentStatusUpdate = remote_event_1.CurrentStatusUpdate.None;
                        delete _this.existenceFilters[targetId];
                    }
                    applyResumeToken(change, targetChange.resumeToken);
                    break;
                case WatchTargetChangeState.Removed:
                    // We need to keep track of removed targets to we can
                    // post-filter and remove any target changes.
                    // We need to decrement the number of pending acks needed from watch
                    // for this targetId.
                    _this.recordTargetResponse(targetId);
                    assert_1.assert(!targetChange.cause, 'WatchChangeAggregator does not handle errored targets');
                    break;
                case WatchTargetChangeState.Current:
                    if (_this.isActiveTarget(targetId)) {
                        change.currentStatusUpdate = remote_event_1.CurrentStatusUpdate.MarkCurrent;
                        applyResumeToken(change, targetChange.resumeToken);
                    }
                    break;
                case WatchTargetChangeState.Reset:
                    if (_this.isActiveTarget(targetId)) {
                        // Overwrite any existing target mapping with a reset
                        // mapping. Every subsequent update will modify the reset
                        // mapping, not an update mapping.
                        change.mapping = new remote_event_1.ResetMapping();
                        applyResumeToken(change, targetChange.resumeToken);
                    }
                    break;
                default:
                    assert_1.fail('Unknown target watch change state: ' + targetChange.state);
            }
        });
    };
    /**
     * Record that we get a watch target add/remove by decrementing the number of
     * pending target responses that we have.
     */
    WatchChangeAggregator.prototype.recordTargetResponse = function (targetId) {
        var newCount = (this.pendingTargetResponses[targetId] || 0) - 1;
        if (newCount === 0) {
            delete this.pendingTargetResponses[targetId];
        }
        else {
            this.pendingTargetResponses[targetId] = newCount;
        }
    };
    WatchChangeAggregator.prototype.addExistenceFilterChange = function (change) {
        if (this.isActiveTarget(change.targetId)) {
            this.existenceFilters[change.targetId] = change.existenceFilter;
        }
    };
    return WatchChangeAggregator;
}());
exports.WatchChangeAggregator = WatchChangeAggregator;
/**
 * Applies the resume token to the TargetChange, but only when it has a new
 * value. null and empty resumeTokens are discarded.
 */
function applyResumeToken(change, resumeToken) {
    if (resumeToken.length > 0) {
        change.resumeToken = resumeToken;
    }
}

//# sourceMappingURL=watch_change.js.map
