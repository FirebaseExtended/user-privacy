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
import { DocumentKey } from '../model/document_key';
import { fail } from '../util/assert';
import { SortedMap } from '../util/sorted_map';
export var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["Added"] = 0] = "Added";
    ChangeType[ChangeType["Removed"] = 1] = "Removed";
    ChangeType[ChangeType["Modified"] = 2] = "Modified";
    ChangeType[ChangeType["Metadata"] = 3] = "Metadata";
})(ChangeType || (ChangeType = {}));
export var SyncState;
(function (SyncState) {
    SyncState[SyncState["Local"] = 0] = "Local";
    SyncState[SyncState["Synced"] = 1] = "Synced";
})(SyncState || (SyncState = {}));
/**
 * DocumentChangeSet keeps track of a set of changes to docs in a query, merging
 * duplicate events for the same doc.
 */
var DocumentChangeSet = /** @class */ (function () {
    function DocumentChangeSet() {
        this.changeMap = new SortedMap(DocumentKey.comparator);
    }
    DocumentChangeSet.prototype.track = function (change) {
        var key = change.doc.key;
        var oldChange = this.changeMap.get(key);
        if (!oldChange) {
            this.changeMap = this.changeMap.insert(key, change);
            return;
        }
        // Merge the new change with the existing change.
        if (change.type !== ChangeType.Added &&
            oldChange.type === ChangeType.Metadata) {
            this.changeMap = this.changeMap.insert(key, change);
        }
        else if (change.type === ChangeType.Metadata &&
            oldChange.type !== ChangeType.Removed) {
            this.changeMap = this.changeMap.insert(key, {
                type: oldChange.type,
                doc: change.doc
            });
        }
        else if (change.type === ChangeType.Modified &&
            oldChange.type === ChangeType.Modified) {
            this.changeMap = this.changeMap.insert(key, {
                type: ChangeType.Modified,
                doc: change.doc
            });
        }
        else if (change.type === ChangeType.Modified &&
            oldChange.type === ChangeType.Added) {
            this.changeMap = this.changeMap.insert(key, {
                type: ChangeType.Added,
                doc: change.doc
            });
        }
        else if (change.type === ChangeType.Removed &&
            oldChange.type === ChangeType.Added) {
            this.changeMap = this.changeMap.remove(key);
        }
        else if (change.type === ChangeType.Removed &&
            oldChange.type === ChangeType.Modified) {
            this.changeMap = this.changeMap.insert(key, {
                type: ChangeType.Removed,
                doc: oldChange.doc
            });
        }
        else if (change.type === ChangeType.Added &&
            oldChange.type === ChangeType.Removed) {
            this.changeMap = this.changeMap.insert(key, {
                type: ChangeType.Modified,
                doc: change.doc
            });
        }
        else {
            // This includes these cases, which don't make sense:
            // Added->Added
            // Removed->Removed
            // Modified->Added
            // Removed->Modified
            // Metadata->Added
            // Removed->Metadata
            fail('unsupported combination of changes: ' +
                JSON.stringify(change) +
                ' after ' +
                JSON.stringify(oldChange));
        }
    };
    DocumentChangeSet.prototype.getChanges = function () {
        var changes = [];
        this.changeMap.inorderTraversal(function (key, change) {
            changes.push(change);
        });
        return changes;
    };
    return DocumentChangeSet;
}());
export { DocumentChangeSet };

//# sourceMappingURL=view_snapshot.js.map
