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
import { fail } from '../util/assert';
/**
 * PersistencePromise<> is essentially a re-implementation of Promise<> except
 * it has a .next() method instead of .then() and .next() and .catch() callbacks
 * are executed synchronously when a PersistencePromise resolves rather than
 * asynchronously (Promise<> implementations use setImmediate() or similar).
 *
 * This is necessary to interoperate with IndexedDB which will automatically
 * commit transactions if control is returned to the event loop without
 * synchronously initiating another operation on the transaction.
 *
 * NOTE: .then() and .catch() only allow a single consumer, unlike normal
 * Promises.
 */
var PersistencePromise = /** @class */ (function () {
    function PersistencePromise(callback) {
        var _this = this;
        // NOTE: next/catchCallback will always point to our own wrapper functions,
        // not the user's raw next() or catch() callbacks.
        this.nextCallback = null;
        this.catchCallback = null;
        // When the operation resolves, we'll set result or error and mark isDone.
        this.result = undefined;
        this.error = null;
        this.isDone = false;
        // Set to true when .then() or .catch() are called and prevents additional
        // chaining.
        this.callbackAttached = false;
        callback(function (value) {
            _this.isDone = true;
            _this.result = value;
            if (_this.nextCallback) {
                // value should be defined unless T is Void, but we can't express
                // that in the type system.
                _this.nextCallback(value);
            }
        }, function (error) {
            _this.isDone = true;
            _this.error = error;
            if (_this.catchCallback) {
                _this.catchCallback(error);
            }
        });
    }
    PersistencePromise.prototype.catch = function (fn) {
        return this.next(undefined, fn);
    };
    PersistencePromise.prototype.next = function (nextFn, catchFn) {
        var _this = this;
        if (this.callbackAttached) {
            fail('Called next() or catch() twice for PersistencePromise');
        }
        this.callbackAttached = true;
        if (this.isDone) {
            if (!this.error) {
                return this.wrapSuccess(nextFn, this.result);
            }
            else {
                return this.wrapFailure(catchFn, this.error);
            }
        }
        else {
            return new PersistencePromise(function (resolve, reject) {
                _this.nextCallback = function (value) {
                    _this.wrapSuccess(nextFn, value).next(resolve, reject);
                };
                _this.catchCallback = function (error) {
                    _this.wrapFailure(catchFn, error).next(resolve, reject);
                };
            });
        }
    };
    PersistencePromise.prototype.toPromise = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.next(resolve, reject);
        });
    };
    PersistencePromise.prototype.wrapUserFunction = function (fn) {
        try {
            var result = fn();
            if (result instanceof PersistencePromise) {
                return result;
            }
            else {
                return PersistencePromise.resolve(result);
            }
        }
        catch (e) {
            return PersistencePromise.reject(e);
        }
    };
    PersistencePromise.prototype.wrapSuccess = function (nextFn, value) {
        if (nextFn) {
            return this.wrapUserFunction(function () { return nextFn(value); });
        }
        else {
            // If there's no nextFn, then R must be the same as T but we
            // can't express that in the type system.
            return PersistencePromise.resolve(value);
        }
    };
    PersistencePromise.prototype.wrapFailure = function (catchFn, error) {
        if (catchFn) {
            return this.wrapUserFunction(function () { return catchFn(error); });
        }
        else {
            return PersistencePromise.reject(error);
        }
    };
    PersistencePromise.resolve = function (result) {
        return new PersistencePromise(function (resolve, reject) {
            resolve(result);
        });
    };
    PersistencePromise.reject = function (error) {
        return new PersistencePromise(function (resolve, reject) {
            reject(error);
        });
    };
    PersistencePromise.waitFor = function (all) {
        return all.reduce(function (promise, nextPromise, idx) {
            return promise.next(function () {
                return nextPromise;
            });
        }, PersistencePromise.resolve());
    };
    PersistencePromise.map = function (all) {
        var results = [];
        var first = true;
        // initial is ignored, so we can cheat on the type.
        var initial = PersistencePromise.resolve(null);
        return all
            .reduce(function (promise, nextPromise) {
            return promise.next(function (result) {
                if (!first) {
                    results.push(result);
                }
                first = false;
                return nextPromise;
            });
        }, initial)
            .next(function (result) {
            results.push(result);
            return results;
        });
    };
    return PersistencePromise;
}());
export { PersistencePromise };

//# sourceMappingURL=persistence_promise.js.map
