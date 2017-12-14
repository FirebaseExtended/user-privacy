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
import { assert } from '../util/assert';
import { debug } from '../util/log';
import { MemoryMutationQueue } from './memory_mutation_queue';
import { MemoryQueryCache } from './memory_query_cache';
import { MemoryRemoteDocumentCache } from './memory_remote_document_cache';
var LOG_TAG = 'MemoryPersistence';
/**
 * A memory-backed instance of Persistence. Data is stored only in RAM and
 * not persisted across sessions.
 */
var MemoryPersistence = /** @class */ (function () {
    function MemoryPersistence() {
        /**
         * Note that these are retained here to make it easier to write tests
         * affecting both the in-memory and IndexedDB-backed persistence layers. Tests
         * can create a new LocalStore wrapping this Persistence instance and this
         * will make the in-memory persistence layer behave as if it were actually
         * persisting values.
         */
        this.mutationQueues = {};
        this.remoteDocumentCache = new MemoryRemoteDocumentCache();
        this.queryCache = new MemoryQueryCache();
        this.started = false;
    }
    MemoryPersistence.prototype.start = function () {
        assert(!this.started, 'MemoryPersistence double-started!');
        this.started = true;
        // No durable state to read on startup.
        return Promise.resolve();
    };
    MemoryPersistence.prototype.shutdown = function () {
        // No durable state to ensure is closed on shutdown.
        assert(this.started, 'MemoryPersistence shutdown without start!');
        this.started = false;
        return Promise.resolve();
    };
    MemoryPersistence.prototype.getMutationQueue = function (user) {
        var queue = this.mutationQueues[user.toKey()];
        if (!queue) {
            queue = new MemoryMutationQueue();
            this.mutationQueues[user.toKey()] = queue;
        }
        return queue;
    };
    MemoryPersistence.prototype.getQueryCache = function () {
        return this.queryCache;
    };
    MemoryPersistence.prototype.getRemoteDocumentCache = function () {
        return this.remoteDocumentCache;
    };
    MemoryPersistence.prototype.runTransaction = function (action, operation) {
        debug(LOG_TAG, 'Starting transaction:', action);
        return operation(new MemoryPersistenceTransaction()).toPromise();
    };
    return MemoryPersistence;
}());
export { MemoryPersistence };
/** Dummy class since memory persistence doesn't actually use transactions. */
var MemoryPersistenceTransaction = /** @class */ (function () {
    function MemoryPersistenceTransaction() {
    }
    return MemoryPersistenceTransaction;
}());

//# sourceMappingURL=memory_persistence.js.map
