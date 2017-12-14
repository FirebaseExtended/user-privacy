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
import { documentMap, maybeDocumentMap } from '../model/collections';
import { Document } from '../model/document';
import { DocumentKey } from '../model/document_key';
import { PersistencePromise } from './persistence_promise';
var MemoryRemoteDocumentCache = /** @class */ (function () {
    function MemoryRemoteDocumentCache() {
        this.docs = maybeDocumentMap();
    }
    MemoryRemoteDocumentCache.prototype.addEntry = function (transaction, maybeDocument) {
        this.docs = this.docs.insert(maybeDocument.key, maybeDocument);
        return PersistencePromise.resolve();
    };
    MemoryRemoteDocumentCache.prototype.removeEntry = function (transaction, documentKey) {
        this.docs = this.docs.remove(documentKey);
        return PersistencePromise.resolve();
    };
    MemoryRemoteDocumentCache.prototype.getEntry = function (transaction, documentKey) {
        return PersistencePromise.resolve(this.docs.get(documentKey));
    };
    MemoryRemoteDocumentCache.prototype.getDocumentsMatchingQuery = function (transaction, query) {
        var results = documentMap();
        // Documents are ordered by key, so we can use a prefix scan to narrow down
        // the documents we need to match the query against.
        var prefix = new DocumentKey(query.path.child(''));
        var iterator = this.docs.getIteratorFrom(prefix);
        while (iterator.hasNext()) {
            var _a = iterator.getNext(), key = _a.key, maybeDoc = _a.value;
            if (!query.path.isPrefixOf(key.path)) {
                break;
            }
            if (maybeDoc instanceof Document && query.matches(maybeDoc)) {
                results = results.insert(maybeDoc.key, maybeDoc);
            }
        }
        return PersistencePromise.resolve(results);
    };
    return MemoryRemoteDocumentCache;
}());
export { MemoryRemoteDocumentCache };

//# sourceMappingURL=memory_remote_document_cache.js.map
