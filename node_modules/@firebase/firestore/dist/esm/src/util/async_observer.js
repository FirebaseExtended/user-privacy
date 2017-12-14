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
/*
 * A wrapper implementation of Observer<T> that will dispatch events
 * asynchronously. To allow immediate silencing, a mute call is added which
 * causes events scheduled to no longer be raised.
 */
var AsyncObserver = /** @class */ (function () {
    function AsyncObserver(observer) {
        this.observer = observer;
        /**
         * When set to true, will not raise future events. Necessary to deal with
         * async detachment of listener.
         */
        this.muted = false;
    }
    AsyncObserver.prototype.next = function (value) {
        this.scheduleEvent(this.observer.next, value);
    };
    AsyncObserver.prototype.error = function (error) {
        this.scheduleEvent(this.observer.error, error);
    };
    AsyncObserver.prototype.mute = function () {
        this.muted = true;
    };
    AsyncObserver.prototype.scheduleEvent = function (eventHandler, event) {
        var _this = this;
        if (!this.muted) {
            setTimeout(function () {
                if (!_this.muted) {
                    eventHandler(event);
                }
            }, 0);
        }
    };
    return AsyncObserver;
}());
export { AsyncObserver };

//# sourceMappingURL=async_observer.js.map
