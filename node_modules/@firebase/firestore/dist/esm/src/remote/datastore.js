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
import { maybeDocumentMap } from '../model/collections';
import { assert } from '../util/assert';
import { PersistentListenStream, PersistentWriteStream } from './persistent_stream';
/**
 * Datastore is a wrapper around the external Google Cloud Datastore grpc API,
 * which provides an interface that is more convenient for the rest of the
 * client SDK architecture to consume.
 */
var Datastore = /** @class */ (function () {
    function Datastore(databaseInfo, queue, connection, credentials, serializer, initialBackoffDelay) {
        this.databaseInfo = databaseInfo;
        this.queue = queue;
        this.connection = connection;
        this.credentials = credentials;
        this.serializer = serializer;
        this.initialBackoffDelay = initialBackoffDelay;
    }
    Datastore.prototype.newPersistentWriteStream = function () {
        return new PersistentWriteStream(this.databaseInfo, this.queue, this.connection, this.credentials, this.serializer, this.initialBackoffDelay);
    };
    Datastore.prototype.newPersistentWatchStream = function () {
        return new PersistentListenStream(this.databaseInfo, this.queue, this.connection, this.credentials, this.serializer, this.initialBackoffDelay);
    };
    Datastore.prototype.commit = function (mutations) {
        var _this = this;
        var params = {
            database: this.serializer.encodedDatabaseId,
            writes: mutations.map(function (m) { return _this.serializer.toMutation(m); })
        };
        return this.invokeRPC('Commit', params).then(function (response) {
            return _this.serializer.fromWriteResults(response.writeResults);
        });
    };
    Datastore.prototype.lookup = function (keys) {
        var _this = this;
        var params = {
            database: this.serializer.encodedDatabaseId,
            documents: keys.map(function (k) { return _this.serializer.toName(k); })
        };
        return this.invokeStreamingRPC('BatchGetDocuments', params).then(function (response) {
            var docs = maybeDocumentMap();
            response.forEach(function (proto) {
                var doc = _this.serializer.fromMaybeDocument(proto);
                docs = docs.insert(doc.key, doc);
            });
            var result = [];
            keys.forEach(function (key) {
                var doc = docs.get(key);
                assert(!!doc, 'Missing entity in write response for ' + key);
                result.push(doc);
            });
            return result;
        });
    };
    /** Gets an auth token and invokes the provided RPC. */
    Datastore.prototype.invokeRPC = function (rpcName, request) {
        var _this = this;
        // TODO(mikelehen): Retry (with backoff) on token failures?
        return this.credentials.getToken(/*forceRefresh=*/ false).then(function (token) {
            return _this.connection.invokeRPC(rpcName, request, token);
        });
    };
    /** Gets an auth token and invokes the provided RPC with streamed results. */
    Datastore.prototype.invokeStreamingRPC = function (rpcName, request) {
        var _this = this;
        // TODO(mikelehen): Retry (with backoff) on token failures?
        return this.credentials.getToken(/*forceRefresh=*/ false).then(function (token) {
            return _this.connection.invokeStreamingRPC(rpcName, request, token);
        });
    };
    return Datastore;
}());
export { Datastore };

//# sourceMappingURL=datastore.js.map
