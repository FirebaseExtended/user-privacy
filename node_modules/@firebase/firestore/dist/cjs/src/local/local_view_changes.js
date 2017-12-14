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
var view_snapshot_1 = require("../core/view_snapshot");
var collections_1 = require("../model/collections");
/**
 * A set of changes to what documents are currently in view and out of view for
 * a given query. These changes are sent to the LocalStore by the View (via
 * the SyncEngine) and are used to pin / unpin documents as appropriate.
 */
var LocalViewChanges = /** @class */ (function () {
    function LocalViewChanges(query, addedKeys, removedKeys) {
        this.query = query;
        this.addedKeys = addedKeys;
        this.removedKeys = removedKeys;
    }
    LocalViewChanges.fromSnapshot = function (viewSnapshot) {
        var addedKeys = collections_1.documentKeySet();
        var removedKeys = collections_1.documentKeySet();
        for (var _i = 0, _a = viewSnapshot.docChanges; _i < _a.length; _i++) {
            var docChange = _a[_i];
            switch (docChange.type) {
                case view_snapshot_1.ChangeType.Added:
                    addedKeys = addedKeys.add(docChange.doc.key);
                    break;
                case view_snapshot_1.ChangeType.Removed:
                    removedKeys = removedKeys.add(docChange.doc.key);
                    break;
                default:
            }
        }
        return new LocalViewChanges(viewSnapshot.query, addedKeys, removedKeys);
    };
    return LocalViewChanges;
}());
exports.LocalViewChanges = LocalViewChanges;

//# sourceMappingURL=local_view_changes.js.map
