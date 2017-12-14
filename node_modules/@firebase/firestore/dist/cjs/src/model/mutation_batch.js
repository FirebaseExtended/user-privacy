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
var collections_1 = require("./collections");
var assert_1 = require("../util/assert");
var misc = require("../util/misc");
exports.BATCHID_UNKNOWN = -1;
/**
 * A batch of mutations that will be sent as one unit to the backend.
 */
var MutationBatch = /** @class */ (function () {
    function MutationBatch(batchId, localWriteTime, mutations) {
        this.batchId = batchId;
        this.localWriteTime = localWriteTime;
        this.mutations = mutations;
    }
    /**
     * Applies all the mutations in this MutationBatch to the specified document
     * to create a new remote document
     *
     * @param docKey The key of the document to apply mutations to.
     * @param maybeDoc The document to apply mutations to.
     * @param batchResult The result of applying the MutationBatch to the
     * backend.
     */
    MutationBatch.prototype.applyToRemoteDocument = function (docKey, maybeDoc, batchResult) {
        if (maybeDoc) {
            assert_1.assert(maybeDoc.key.equals(docKey), "applyToRemoteDocument: key " + docKey + " should match maybeDoc key\n        " + maybeDoc.key);
        }
        var mutationResults = batchResult.mutationResults;
        assert_1.assert(mutationResults.length === this.mutations.length, "Mismatch between mutations length\n      (" + this.mutations.length + ") and mutation results length\n      (" + mutationResults.length + ").");
        for (var i = 0; i < this.mutations.length; i++) {
            var mutation = this.mutations[i];
            if (mutation.key.equals(docKey)) {
                var mutationResult = mutationResults[i];
                maybeDoc = mutation.applyToRemoteDocument(maybeDoc, mutationResult);
            }
        }
        return maybeDoc;
    };
    /**
     * Computes the local view of a document given all the mutations in this
     * batch.
     *
     * @param docKey The key of the document to apply mutations to.
     * @param maybeDoc The document to apply mutations to.
     */
    MutationBatch.prototype.applyToLocalView = function (docKey, maybeDoc) {
        if (maybeDoc) {
            assert_1.assert(maybeDoc.key.equals(docKey), "applyToLocalDocument: key " + docKey + " should match maybeDoc key\n        " + maybeDoc.key);
        }
        for (var i = 0; i < this.mutations.length; i++) {
            var mutation = this.mutations[i];
            if (mutation.key.equals(docKey)) {
                maybeDoc = mutation.applyToLocalView(maybeDoc, this.localWriteTime);
            }
        }
        return maybeDoc;
    };
    MutationBatch.prototype.keys = function () {
        var keySet = collections_1.documentKeySet();
        for (var _i = 0, _a = this.mutations; _i < _a.length; _i++) {
            var mutation = _a[_i];
            keySet = keySet.add(mutation.key);
        }
        return keySet;
    };
    MutationBatch.prototype.equals = function (other) {
        return (this.batchId === other.batchId &&
            misc.arrayEquals(this.mutations, other.mutations));
    };
    /**
     * Returns true if this mutation batch has already been removed from the
     * mutation queue.
     *
     * Note that not all implementations of the MutationQueue necessarily use
     * tombstones as part of their implementation and generally speaking no code
     * outside the mutation queues should really care about this.
     */
    MutationBatch.prototype.isTombstone = function () {
        return this.mutations.length === 0;
    };
    /** Converts this batch into a tombstone */
    MutationBatch.prototype.toTombstone = function () {
        return new MutationBatch(this.batchId, this.localWriteTime, []);
    };
    return MutationBatch;
}());
exports.MutationBatch = MutationBatch;
/** The result of applying a mutation batch to the backend. */
var MutationBatchResult = /** @class */ (function () {
    function MutationBatchResult(batch, commitVersion, mutationResults, streamToken, 
        /**
         * A pre-computed mapping from each mutated document to the resulting
         * version.
         */
        docVersions) {
        this.batch = batch;
        this.commitVersion = commitVersion;
        this.mutationResults = mutationResults;
        this.streamToken = streamToken;
        this.docVersions = docVersions;
    }
    /**
     * Creates a new MutationBatchResult for the given batch and results. There
     * must be one result for each mutation in the batch. This static factory
     * caches a document=>version mapping (docVersions).
     */
    MutationBatchResult.from = function (batch, commitVersion, results, streamToken) {
        assert_1.assert(batch.mutations.length === results.length, 'Mutations sent ' +
            batch.mutations.length +
            ' must equal results received ' +
            results.length);
        var versionMap = collections_1.documentVersionMap();
        var mutations = batch.mutations;
        for (var i = 0; i < mutations.length; i++) {
            var version = results[i].version;
            if (version === null) {
                // deletes don't have a version, so we substitute the commitVersion
                // of the entire batch.
                version = commitVersion;
            }
            versionMap = versionMap.insert(mutations[i].key, version);
        }
        return new MutationBatchResult(batch, commitVersion, results, streamToken, versionMap);
    };
    return MutationBatchResult;
}());
exports.MutationBatchResult = MutationBatchResult;

//# sourceMappingURL=mutation_batch.js.map
