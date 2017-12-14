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
import { PersistencePromise } from './persistence_promise';
var LOG_TAG = 'SimpleDb';
/**
 * Provides a wrapper around IndexedDb with a simplified interface that uses
 * Promise-like return values to chain operations. Real promises cannot be used
 * since .then() continuations are executed asynchronously (e.g. via
 * .setImmediate), which would cause IndexedDB to end the transaction.
 * See PersistencePromise for more details.
 */
var SimpleDb = /** @class */ (function () {
    function SimpleDb(db) {
        this.db = db;
    }
    /** Opens the specified database, creating or upgrading it if necessary. */
    SimpleDb.openOrCreate = function (name, version, runUpgrade) {
        assert(SimpleDb.isAvailable(), 'IndexedDB not supported in current environment.');
        debug(LOG_TAG, 'Opening database:', name);
        return new PersistencePromise(function (resolve, reject) {
            // TODO(mikelehen): Investigate browser compatibility.
            // https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
            // suggests IE9 and older WebKit browsers handle upgrade
            // differently.
            var request = window.indexedDB.open(name, version);
            request.onsuccess = function (event) {
                var db = event.target.result;
                resolve(new SimpleDb(db));
            };
            request.onerror = function (event) {
                reject(event.target.error);
            };
            request.onupgradeneeded = function (event) {
                debug(LOG_TAG, 'Database "' + name + '" requires upgrade from version:', event.oldVersion);
                // TODO(mikelehen): If/when we need to do an actual data
                // migration, we'll want to wrap db in a SimpleDb and have the
                // runUpgrade function return a PersistencePromise, since we'll
                // likely need to do async reads and writes. For now we're
                // cheating and just passing the raw IndexedDB in, since
                // createObjectStore(), etc. are synchronous.
                var db = event.target.result;
                runUpgrade(db, event.oldVersion);
            };
        }).toPromise();
    };
    /** Deletes the specified database. */
    SimpleDb.delete = function (name) {
        debug(LOG_TAG, 'Removing database:', name);
        return wrapRequest(window.indexedDB.deleteDatabase(name)).toPromise();
    };
    /** Returns true if IndexedDB is available in the current environment. */
    SimpleDb.isAvailable = function () {
        if (typeof window === 'undefined' || window.indexedDB == null) {
            return false;
        }
        // We extensively use indexed array values and compound keys,
        // which IE and Edge do not support. However, they still have indexedDB
        // defined on the window, so we need to check for them here and make sure
        // to return that persistence is not enabled for those browsers.
        // For tracking support of this feature, see here:
        // https://developer.microsoft.com/en-us/microsoft-edge/platform/status/indexeddbarraysandmultientrysupport/
        // Check the UA string to find out the browser.
        var ua = window.navigator.userAgent;
        // IE 10
        // ua = 'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)';
        // IE 11
        // ua = 'Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko';
        // Edge
        // ua = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML,
        // like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0';
        if (ua.indexOf('MSIE ') > 0 ||
            ua.indexOf('Trident/') > 0 ||
            ua.indexOf('Edge/') > 0) {
            return false;
        }
        else {
            return true;
        }
    };
    SimpleDb.prototype.runTransaction = function (mode, objectStores, transactionFn) {
        var transaction = new SimpleDbTransaction(this.db, mode, objectStores);
        var transactionFnResult = transactionFn(transaction)
            .catch(function (error) {
            // Abort the transaction if there was an
            // error.
            transaction.abort();
            return PersistencePromise.reject(error);
        })
            .toPromise();
        // Wait for the transaction to complete (i.e. IndexedDb's onsuccess event to
        // fire), but still return the original transactionFnResult back to the
        // caller.
        return transaction.completionPromise.then(function () { return transactionFnResult; });
    };
    SimpleDb.prototype.close = function () {
        this.db.close();
    };
    return SimpleDb;
}());
export { SimpleDb };
/**
 * A controller for iterating over a key range or index. It allows an iterate
 * callback to delete the currently-referenced object, or jump to a new key
 * within the key range or index.
 */
var IterationController = /** @class */ (function () {
    function IterationController(dbCursor) {
        this.dbCursor = dbCursor;
        this.shouldStop = false;
        this.nextKey = null;
    }
    Object.defineProperty(IterationController.prototype, "isDone", {
        get: function () {
            return this.shouldStop;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(IterationController.prototype, "skipToKey", {
        get: function () {
            return this.nextKey;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(IterationController.prototype, "cursor", {
        set: function (value) {
            this.dbCursor = value;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * This function can be called to stop iteration at any point.
     */
    IterationController.prototype.done = function () {
        this.shouldStop = true;
    };
    /**
     * This function can be called to skip to that next key, which could be
     * an index or a primary key.
     */
    IterationController.prototype.skip = function (key) {
        this.nextKey = key;
    };
    /**
     * Delete the current cursor value from the object store.
     *
     * NOTE: You CANNOT do this with a keysOnly query.
     */
    IterationController.prototype.delete = function () {
        return wrapRequest(this.dbCursor.delete());
    };
    return IterationController;
}());
export { IterationController };
/**
 * Wraps an IDBTransaction and exposes a store() method to get a handle to a
 * specific object store.
 */
var SimpleDbTransaction = /** @class */ (function () {
    function SimpleDbTransaction(db, mode, objectStoresNames) {
        var _this = this;
        this.aborted = false;
        this.transaction = db.transaction(objectStoresNames, mode);
        this.completionPromise = new Promise(function (resolve, reject) {
            // We consider aborting to be "normal" and just resolve the promise.
            // May need to revisit if/when we actually need to abort transactions.
            _this.transaction.onabort = _this.transaction.oncomplete = function (event) {
                resolve();
            };
            _this.transaction.onerror = function (event) {
                reject(event.target.error);
            };
        });
    }
    SimpleDbTransaction.prototype.abort = function () {
        if (!this.aborted) {
            debug(LOG_TAG, 'Aborting transaction.');
            this.aborted = true;
            this.transaction.abort();
        }
    };
    /**
     * Returns a SimpleDbStore<KeyType, ValueType> for the specified store. All
     * operations performed on the SimpleDbStore happen within the context of this
     * transaction and it cannot be used anymore once the transaction is
     * completed.
     *
     * Note that we can't actually enforce that the KeyType and ValueType are
     * correct, but they allow type safety through the rest of the consuming code.
     */
    SimpleDbTransaction.prototype.store = function (storeName) {
        var store = this.transaction.objectStore(storeName);
        assert(!!store, 'Object store not part of transaction: ' + storeName);
        return new SimpleDbStore(store);
    };
    return SimpleDbTransaction;
}());
export { SimpleDbTransaction };
/**
 * A wrapper around an IDBObjectStore providing an API that:
 *
 * 1) Has generic KeyType / ValueType parameters to provide strongly-typed
 * methods for acting against the object store.
 * 2) Deals with IndexedDB's onsuccess / onerror event callbacks, making every
 * method return a PersistencePromise instead.
 * 3) Provides a higher-level API to avoid needing to do excessive wrapping of
 * intermediate IndexedDB types (IDBCursorWithValue, etc.)
 */
var SimpleDbStore = /** @class */ (function () {
    function SimpleDbStore(store) {
        this.store = store;
    }
    SimpleDbStore.prototype.put = function (keyOrValue, value) {
        var request;
        if (value !== undefined) {
            debug(LOG_TAG, 'PUT', this.store.name, keyOrValue, value);
            request = this.store.put(value, keyOrValue);
        }
        else {
            debug(LOG_TAG, 'PUT', this.store.name, '<auto-key>', keyOrValue);
            request = this.store.put(keyOrValue);
        }
        return wrapRequest(request);
    };
    /**
     * Gets the object with the specified key from the specified store, or null
     * if no object exists with the specified key.
     *
     * @key The key of the object to get.
     * @return The object with the specified key or null if no object exists.
     */
    SimpleDbStore.prototype.get = function (key) {
        var _this = this;
        var request = this.store.get(key);
        // tslint:disable-next-line:no-any We're doing an unsafe cast to ValueType.
        return wrapRequest(request).next(function (result) {
            // Normalize nonexistence to null.
            if (result === undefined) {
                result = null;
            }
            debug(LOG_TAG, 'GET', _this.store.name, key, result);
            return result;
        });
    };
    SimpleDbStore.prototype.delete = function (key) {
        debug(LOG_TAG, 'DELETE', this.store.name, key);
        var request = this.store.delete(key);
        return wrapRequest(request);
    };
    SimpleDbStore.prototype.loadAll = function (indexOrRange, range) {
        var cursor = this.cursor(this.options(indexOrRange, range));
        var results = [];
        return this.iterateCursor(cursor, function (key, value) {
            results.push(value);
        }).next(function () {
            return results;
        });
    };
    SimpleDbStore.prototype.deleteAll = function (indexOrRange, range) {
        debug(LOG_TAG, 'DELETE ALL', this.store.name);
        var options = this.options(indexOrRange, range);
        options.keysOnly = false;
        var cursor = this.cursor(options);
        return this.iterateCursor(cursor, function (key, value, control) {
            // NOTE: Calling delete() on a cursor is documented as more efficient than
            // calling delete() on an object store with a single key
            // (https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/delete),
            // however, this requires us *not* to use a keysOnly cursor
            // (https://developer.mozilla.org/en-US/docs/Web/API/IDBCursor/delete). We
            // may want to compare the performance of each method.
            return control.delete();
        });
    };
    SimpleDbStore.prototype.iterate = function (optionsOrCallback, callback) {
        var options;
        if (!callback) {
            options = {};
            callback = optionsOrCallback;
        }
        else {
            options = optionsOrCallback;
        }
        var cursor = this.cursor(options);
        return this.iterateCursor(cursor, callback);
    };
    SimpleDbStore.prototype.iterateCursor = function (cursorRequest, fn) {
        var results = [];
        return new PersistencePromise(function (resolve, reject) {
            cursorRequest.onerror = function (event) {
                reject(event.target.error);
            };
            cursorRequest.onsuccess = function (event) {
                var cursor = event.target.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                var controller = new IterationController(cursor);
                var userResult = fn(cursor.primaryKey, cursor.value, controller);
                if (userResult instanceof PersistencePromise) {
                    results.push(userResult);
                }
                if (controller.isDone) {
                    resolve();
                }
                else if (controller.skipToKey === null) {
                    cursor.continue();
                }
                else {
                    cursor.continue(controller.skipToKey);
                }
            };
        }).next(function () {
            return PersistencePromise.waitFor(results);
        });
    };
    SimpleDbStore.prototype.options = function (indexOrRange, range) {
        var indexName = undefined;
        if (indexOrRange !== undefined) {
            if (typeof indexOrRange === 'string') {
                indexName = indexOrRange;
            }
            else {
                assert(range === undefined, '3rd argument must not be defined if 2nd is a range.');
                range = indexOrRange;
            }
        }
        return { index: indexName, range: range };
    };
    SimpleDbStore.prototype.cursor = function (options) {
        var direction = 'next';
        if (options.reverse) {
            direction = 'prev';
        }
        if (options.index) {
            var index = this.store.index(options.index);
            if (options.keysOnly) {
                return index.openKeyCursor(options.range, direction);
            }
            else {
                return index.openCursor(options.range, direction);
            }
        }
        else {
            return this.store.openCursor(options.range, direction);
        }
    };
    return SimpleDbStore;
}());
export { SimpleDbStore };
/**
 * Wraps an IDBRequest in a PersistencePromise, using the onsuccess / onerror
 * handlers to resolve / reject the PersistencePromise as appropriate.
 */
function wrapRequest(request) {
    return new PersistencePromise(function (resolve, reject) {
        request.onsuccess = function (event) {
            var result = event.target.result;
            resolve(result);
        };
        request.onerror = function (event) {
            reject(event.target.error);
        };
    });
}

//# sourceMappingURL=simple_db.js.map
