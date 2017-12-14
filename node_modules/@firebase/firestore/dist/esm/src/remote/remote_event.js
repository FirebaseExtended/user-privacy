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
import { documentKeySet } from '../model/collections';
import { emptyByteString } from '../platform/platform';
/**
 * An event from the RemoteStore. It is split into targetChanges (changes to the
 * state or the set of documents in our watched targets) and documentUpdates
 * (changes to the actual documents).
 */
var RemoteEvent = /** @class */ (function () {
    function RemoteEvent(
        /**
         * The snapshot version this event brings us up to, or MIN if not set.
         */
        snapshotVersion, 
        /**
         * A map from target to changes to the target. See TargetChange.
         */
        targetChanges, 
        /**
         * A set of which documents have changed or been deleted, along with the
         * doc's new values (if not deleted).
         */
        documentUpdates) {
        this.snapshotVersion = snapshotVersion;
        this.targetChanges = targetChanges;
        this.documentUpdates = documentUpdates;
    }
    RemoteEvent.prototype.addDocumentUpdate = function (doc) {
        this.documentUpdates = this.documentUpdates.insert(doc.key, doc);
    };
    RemoteEvent.prototype.handleExistenceFilterMismatch = function (targetId) {
        /*
         * An existence filter mismatch will reset the query and we need to reset
         * the mapping to contain no documents and an empty resume token.
         *
         * Note:
         *   * The reset mapping is empty, specifically forcing the consumer of the
         *     change to forget all keys for this targetID;
         *   * The resume snapshot for this target must be reset
         *   * The target must be unacked because unwatching and rewatching
         *     introduces a race for changes.
         */
        this.targetChanges[targetId] = {
            mapping: new ResetMapping(),
            snapshotVersion: SnapshotVersion.MIN,
            currentStatusUpdate: CurrentStatusUpdate.MarkNotCurrent,
            resumeToken: emptyByteString()
        };
    };
    return RemoteEvent;
}());
export { RemoteEvent };
/**
 * Represents an update to the current status of a target, either explicitly
 * having no new state, or the new value to set. Note "current" has special
 * meaning for in the RPC protocol that implies that a target is both up-to-date
 * and consistent with the rest of the watch stream.
 */
export var CurrentStatusUpdate;
(function (CurrentStatusUpdate) {
    /** The current status is not affected and should not be modified. */
    CurrentStatusUpdate[CurrentStatusUpdate["None"] = 0] = "None";
    /** The target must be marked as no longer "current". */
    CurrentStatusUpdate[CurrentStatusUpdate["MarkNotCurrent"] = 1] = "MarkNotCurrent";
    /** The target must be marked as "current". */
    CurrentStatusUpdate[CurrentStatusUpdate["MarkCurrent"] = 2] = "MarkCurrent";
})(CurrentStatusUpdate || (CurrentStatusUpdate = {}));
var EMPTY_KEY_SET = documentKeySet();
var ResetMapping = /** @class */ (function () {
    function ResetMapping() {
        this.docs = EMPTY_KEY_SET;
    }
    Object.defineProperty(ResetMapping.prototype, "documents", {
        get: function () {
            return this.docs;
        },
        enumerable: true,
        configurable: true
    });
    ResetMapping.prototype.add = function (key) {
        this.docs = this.docs.add(key);
    };
    ResetMapping.prototype.delete = function (key) {
        this.docs = this.docs.delete(key);
    };
    ResetMapping.prototype.equals = function (other) {
        return other !== null && this.docs.equals(other.docs);
    };
    return ResetMapping;
}());
export { ResetMapping };
var UpdateMapping = /** @class */ (function () {
    function UpdateMapping() {
        this.addedDocuments = EMPTY_KEY_SET;
        this.removedDocuments = EMPTY_KEY_SET;
    }
    UpdateMapping.prototype.applyToKeySet = function (keys) {
        var result = keys;
        this.addedDocuments.forEach(function (key) { return (result = result.add(key)); });
        this.removedDocuments.forEach(function (key) { return (result = result.delete(key)); });
        return result;
    };
    UpdateMapping.prototype.add = function (key) {
        this.addedDocuments = this.addedDocuments.add(key);
        this.removedDocuments = this.removedDocuments.delete(key);
    };
    UpdateMapping.prototype.delete = function (key) {
        this.addedDocuments = this.addedDocuments.delete(key);
        this.removedDocuments = this.removedDocuments.add(key);
    };
    UpdateMapping.prototype.equals = function (other) {
        return (other !== null &&
            this.addedDocuments.equals(other.addedDocuments) &&
            this.removedDocuments.equals(other.removedDocuments));
    };
    return UpdateMapping;
}());
export { UpdateMapping };

//# sourceMappingURL=remote_event.js.map
