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
import { assert, fail } from './assert';
import * as log from './log';
import { Deferred } from './promise';
import { Code, FirestoreError } from './error';
var AsyncQueue = /** @class */ (function () {
    function AsyncQueue() {
        // The last promise in the queue.
        this.tail = Promise.resolve();
        // A list with timeout handles and their respective deferred promises.
        // Contains an entry for each operation that is queued to run in the future
        // (i.e. it has a delay that has not yet elapsed). Prior to cleanup, this list
        // may also contain entries that have already been run (in which case `handle` is
        // null).
        this.delayedOperations = [];
        // The number of operations that are queued to be run in the future (i.e. they
        // have a delay that has not yet elapsed). Unlike `delayedOperations`, this
        // is guaranteed to only contain operations that have not yet been run.
        //
        // Visible for testing.
        this.delayedOperationsCount = 0;
        // Flag set while there's an outstanding AsyncQueue operation, used for
        // assertion sanity-checks.
        this.operationInProgress = false;
    }
    /**
     * Adds a new operation to the queue. Returns a promise that will be resolved
     * when the promise returned by the new operation is (with its value).
     *
     * Can optionally specify a delay (in milliseconds) to wait before queuing the
     * operation.
     */
    AsyncQueue.prototype.schedule = function (op, delay) {
        var _this = this;
        if (this.failure) {
            fail('AsyncQueue is already failed: ' +
                (this.failure.stack || this.failure.message));
        }
        if ((delay || 0) > 0) {
            this.delayedOperationsCount++;
            var delayedOp_1 = {
                handle: null,
                op: op,
                deferred: new Deferred()
            };
            delayedOp_1.handle = setTimeout(function () {
                _this.scheduleInternal(function () {
                    return delayedOp_1.op().then(function (result) {
                        delayedOp_1.deferred.resolve(result);
                    });
                });
                delayedOp_1.handle = null;
                _this.delayedOperationsCount--;
                if (_this.delayedOperationsCount === 0) {
                    _this.delayedOperations = [];
                }
            }, delay);
            this.delayedOperations.push(delayedOp_1);
            return delayedOp_1.deferred.promise;
        }
        else {
            return this.scheduleInternal(op);
        }
    };
    AsyncQueue.prototype.scheduleInternal = function (op) {
        var _this = this;
        this.tail = this.tail.then(function () {
            _this.operationInProgress = true;
            return op()
                .catch(function (error) {
                _this.failure = error;
                _this.operationInProgress = false;
                var message = error.stack || error.message || '';
                log.error('INTERNAL UNHANDLED ERROR: ', message);
                // Escape the promise chain and throw the error globally so that
                // e.g. any global crash reporting library detects and reports it.
                // (but not for simulated errors in our tests since this breaks mocha)
                if (message.indexOf('Firestore Test Simulated Error') < 0) {
                    setTimeout(function () {
                        throw error;
                    }, 0);
                }
                // Re-throw the error so that this.tail becomes a rejected Promise and
                // all further attempts to chain (via .then) will just short-circuit
                // and return the rejected Promise.
                throw error;
            })
                .then(function () {
                _this.operationInProgress = false;
            });
        });
        return this.tail;
    };
    /**
     * Verifies there's an operation currently in-progress on the AsyncQueue.
     * Unfortunately we can't verify that the running code is in the promise chain
     * of that operation, so this isn't a foolproof check, but it should be enough
     * to catch some bugs.
     */
    AsyncQueue.prototype.verifyOperationInProgress = function () {
        assert(this.operationInProgress, 'verifyOpInProgress() called when no op in progress on this queue.');
    };
    /**
     * Waits until all currently scheduled tasks are finished executing. Tasks
     * scheduled with a delay can be rejected or queued for immediate execution.
     */
    AsyncQueue.prototype.drain = function (executeDelayedTasks) {
        var _this = this;
        this.delayedOperations.forEach(function (entry) {
            if (entry.handle) {
                clearTimeout(entry.handle);
                if (executeDelayedTasks) {
                    _this.scheduleInternal(entry.op).then(entry.deferred.resolve, entry.deferred.reject);
                }
                else {
                    entry.deferred.reject(new FirestoreError(Code.CANCELLED, 'Operation cancelled by shutdown'));
                }
            }
        });
        this.delayedOperations = [];
        this.delayedOperationsCount = 0;
        return this.schedule(function () { return Promise.resolve(); });
    };
    return AsyncQueue;
}());
export { AsyncQueue };

//# sourceMappingURL=async_queue.js.map
