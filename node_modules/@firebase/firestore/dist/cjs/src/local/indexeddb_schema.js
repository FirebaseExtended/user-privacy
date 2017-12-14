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
var assert_1 = require("../util/assert");
var encoded_resource_path_1 = require("./encoded_resource_path");
exports.SCHEMA_VERSION = 1;
/** Performs database creation and (in the future) upgrades between versions. */
function createOrUpgradeDb(db, oldVersion) {
    assert_1.assert(oldVersion === 0, 'Unexpected upgrade from version ' + oldVersion);
    db.createObjectStore(DbMutationQueue.store, {
        keyPath: DbMutationQueue.keyPath
    });
    // TODO(mikelehen): Get rid of "as any" if/when TypeScript fixes their
    // types. https://github.com/Microsoft/TypeScript/issues/14322
    db.createObjectStore(
    // tslint:disable-next-line:no-any
    DbMutationBatch.store, { keyPath: DbMutationBatch.keyPath });
    var targetDocumentsStore = db.createObjectStore(
    // tslint:disable-next-line:no-any
    DbTargetDocument.store, { keyPath: DbTargetDocument.keyPath });
    targetDocumentsStore.createIndex(DbTargetDocument.documentTargetsIndex, DbTargetDocument.documentTargetsKeyPath, { unique: true });
    var targetStore = db.createObjectStore(DbTarget.store, {
        keyPath: DbTarget.keyPath
    });
    // NOTE: This is unique only because the TargetId is the suffix.
    targetStore.createIndex(DbTarget.queryTargetsIndexName, DbTarget.queryTargetsKeyPath, { unique: true });
    // NOTE: keys for these stores are specified explicitly rather than using a
    // keyPath.
    db.createObjectStore(DbDocumentMutation.store);
    db.createObjectStore(DbRemoteDocument.store);
    db.createObjectStore(DbOwner.store);
    db.createObjectStore(DbTargetGlobal.store);
}
exports.createOrUpgradeDb = createOrUpgradeDb;
/**
 * Wrapper class to store timestamps (seconds and nanos) in IndexedDb objects.
 */
var DbTimestamp = /** @class */ (function () {
    function DbTimestamp(seconds, nanos) {
        this.seconds = seconds;
        this.nanos = nanos;
    }
    return DbTimestamp;
}());
exports.DbTimestamp = DbTimestamp;
/**
 * A singleton object to be stored in the 'owner' store in IndexedDb.
 *
 * A given database can be owned by a single tab at a given time. That tab
 * must validate that it is still the owner before every write operation and
 * should regularly write an updated timestamp to prevent other tabs from
 * "stealing" ownership of the db.
 */
var DbOwner = /** @class */ (function () {
    function DbOwner(ownerId, leaseTimestampMs) {
        this.ownerId = ownerId;
        this.leaseTimestampMs = leaseTimestampMs;
    }
    /** Name of the IndexedDb object store. */
    DbOwner.store = 'owner';
    return DbOwner;
}());
exports.DbOwner = DbOwner;
/**
 * An object to be stored in the 'mutationQueues' store in IndexedDb.
 *
 * Each user gets a single queue of MutationBatches to apply to the server.
 * DbMutationQueue tracks the metadata about the queue.
 */
var DbMutationQueue = /** @class */ (function () {
    function DbMutationQueue(
        /**
         * The normalized user ID to which this queue belongs.
         */
        userId, 
        /**
         * An identifier for the highest numbered batch that has been acknowledged
         * by the server. All MutationBatches in this queue with batchIds less
         * than or equal to this value are considered to have been acknowledged by
         * the server.
         */
        lastAcknowledgedBatchId, 
        /**
         * A stream token that was previously sent by the server.
         *
         * See StreamingWriteRequest in datastore.proto for more details about
         * usage.
         *
         * After sending this token, earlier tokens may not be used anymore so
         * only a single stream token is retained.
         */
        lastStreamToken) {
        this.userId = userId;
        this.lastAcknowledgedBatchId = lastAcknowledgedBatchId;
        this.lastStreamToken = lastStreamToken;
    }
    /** Name of the IndexedDb object store.  */
    DbMutationQueue.store = 'mutationQueues';
    /** Keys are automatically assigned via the userId property. */
    DbMutationQueue.keyPath = 'userId';
    return DbMutationQueue;
}());
exports.DbMutationQueue = DbMutationQueue;
/**
 * An object to be stored in the 'mutations' store in IndexedDb.
 *
 * Represents a batch of user-level mutations intended to be sent to the server
 * in a single write. Each user-level batch gets a separate DbMutationBatch
 * with a new batchId.
 */
var DbMutationBatch = /** @class */ (function () {
    function DbMutationBatch(
        /**
         * The normalized user ID to which this batch belongs.
         */
        userId, 
        /**
         * An identifier for this batch, allocated by the mutation queue in a
         * monotonically increasing manner.
         */
        batchId, 
        /**
         * The local write time of the batch, stored as milliseconds since the
         * epoch.
         */
        localWriteTimeMs, 
        /**
         * A list of mutations to apply. All mutations will be applied atomically.
         *
         * Mutations are serialized via JsonProtoSerializer.toMutation().
         */
        mutations) {
        this.userId = userId;
        this.batchId = batchId;
        this.localWriteTimeMs = localWriteTimeMs;
        this.mutations = mutations;
    }
    /** Name of the IndexedDb object store.  */
    DbMutationBatch.store = 'mutations';
    /** Keys are automatically assigned via the userId, batchId properties. */
    DbMutationBatch.keyPath = ['userId', 'batchId'];
    return DbMutationBatch;
}());
exports.DbMutationBatch = DbMutationBatch;
/**
 * An object to be stored in the 'documentMutations' store in IndexedDb.
 *
 * A manually maintained index of all the mutation batches that affect a given
 * document key. The rows in this table are references based on the contents of
 * DbMutationBatch.mutations.
 */
var DbDocumentMutation = /** @class */ (function () {
    function DbDocumentMutation() {
    }
    /**
     * Creates a [userId] key for use in the DbDocumentMutations index to iterate
     * over all of a user's document mutations.
     */
    DbDocumentMutation.prefixForUser = function (userId) {
        return [userId];
    };
    /**
     * Creates a [userId, encodedPath] key for use in the DbDocumentMutations
     * index to iterate over all at document mutations for a given path or lower.
     */
    DbDocumentMutation.prefixForPath = function (userId, path) {
        return [userId, encoded_resource_path_1.encode(path)];
    };
    /**
     * Creates a full index key of [userId, encodedPath, batchId] for inserting
     * and deleting into the DbDocumentMutations index.
     */
    DbDocumentMutation.key = function (userId, path, batchId) {
        return [userId, encoded_resource_path_1.encode(path), batchId];
    };
    DbDocumentMutation.store = 'documentMutations';
    /**
     * Because we store all the useful information for this store in the key,
     * there is no useful information to store as the value. The raw (unencoded)
     * path cannot be stored because IndexedDb doesn't store prototype
     * information.
     */
    DbDocumentMutation.PLACEHOLDER = new DbDocumentMutation();
    return DbDocumentMutation;
}());
exports.DbDocumentMutation = DbDocumentMutation;
/**
 * Represents the known absence of a document at a particular version.
 * Stored in IndexedDb as part of a DbRemoteDocument object.
 */
var DbNoDocument = /** @class */ (function () {
    function DbNoDocument(path, readTime) {
        this.path = path;
        this.readTime = readTime;
    }
    return DbNoDocument;
}());
exports.DbNoDocument = DbNoDocument;
/**
 * An object to be stored in the 'remoteDocuments' store in IndexedDb. It
 * represents either a cached document (if it exists) or a cached "no-document"
 * (if it is known to not exist).
 *
 * Note: This is the persisted equivalent of a MaybeDocument and could perhaps
 * be made more general if necessary.
 */
var DbRemoteDocument = /** @class */ (function () {
    function DbRemoteDocument(
        /**
         * Set to an instance of a DbNoDocument if it is known that no document
         * exists.
         */
        noDocument, 
        /**
         * Set to an instance of a Document if there's a cached version of the
         * document.
         */
        document) {
        this.noDocument = noDocument;
        this.document = document;
    }
    DbRemoteDocument.store = 'remoteDocuments';
    return DbRemoteDocument;
}());
exports.DbRemoteDocument = DbRemoteDocument;
/**
 * An object to be stored in the 'targets' store in IndexedDb.
 *
 * This is based on and should be kept in sync with the proto used in the iOS
 * client.
 *
 * Each query the client listens to against the server is tracked on disk so
 * that the query can be efficiently resumed on restart.
 */
var DbTarget = /** @class */ (function () {
    function DbTarget(
        /**
         * An auto-generated sequential numeric identifier for the query.
         *
         * Queries are stored using their canonicalId as the key, but these
         * canonicalIds can be quite long so we additionally assign a unique
         * queryId which can be used by referenced data structures (e.g.
         * indexes) to minimize the on-disk cost.
         */
        targetId, 
        /**
         * The canonical string representing this query. This is not unique.
         */
        canonicalId, 
        /**
         * The last readTime received from the Watch Service for this query.
         *
         * This is the same value as TargetChange.read_time in the protos.
         */
        readTime, 
        /**
         * An opaque, server-assigned token that allows watching a query to be
         * resumed after disconnecting without retransmitting all the data
         * that matches the query. The resume token essentially identifies a
         * point in time from which the server should resume sending results.
         *
         * This is related to the snapshotVersion in that the resumeToken
         * effectively also encodes that value, but the resumeToken is opaque
         * and sometimes encodes additional information.
         *
         * A consequence of this is that the resumeToken should be used when
         * asking the server to reason about where this client is in the watch
         * stream, but the client should use the snapshotVersion for its own
         * purposes.
         *
         * This is the same value as TargetChange.resume_token in the protos.
         */
        resumeToken, 
        /**
         * A sequence number representing the last time this query was
         * listened to, used for garbage collection purposes.
         *
         * Conventionally this would be a timestamp value, but device-local
         * clocks are unreliable and they must be able to create new listens
         * even while disconnected. Instead this should be a monotonically
         * increasing number that's incremented on each listen call.
         *
         * This is different from the queryId since the queryId is an
         * immutable identifier assigned to the Query on first use while
         * lastListenSequenceNumber is updated every time the query is
         * listened to.
         */
        lastListenSequenceNumber, 
        /**
         * The query for this target.
         *
         * Because canonical ids are not unique we must store the actual query. We
         * use the proto to have an object we can persist without having to
         * duplicate translation logic to and from a `Query` object.
         */
        query) {
        this.targetId = targetId;
        this.canonicalId = canonicalId;
        this.readTime = readTime;
        this.resumeToken = resumeToken;
        this.lastListenSequenceNumber = lastListenSequenceNumber;
        this.query = query;
    }
    DbTarget.store = 'targets';
    /** Keys are automatically assigned via the targetId property. */
    DbTarget.keyPath = 'targetId';
    /** The name of the queryTargets index. */
    DbTarget.queryTargetsIndexName = 'queryTargetsIndex';
    /**
     * The index of all canonicalIds to the targets that they match. This is not
     * a unique mapping because canonicalId does not promise a unique name for all
     * possible queries, so we append the targetId to make the mapping unique.
     */
    DbTarget.queryTargetsKeyPath = ['canonicalId', 'targetId'];
    return DbTarget;
}());
exports.DbTarget = DbTarget;
/**
 * An object representing an association between a target and a document.
 * Stored in the targetDocument object store to store the documents tracked by a
 * particular target.
 */
var DbTargetDocument = /** @class */ (function () {
    function DbTargetDocument(
        /**
         * The targetId identifying a target.
         */
        targetId, 
        /**
         * The path to the document, as encoded in the key.
         */
        path) {
        this.targetId = targetId;
        this.path = path;
    }
    /** Name of the IndexedDb object store.  */
    DbTargetDocument.store = 'targetDocuments';
    /** Keys are automatically assigned via the targetId, path properties. */
    DbTargetDocument.keyPath = ['targetId', 'path'];
    /** The index name for the reverse index. */
    DbTargetDocument.documentTargetsIndex = 'documentTargetsIndex';
    /** We also need to create the reverse index for these properties. */
    DbTargetDocument.documentTargetsKeyPath = ['path', 'targetId'];
    return DbTargetDocument;
}());
exports.DbTargetDocument = DbTargetDocument;
/**
 * A record of global state tracked across all Targets, tracked separately
 * to avoid the need for extra indexes.
 *
 * This should be kept in-sync with the proto used in the iOS client.
 */
var DbTargetGlobal = /** @class */ (function () {
    function DbTargetGlobal(
        /**
         * The highest numbered target id across all targets.
         *
         * See DbTarget.targetId.
         */
        highestTargetId, 
        /**
         * The highest numbered lastListenSequenceNumber across all targets.
         *
         * See DbTarget.lastListenSequenceNumber.
         */
        highestListenSequenceNumber, 
        /**
         * A global snapshot version representing the last consistent snapshot we
         * received from the backend. This is monotonically increasing and any
         * snapshots received from the backend prior to this version (e.g. for
         * targets resumed with a resumeToken) should be suppressed (buffered)
         * until the backend has caught up to this snapshot version again. This
         * prevents our cache from ever going backwards in time.
         */
        lastRemoteSnapshotVersion) {
        this.highestTargetId = highestTargetId;
        this.highestListenSequenceNumber = highestListenSequenceNumber;
        this.lastRemoteSnapshotVersion = lastRemoteSnapshotVersion;
    }
    /**
     * The key string used for the single object that exists in the
     * DbTargetGlobal store.
     */
    DbTargetGlobal.key = 'targetGlobalKey';
    DbTargetGlobal.store = 'targetGlobal';
    return DbTargetGlobal;
}());
exports.DbTargetGlobal = DbTargetGlobal;
/**
 * The list of all IndexedDB stored used by the SDK. This is used when creating
 * transactions so that access across all stores is done atomically.
 */
exports.ALL_STORES = [
    DbMutationQueue.store,
    DbMutationBatch.store,
    DbDocumentMutation.store,
    DbRemoteDocument.store,
    DbTarget.store,
    DbOwner.store,
    DbTargetGlobal.store,
    DbTargetDocument.store
];

//# sourceMappingURL=indexeddb_schema.js.map
