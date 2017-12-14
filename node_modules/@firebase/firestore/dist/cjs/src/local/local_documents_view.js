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
var snapshot_version_1 = require("../core/snapshot_version");
var collections_1 = require("../model/collections");
var document_1 = require("../model/document");
var document_key_1 = require("../model/document_key");
var assert_1 = require("../util/assert");
var persistence_promise_1 = require("./persistence_promise");
/**
 * A readonly view of the local state of all documents we're tracking (i.e. we
 * have a cached version in remoteDocumentCache or local mutations for the
 * document). The view is computed by applying the mutations in the
 * MutationQueue to the RemoteDocumentCache.
 */
var LocalDocumentsView = /** @class */ (function () {
    function LocalDocumentsView(remoteDocumentCache, mutationQueue) {
        this.remoteDocumentCache = remoteDocumentCache;
        this.mutationQueue = mutationQueue;
    }
    /**
     * Get the local view of the document identified by `key`.
     *
     * @return Local view of the document or null if we don't have any cached
     * state for it.
     */
    LocalDocumentsView.prototype.getDocument = function (transaction, key) {
        var _this = this;
        return this.remoteDocumentCache
            .getEntry(transaction, key)
            .next(function (remoteDoc) {
            return _this.computeLocalDocument(transaction, key, remoteDoc);
        });
    };
    /**
     * Gets the local view of the documents identified by `keys`.
     *
     * If we don't have cached state for a document in `keys`, a NoDocument will
     * be stored for that key in the resulting set.
     */
    LocalDocumentsView.prototype.getDocuments = function (transaction, keys) {
        var _this = this;
        var promises = [];
        var results = collections_1.maybeDocumentMap();
        keys.forEach(function (key) {
            promises.push(_this.getDocument(transaction, key).next(function (maybeDoc) {
                // TODO(http://b/32275378): Don't conflate missing / deleted.
                if (!maybeDoc) {
                    maybeDoc = new document_1.NoDocument(key, snapshot_version_1.SnapshotVersion.forDeletedDoc());
                }
                results = results.insert(key, maybeDoc);
            }));
        });
        return persistence_promise_1.PersistencePromise.waitFor(promises).next(function () { return results; });
    };
    /** Performs a query against the local view of all documents. */
    LocalDocumentsView.prototype.getDocumentsMatchingQuery = function (transaction, query) {
        if (document_key_1.DocumentKey.isDocumentKey(query.path)) {
            return this.getDocumentsMatchingDocumentQuery(transaction, query.path);
        }
        else {
            return this.getDocumentsMatchingCollectionQuery(transaction, query);
        }
    };
    LocalDocumentsView.prototype.getDocumentsMatchingDocumentQuery = function (transaction, docPath) {
        // Just do a simple document lookup.
        return this.getDocument(transaction, new document_key_1.DocumentKey(docPath)).next(function (maybeDoc) {
            var result = collections_1.documentMap();
            if (maybeDoc instanceof document_1.Document) {
                result = result.insert(maybeDoc.key, maybeDoc);
            }
            return result;
        });
    };
    LocalDocumentsView.prototype.getDocumentsMatchingCollectionQuery = function (transaction, query) {
        var _this = this;
        // Query the remote documents and overlay mutations.
        // TODO(mikelehen): There may be significant overlap between the mutations
        // affecting these remote documents and the
        // getAllMutationBatchesAffectingQuery() mutations. Consider optimizing.
        var results;
        return this.remoteDocumentCache
            .getDocumentsMatchingQuery(transaction, query)
            .next(function (queryResults) {
            return _this.computeLocalDocuments(transaction, queryResults);
        })
            .next(function (promisedResults) {
            results = promisedResults;
            // Now use the mutation queue to discover any other documents that may
            // match the query after applying mutations.
            return _this.mutationQueue.getAllMutationBatchesAffectingQuery(transaction, query);
        })
            .next(function (matchingMutationBatches) {
            var matchingKeys = collections_1.documentKeySet();
            for (var _i = 0, matchingMutationBatches_1 = matchingMutationBatches; _i < matchingMutationBatches_1.length; _i++) {
                var batch = matchingMutationBatches_1[_i];
                for (var _a = 0, _b = batch.mutations; _a < _b.length; _a++) {
                    var mutation = _b[_a];
                    // TODO(mikelehen): PERF: Check if this mutation actually
                    // affects the query to reduce work.
                    if (!results.get(mutation.key)) {
                        matchingKeys = matchingKeys.add(mutation.key);
                    }
                }
            }
            // Now add in the results for the matchingKeys.
            var promises = [];
            matchingKeys.forEach(function (key) {
                promises.push(_this.getDocument(transaction, key).next(function (doc) {
                    if (doc instanceof document_1.Document) {
                        results = results.insert(doc.key, doc);
                    }
                }));
            });
            return persistence_promise_1.PersistencePromise.waitFor(promises);
        })
            .next(function () {
            // Finally, filter out any documents that don't actually match
            // the query.
            results.forEach(function (key, doc) {
                if (!query.matches(doc)) {
                    results = results.remove(key);
                }
            });
            return results;
        });
    };
    /**
     * Takes a remote document and applies local mutations to generate the local
     * view of the document.
     * @param transaction The transaction in which to perform any persistence
     *     operations.
     * @param documentKey The key of the document (necessary when remoteDocument
     *     is null).
     * @param document The base remote document to apply mutations to or null.
     */
    LocalDocumentsView.prototype.computeLocalDocument = function (transaction, documentKey, document) {
        return this.mutationQueue
            .getAllMutationBatchesAffectingDocumentKey(transaction, documentKey)
            .next(function (batches) {
            for (var _i = 0, batches_1 = batches; _i < batches_1.length; _i++) {
                var batch = batches_1[_i];
                document = batch.applyToLocalView(documentKey, document);
            }
            return document;
        });
    };
    /**
     * Takes a set of remote documents and applies local mutations to generate the
     * local view of the documents.
     * @param transaction The transaction in which to perform any persistence
     *     operations.
     * @param documents The base remote documents to apply mutations to.
     * @return The local view of the documents.
     */
    LocalDocumentsView.prototype.computeLocalDocuments = function (transaction, documents) {
        var _this = this;
        var promises = [];
        documents.forEach(function (key, doc) {
            promises.push(_this.computeLocalDocument(transaction, key, doc).next(function (mutatedDoc) {
                if (mutatedDoc instanceof document_1.Document) {
                    documents = documents.insert(mutatedDoc.key, mutatedDoc);
                }
                else if (mutatedDoc instanceof document_1.NoDocument) {
                    documents = documents.remove(mutatedDoc.key);
                }
                else {
                    assert_1.fail('Unknown MaybeDocument: ' + mutatedDoc);
                }
            }));
        });
        return persistence_promise_1.PersistencePromise.waitFor(promises).next(function () { return documents; });
    };
    return LocalDocumentsView;
}());
exports.LocalDocumentsView = LocalDocumentsView;

//# sourceMappingURL=local_documents_view.js.map
