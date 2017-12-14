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
var Deferred = /** @class */ (function () {
    function Deferred() {
        var _this = this;
        this.promise = new Promise(function (resolve, reject) {
            _this.resolve = resolve;
            _this.reject = reject;
        });
    }
    return Deferred;
}());
exports.Deferred = Deferred;
/**
 * Takes an array of values and sequences them using the promise (or value)
 * returned by the supplied callback. The callback for each item is called
 * after the promise is resolved for the previous item.
 * The function returns a promise which is resolved after the promise for
 * the last item is resolved.
 */
function sequence(values, fn, initialValue) {
    var result = Promise.resolve(initialValue);
    values.forEach(function (value) {
        result = result.then(function (lastResult) { return fn(value, lastResult); });
    });
    return result;
}
exports.sequence = sequence;

//# sourceMappingURL=promise.js.map
