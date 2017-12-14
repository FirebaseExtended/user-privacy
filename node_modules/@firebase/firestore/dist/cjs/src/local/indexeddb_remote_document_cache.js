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
var assert_1 = require("../util/assert");
var indexeddb_schema_1 = require("./indexeddb_schema");
var simple_db_1 = require("./simple_db");
var IndexedDbRemoteDocumentCache = /** @class */ (function () {
    function IndexedDbRemoteDocumentCache(serializer) {
        this.serializer = serializer;
    }
    IndexedDbRemoteDocumentCache.prototype.addEntry = function (transaction, maybeDocument) {
        return remoteDocumentsStore(transaction).put(dbKey(maybeDocument.key), this.serializer.toDbRemoteDocument(maybeDocument));
    };
    IndexedDbRemoteDocumentCache.prototype.removeEntry = function (transaction, documentKey) {
        return remoteDocumentsStore(transaction).delete(dbKey(documentKey));
    };
    IndexedDbRemoteDocumentCache.prototype.getEntry = function (transaction, documentKey) {
        var _this = this;
        return remoteDocumentsStore(transaction)
            .get(dbKey(documentKey))
            .next(function (dbRemoteDoc) {
            return dbRemoteDoc
                ? _this.serializer.fromDbRemoteDocument(dbRemoteDoc)
                : null;
        });
    };
    IndexedDbRemoteDocumentCache.prototype.getDocumentsMatchingQuery = function (transaction, query) {
        var _this = this;
        var results = collections_1.documentMap();
        // Documents are ordered by key, so we can use a prefix scan to narrow down
        // the documents we need to match the query against.
        var startKey = query.path.toArray();
        var range = IDBKeyRange.lowerBound(startKey);
        return remoteDocumentsStore(transaction)
            .iterate({ range: range }, function (key, dbRemoteDoc, control) {
            var maybeDoc = _this.serializer.fromDbRemoteDocument(dbRemoteDoc);
            if (!query.path.isPrefixOf(maybeDoc.key.path)) {
                control.done();
            }
            else if (maybeDoc instanceof document_1.Document && query.matches(maybeDoc)) {
                results = results.insert(maybeDoc.key, maybeDoc);
            }
        })
            .next(function () { return results; });
    };
    return IndexedDbRemoteDocumentCache;
}());
exports.IndexedDbRemoteDocumentCache = IndexedDbRemoteDocumentCache;
/**
 * Helper to get a typed SimpleDbStore for the remoteDocuments object store.
 */
function remoteDocumentsStore(txn) {
    if (txn instanceof simple_db_1.SimpleDbTransaction) {
        return txn.store(indexeddb_schema_1.DbRemoteDocument.store);
    }
    else {
        return assert_1.fail('Invalid transaction object provided!');
    }
}
function dbKey(docKey) {
    return docKey.path.toArray();
}

//# sourceMappingURL=indexeddb_remote_document_cache.js.map
