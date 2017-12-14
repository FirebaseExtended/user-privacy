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
var snapshot_version_1 = require("./snapshot_version");
var collections_1 = require("../model/collections");
var document_1 = require("../model/document");
var mutation_1 = require("../model/mutation");
var error_1 = require("../util/error");
/**
 * Internal transaction object responsible for accumulating the mutations to
 * perform and the base versions for any documents read.
 */
var Transaction = /** @class */ (function () {
    function Transaction(datastore) {
        this.datastore = datastore;
        // The version of each document that was read during this transaction.
        this.readVersions = collections_1.documentVersionMap();
        this.mutations = [];
        this.committed = false;
    }
    Transaction.prototype.recordVersion = function (doc) {
        var docVersion = doc.version;
        if (doc instanceof document_1.NoDocument) {
            // For deleted docs, we must use baseVersion 0 when we overwrite them.
            docVersion = snapshot_version_1.SnapshotVersion.forDeletedDoc();
        }
        var existingVersion = this.readVersions.get(doc.key);
        if (existingVersion !== null) {
            if (!docVersion.equals(existingVersion)) {
                // This transaction will fail no matter what.
                throw new error_1.FirestoreError(error_1.Code.ABORTED, 'Document version changed between two reads.');
            }
        }
        else {
            this.readVersions = this.readVersions.insert(doc.key, docVersion);
        }
    };
    Transaction.prototype.lookup = function (keys) {
        var _this = this;
        if (this.committed) {
            return Promise.reject('Transaction has already completed.');
        }
        if (this.mutations.length > 0) {
            return Promise.reject('Transactions lookups are invalid after writes.');
        }
        return this.datastore.lookup(keys).then(function (docs) {
            docs.forEach(function (doc) { return _this.recordVersion(doc); });
            return docs;
        });
    };
    Transaction.prototype.write = function (mutations) {
        if (this.committed) {
            throw new error_1.FirestoreError(error_1.Code.FAILED_PRECONDITION, 'Transaction has already completed.');
        }
        this.mutations = this.mutations.concat(mutations);
    };
    /**
     * Returns the version of this document when it was read in this transaction,
     * as a precondition, or no precondition if it was not read.
     */
    Transaction.prototype.precondition = function (key) {
        var version = this.readVersions.get(key);
        if (version) {
            return mutation_1.Precondition.updateTime(version);
        }
        else {
            return mutation_1.Precondition.NONE;
        }
    };
    /**
     * Returns the precondition for a document if the operation is an update.
     */
    Transaction.prototype.preconditionForUpdate = function (key) {
        var version = this.readVersions.get(key);
        if (version && version.equals(snapshot_version_1.SnapshotVersion.forDeletedDoc())) {
            // The document doesn't exist, so fail the transaction.
            throw new error_1.FirestoreError(error_1.Code.FAILED_PRECONDITION, "Can't update a document that doesn't exist.");
        }
        else if (version) {
            // Document exists, base precondition on document update time.
            return mutation_1.Precondition.updateTime(version);
        }
        else {
            // Document was not read, so we just use the preconditions for a blind
            // update.
            return mutation_1.Precondition.exists(true);
        }
    };
    Transaction.prototype.set = function (key, data) {
        this.write(data.toMutations(key, this.precondition(key)));
    };
    Transaction.prototype.update = function (key, data) {
        this.write(data.toMutations(key, this.preconditionForUpdate(key)));
    };
    Transaction.prototype.delete = function (key) {
        this.write([new mutation_1.DeleteMutation(key, this.precondition(key))]);
        // Since the delete will be applied before all following writes, we need to
        // ensure that the precondition for the next write will be exists: false.
        this.readVersions = this.readVersions.insert(key, snapshot_version_1.SnapshotVersion.forDeletedDoc());
    };
    Transaction.prototype.commit = function () {
        var _this = this;
        var unwritten = this.readVersions;
        // For each mutation, note that the doc was written.
        this.mutations.forEach(function (mutation) {
            unwritten = unwritten.remove(mutation.key);
        });
        if (!unwritten.isEmpty()) {
            return Promise.reject(Error('Every document read in a transaction must also be written.'));
        }
        return this.datastore.commit(this.mutations).then(function () {
            _this.committed = true;
        });
    };
    return Transaction;
}());
exports.Transaction = Transaction;

//# sourceMappingURL=transaction.js.map
