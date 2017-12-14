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
import { Timestamp } from '../core/timestamp';
import { Document, NoDocument } from '../model/document';
import { DocumentKey } from '../model/document_key';
import { MutationBatch } from '../model/mutation_batch';
import { assert, fail } from '../util/assert';
import { DbMutationBatch, DbNoDocument, DbRemoteDocument, DbTarget, DbTimestamp } from './indexeddb_schema';
import { QueryData, QueryPurpose } from './query_data';
/** Serializer for values stored in the LocalStore. */
var LocalSerializer = /** @class */ (function () {
    function LocalSerializer(remoteSerializer) {
        this.remoteSerializer = remoteSerializer;
    }
    /** Decodes a remote document from storage locally to a Document. */
    LocalSerializer.prototype.fromDbRemoteDocument = function (remoteDoc) {
        if (remoteDoc.document) {
            return this.remoteSerializer.fromDocument(remoteDoc.document);
        }
        else if (remoteDoc.noDocument) {
            var key = DocumentKey.fromSegments(remoteDoc.noDocument.path);
            var readTime = remoteDoc.noDocument.readTime;
            var timestamp = new Timestamp(readTime.seconds, readTime.nanos);
            return new NoDocument(key, SnapshotVersion.fromTimestamp(timestamp));
        }
        else {
            return fail('Unexpected DbRemoteDocument');
        }
    };
    /** Encodes a document for storage locally. */
    LocalSerializer.prototype.toDbRemoteDocument = function (maybeDoc) {
        if (maybeDoc instanceof Document) {
            var doc = this.remoteSerializer.toDocument(maybeDoc);
            return new DbRemoteDocument(null, doc);
        }
        else {
            var path = maybeDoc.key.path.toArray();
            var timestamp = maybeDoc.version.toTimestamp();
            var readTime = new DbTimestamp(timestamp.seconds, timestamp.nanos);
            return new DbRemoteDocument(new DbNoDocument(path, readTime), null);
        }
    };
    /** Encodes a batch of mutations into a DbMutationBatch for local storage. */
    LocalSerializer.prototype.toDbMutationBatch = function (userId, batch) {
        var _this = this;
        var serializedMutations = batch.mutations.map(function (m) {
            return _this.remoteSerializer.toMutation(m);
        });
        return new DbMutationBatch(userId, batch.batchId, batch.localWriteTime.toEpochMilliseconds(), serializedMutations);
    };
    /** Decodes a DbMutationBatch into a MutationBatch */
    LocalSerializer.prototype.fromDbMutationBatch = function (dbBatch) {
        var _this = this;
        var mutations = dbBatch.mutations.map(function (m) {
            return _this.remoteSerializer.fromMutation(m);
        });
        var timestamp = Timestamp.fromEpochMilliseconds(dbBatch.localWriteTimeMs);
        return new MutationBatch(dbBatch.batchId, timestamp, mutations);
    };
    /** Decodes a DbTarget into QueryData */
    LocalSerializer.prototype.fromDbTarget = function (dbTarget) {
        var readTime = new Timestamp(dbTarget.readTime.seconds, dbTarget.readTime.nanos);
        var version = SnapshotVersion.fromTimestamp(readTime);
        var query;
        if (isDocumentQuery(dbTarget.query)) {
            query = this.remoteSerializer.fromDocumentsTarget(dbTarget.query);
        }
        else {
            query = this.remoteSerializer.fromQueryTarget(dbTarget.query);
        }
        return new QueryData(query, dbTarget.targetId, QueryPurpose.Listen, version, dbTarget.resumeToken);
    };
    /** Encodes QueryData into a DbTarget for storage locally. */
    LocalSerializer.prototype.toDbTarget = function (queryData) {
        assert(QueryPurpose.Listen === queryData.purpose, 'Only queries with purpose ' +
            QueryPurpose.Listen +
            ' may be stored, got ' +
            queryData.purpose);
        var timestamp = queryData.snapshotVersion.toTimestamp();
        var dbTimestamp = new DbTimestamp(timestamp.seconds, timestamp.nanos);
        var queryProto;
        if (queryData.query.isDocumentQuery()) {
            queryProto = this.remoteSerializer.toDocumentsTarget(queryData.query);
        }
        else {
            queryProto = this.remoteSerializer.toQueryTarget(queryData.query);
        }
        assert(typeof queryData.resumeToken === 'string', 'Persisting non-string resume token not supported.');
        var resumeToken = queryData.resumeToken;
        // lastListenSequenceNumber is always 0 until we do real GC.
        return new DbTarget(queryData.targetId, queryData.query.canonicalId(), dbTimestamp, resumeToken, 0, queryProto);
    };
    return LocalSerializer;
}());
export { LocalSerializer };
/**
 * A helper function for figuring out what kind of query has been stored.
 */
function isDocumentQuery(dbQuery) {
    return dbQuery.documents !== undefined;
}

//# sourceMappingURL=local_serializer.js.map
