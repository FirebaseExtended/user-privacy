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
import { Code, FirestoreError } from '../util/error';
import * as log from '../util/log';
import { AutoId } from '../util/misc';
import { IndexedDbMutationQueue } from './indexeddb_mutation_queue';
import { IndexedDbQueryCache } from './indexeddb_query_cache';
import { IndexedDbRemoteDocumentCache } from './indexeddb_remote_document_cache';
import { ALL_STORES, DbOwner } from './indexeddb_schema';
import { createOrUpgradeDb, SCHEMA_VERSION } from './indexeddb_schema';
import { LocalSerializer } from './local_serializer';
import { PersistencePromise } from './persistence_promise';
import { SimpleDb } from './simple_db';
var LOG_TAG = 'IndexedDbPersistence';
/** If the owner lease is older than 5 seconds, try to take ownership. */
var OWNER_LEASE_MAX_AGE_MS = 5000;
/** Refresh the owner lease every 4 seconds while owner. */
var OWNER_LEASE_REFRESH_INTERVAL_MS = 4000;
/** LocalStorage location to indicate a zombied ownerId (see class comment). */
var ZOMBIE_OWNER_LOCALSTORAGE_SUFFIX = 'zombiedOwnerId';
/** Error when the owner lease cannot be acquired or is lost. */
var EXISTING_OWNER_ERROR_MSG = 'There is another tab open with offline' +
    ' persistence enabled. Only one such tab is allowed at a time. The' +
    ' other tab must be closed or persistence must be disabled.';
var UNSUPPORTED_PLATFORM_ERROR_MSG = 'This platform is either missing' +
    ' IndexedDB or is known to have an incomplete implementation. Offline' +
    ' persistence has been disabled.';
/**
 * An IndexedDB-backed instance of Persistence. Data is stored persistently
 * across sessions.
 *
 * Currently the Firestore SDK only supports a single consumer of the database,
 * but browsers obviously support multiple tabs. IndexedDbPersistence ensures a
 * single consumer of the database via an "owner lease" stored in the database.
 *
 * On startup, IndexedDbPersistence assigns itself a random "ownerId" and writes
 * it to a special "owner" object in the database (if no entry exists already or
 * the current entry is expired). This owner lease is then verified inside every
 * transaction to ensure the lease has not been lost.
 *
 * If a tab opts not to acquire the owner lease (because there's an existing
 * non-expired owner) or loses the owner lease, IndexedDbPersistence enters a
 * failed state and all subsequent operations will automatically fail.
 *
 * The current owner regularly refreshes the owner lease with new timestamps to
 * prevent newly-opened tabs from taking over ownership.
 *
 * Additionally there is an optimization so that when a tab is closed, the owner
 * lease is released immediately (this is especially important to make sure that
 * a refreshed tab is able to immediately re-acquire the owner lease).
 * Unfortunately, IndexedDB cannot be reliably used in window.unload since it is
 * an asynchronous API. So in addition to attempting to give up the lease,
 * the owner writes its ownerId to a "zombiedOwnerId" entry in LocalStorage
 * which acts as an indicator that another tab should go ahead and take the
 * owner lease immediately regardless of the current lease timestamp.
 */
var IndexedDbPersistence = /** @class */ (function () {
    function IndexedDbPersistence(prefix, serializer) {
        this.ownerId = this.generateOwnerId();
        this.dbName = prefix + IndexedDbPersistence.MAIN_DATABASE;
        this.serializer = new LocalSerializer(serializer);
        this.localStoragePrefix = prefix;
    }
    IndexedDbPersistence.prototype.start = function () {
        var _this = this;
        if (!IndexedDbPersistence.isAvailable()) {
            this.persistenceError = new FirestoreError(Code.UNIMPLEMENTED, UNSUPPORTED_PLATFORM_ERROR_MSG);
            return Promise.reject(this.persistenceError);
        }
        assert(!this.started, 'IndexedDbPersistence double-started!');
        this.started = true;
        return SimpleDb.openOrCreate(this.dbName, SCHEMA_VERSION, createOrUpgradeDb)
            .then(function (db) {
            _this.simpleDb = db;
        })
            .then(function () { return _this.tryAcquireOwnerLease(); })
            .then(function () {
            _this.scheduleOwnerLeaseRefreshes();
            _this.attachWindowUnloadHook();
        });
    };
    IndexedDbPersistence.prototype.shutdown = function () {
        var _this = this;
        assert(this.started, 'IndexedDbPersistence shutdown without start!');
        this.started = false;
        this.detachWindowUnloadHook();
        this.stopOwnerLeaseRefreshes();
        return this.releaseOwnerLease().then(function () {
            _this.simpleDb.close();
        });
    };
    IndexedDbPersistence.prototype.getMutationQueue = function (user) {
        return IndexedDbMutationQueue.forUser(user, this.serializer);
    };
    IndexedDbPersistence.prototype.getQueryCache = function () {
        return new IndexedDbQueryCache(this.serializer);
    };
    IndexedDbPersistence.prototype.getRemoteDocumentCache = function () {
        return new IndexedDbRemoteDocumentCache(this.serializer);
    };
    IndexedDbPersistence.prototype.runTransaction = function (action, operation) {
        var _this = this;
        if (this.persistenceError) {
            return Promise.reject(this.persistenceError);
        }
        log.debug(LOG_TAG, 'Starting transaction:', action);
        // Do all transactions as readwrite against all object stores, since we
        // are the only reader/writer.
        return this.simpleDb.runTransaction('readwrite', ALL_STORES, function (txn) {
            // Verify that we still have the owner lease as part of every transaction.
            return _this.ensureOwnerLease(txn).next(function () { return operation(txn); });
        });
    };
    IndexedDbPersistence.isAvailable = function () {
        return SimpleDb.isAvailable();
    };
    /**
     * Generates a string used as a prefix when storing data in IndexedDB and
     * LocalStorage.
     */
    IndexedDbPersistence.buildStoragePrefix = function (databaseInfo) {
        // Use two different prefix formats:
        //
        //   * firestore / persistenceKey / projectID . databaseID / ...
        //   * firestore / persistenceKey / projectID / ...
        //
        // projectIDs are DNS-compatible names and cannot contain dots
        // so there's no danger of collisions.
        var database = databaseInfo.databaseId.projectId;
        if (!databaseInfo.databaseId.isDefaultDatabase) {
            database += '.' + databaseInfo.databaseId.database;
        }
        return 'firestore/' + databaseInfo.persistenceKey + '/' + database + '/';
    };
    /**
     * Acquires the owner lease if there's no valid owner. Else returns a rejected
     * promise.
     */
    IndexedDbPersistence.prototype.tryAcquireOwnerLease = function () {
        var _this = this;
        // NOTE: Don't use this.runTransaction, since it requires us to already
        // have the lease.
        return this.simpleDb.runTransaction('readwrite', [DbOwner.store], function (txn) {
            var store = txn.store(DbOwner.store);
            return store.get('owner').next(function (dbOwner) {
                if (!_this.validOwner(dbOwner)) {
                    var newDbOwner = new DbOwner(_this.ownerId, Date.now());
                    log.debug(LOG_TAG, 'No valid owner. Acquiring owner lease. Current owner:', dbOwner, 'New owner:', newDbOwner);
                    return store.put('owner', newDbOwner);
                }
                else {
                    log.debug(LOG_TAG, 'Valid owner already. Failing. Current owner:', dbOwner);
                    _this.persistenceError = new FirestoreError(Code.FAILED_PRECONDITION, EXISTING_OWNER_ERROR_MSG);
                    return PersistencePromise.reject(_this.persistenceError);
                }
            });
        });
    };
    /** Checks the owner lease and deletes it if we are the current owner. */
    IndexedDbPersistence.prototype.releaseOwnerLease = function () {
        var _this = this;
        // NOTE: Don't use this.runTransaction, since it requires us to already
        // have the lease.
        return this.simpleDb.runTransaction('readwrite', [DbOwner.store], function (txn) {
            var store = txn.store(DbOwner.store);
            return store.get('owner').next(function (dbOwner) {
                if (dbOwner !== null && dbOwner.ownerId === _this.ownerId) {
                    log.debug(LOG_TAG, 'Releasing owner lease.');
                    return store.delete('owner');
                }
                else {
                    return PersistencePromise.resolve();
                }
            });
        });
    };
    /**
     * Checks the owner lease and returns a rejected promise if we are not the
     * current owner. This should be included in every transaction to guard
     * against losing the owner lease.
     */
    IndexedDbPersistence.prototype.ensureOwnerLease = function (txn) {
        var _this = this;
        var store = txn.store(DbOwner.store);
        return store.get('owner').next(function (dbOwner) {
            if (dbOwner === null || dbOwner.ownerId !== _this.ownerId) {
                _this.persistenceError = new FirestoreError(Code.FAILED_PRECONDITION, EXISTING_OWNER_ERROR_MSG);
                return PersistencePromise.reject(_this.persistenceError);
            }
            else {
                return PersistencePromise.resolve();
            }
        });
    };
    /**
     * Returns true if the provided owner exists, has a recent timestamp, and
     * isn't zombied.
     *
     * NOTE: To determine if the owner is zombied, this method reads from
     * LocalStorage which could be mildly expensive.
     */
    IndexedDbPersistence.prototype.validOwner = function (dbOwner) {
        var now = Date.now();
        var minAcceptable = now - OWNER_LEASE_MAX_AGE_MS;
        var maxAcceptable = now;
        if (dbOwner === null) {
            return false; // no owner.
        }
        else if (dbOwner.leaseTimestampMs < minAcceptable) {
            return false; // owner lease has expired.
        }
        else if (dbOwner.leaseTimestampMs > maxAcceptable) {
            log.error('Persistence owner-lease is in the future. Discarding.', dbOwner);
            return false;
        }
        else if (dbOwner.ownerId === this.getZombiedOwnerId()) {
            return false; // owner's tab closed.
        }
        else {
            return true;
        }
    };
    /**
     * Schedules a recurring timer to update the owner lease timestamp to prevent
     * other tabs from taking the lease.
     */
    IndexedDbPersistence.prototype.scheduleOwnerLeaseRefreshes = function () {
        var _this = this;
        // NOTE: This doesn't need to be scheduled on the async queue and doing so
        // would increase the chances of us not refreshing on time if the queue is
        // backed up for some reason.
        this.ownerLeaseRefreshHandle = setInterval(function () {
            var txResult = _this.runTransaction('Refresh owner timestamp', function (txn) {
                // NOTE: We don't need to validate the current owner contents, since
                // runTransaction does that automatically.
                var store = txn.store(DbOwner.store);
                return store.put('owner', new DbOwner(_this.ownerId, Date.now()));
            });
            txResult.catch(function (reason) {
                // Probably means we lost the lease. Report the error and stop trying to
                // refresh the lease.
                log.error(reason);
                _this.stopOwnerLeaseRefreshes();
            });
        }, OWNER_LEASE_REFRESH_INTERVAL_MS);
    };
    IndexedDbPersistence.prototype.stopOwnerLeaseRefreshes = function () {
        if (this.ownerLeaseRefreshHandle) {
            clearInterval(this.ownerLeaseRefreshHandle);
            this.ownerLeaseRefreshHandle = null;
        }
    };
    /**
     * Attaches a window.unload handler that will synchronously write our
     * ownerId to a "zombie owner id" location in localstorage. This can be used
     * by tabs trying to acquire the lease to determine that the lease should be
     * acquired immediately even if the timestamp is recent. This is particularly
     * important for the refresh case (so the tab correctly re-acquires the owner
     * lease). LocalStorage is used for this rather than IndexedDb because it is
     * a synchronous API and so can be used reliably from an unload handler.
     */
    IndexedDbPersistence.prototype.attachWindowUnloadHook = function () {
        var _this = this;
        this.windowUnloadHandler = function () {
            // Record that we're zombied.
            _this.setZombiedOwnerId(_this.ownerId);
            // Attempt graceful shutdown (including releasing our owner lease), but
            // there's no guarantee it will complete.
            _this.shutdown();
        };
        window.addEventListener('unload', this.windowUnloadHandler);
    };
    IndexedDbPersistence.prototype.detachWindowUnloadHook = function () {
        if (this.windowUnloadHandler) {
            window.removeEventListener('unload', this.windowUnloadHandler);
            this.windowUnloadHandler = null;
        }
    };
    /**
     * Returns any recorded "zombied owner" (i.e. a previous owner that became
     * zombied due to their tab closing) from LocalStorage, or null if no such
     * record exists.
     */
    IndexedDbPersistence.prototype.getZombiedOwnerId = function () {
        try {
            var zombiedOwnerId = window.localStorage.getItem(this.zombiedOwnerLocalStorageKey());
            log.debug(LOG_TAG, 'Zombied ownerID from LocalStorage:', zombiedOwnerId);
            return zombiedOwnerId;
        }
        catch (e) {
            // Gracefully handle if LocalStorage isn't available / working.
            log.error(LOG_TAG, 'Failed to get zombie owner id.', e);
            return null;
        }
    };
    /**
     * Records a zombied owner (an owner that had its tab closed) in LocalStorage
     * or, if passed null, deletes any recorded zombied owner.
     */
    IndexedDbPersistence.prototype.setZombiedOwnerId = function (zombieOwnerId) {
        try {
            if (zombieOwnerId === null) {
                window.localStorage.removeItem(this.zombiedOwnerLocalStorageKey());
            }
            else {
                window.localStorage.setItem(this.zombiedOwnerLocalStorageKey(), zombieOwnerId);
            }
        }
        catch (e) {
            // Gracefully handle if LocalStorage isn't available / working.
            log.error(LOG_TAG, 'Failed to set zombie owner id.', e);
        }
    };
    IndexedDbPersistence.prototype.zombiedOwnerLocalStorageKey = function () {
        return this.localStoragePrefix + ZOMBIE_OWNER_LOCALSTORAGE_SUFFIX;
    };
    IndexedDbPersistence.prototype.generateOwnerId = function () {
        // For convenience, just use an AutoId.
        return AutoId.newId();
    };
    /**
     * The name of the main (and currently only) IndexedDB database. this name is
     * appended to the prefix provided to the IndexedDbPersistence constructor.
     */
    IndexedDbPersistence.MAIN_DATABASE = 'main';
    return IndexedDbPersistence;
}());
export { IndexedDbPersistence };

//# sourceMappingURL=indexeddb_persistence.js.map
