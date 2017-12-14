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
var assert_1 = require("../util/assert");
var persistence_promise_1 = require("./persistence_promise");
/**
 * An in-memory buffer of entries to be written to a RemoteDocumentCache.
 * It can be used to batch up a set of changes to be written to the cache, but
 * additionally supports reading entries back with the `getEntry()` method,
 * falling back to the underlying RemoteDocumentCache if no entry is
 * buffered.
 *
 * NOTE: This class was introduced in iOS to work around a limitation in
 * LevelDB. Given IndexedDb has full transaction support with
 * read-your-own-writes capability, this class is not technically needed, but
 * has been preserved as a convenience and to aid portability.
 */
var RemoteDocumentChangeBuffer = /** @class */ (function () {
    function RemoteDocumentChangeBuffer(remoteDocumentCache) {
        this.remoteDocumentCache = remoteDocumentCache;
        this.changes = collections_1.maybeDocumentMap();
    }
    /** Buffers a `RemoteDocumentCache.addEntry()` call. */
    RemoteDocumentChangeBuffer.prototype.addEntry = function (maybeDocument) {
        var changes = this.assertChanges();
        this.changes = changes.insert(maybeDocument.key, maybeDocument);
    };
    // NOTE: removeEntry() is not presently necessary and so is omitted.
    /**
     * Looks up an entry in the cache. The buffered changes will first be checked,
     * and if no buffered change applies, this will forward to
     * `RemoteDocumentCache.getEntry()`.
     *
     * @param transaction The transaction in which to perform any persistence
     *     operations.
     * @param documentKey The key of the entry to look up.
     * @return The cached Document or NoDocument entry, or null if we have nothing
     * cached.
     */
    RemoteDocumentChangeBuffer.prototype.getEntry = function (transaction, documentKey) {
        var changes = this.assertChanges();
        var bufferedEntry = changes.get(documentKey);
        if (bufferedEntry) {
            return persistence_promise_1.PersistencePromise.resolve(bufferedEntry);
        }
        else {
            return this.remoteDocumentCache.getEntry(transaction, documentKey);
        }
    };
    /**
     * Applies buffered changes to the underlying RemoteDocumentCache, using
     * the provided transaction.
     */
    RemoteDocumentChangeBuffer.prototype.apply = function (transaction) {
        var _this = this;
        var changes = this.assertChanges();
        var promises = [];
        changes.forEach(function (key, maybeDoc) {
            promises.push(_this.remoteDocumentCache.addEntry(transaction, maybeDoc));
        });
        // We should not be used to buffer any more changes.
        this.changes = null;
        return persistence_promise_1.PersistencePromise.waitFor(promises);
    };
    /** Helper to assert this.changes is not null and return it. */
    RemoteDocumentChangeBuffer.prototype.assertChanges = function () {
        assert_1.assert(this.changes !== null, 'Changes have already been applied.');
        return this.changes;
    };
    return RemoteDocumentChangeBuffer;
}());
exports.RemoteDocumentChangeBuffer = RemoteDocumentChangeBuffer;

//# sourceMappingURL=remote_document_change_buffer.js.map
