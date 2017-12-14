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
/* tslint:disable:no-console */
import { SDK_VERSION } from '../core/version';
import { PlatformSupport } from '../platform/platform';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["ERROR"] = 1] = "ERROR";
    LogLevel[LogLevel["SILENT"] = 2] = "SILENT";
})(LogLevel || (LogLevel = {}));
var logLevel = LogLevel.ERROR;
// Helper methods are needed because variables can't be exported as read/write
export function getLogLevel() {
    return logLevel;
}
export function setLogLevel(newLevel) {
    logLevel = newLevel;
}
export function debug(tag, msg) {
    var obj = [];
    for (var _i = 2; _i < arguments.length; _i++) {
        obj[_i - 2] = arguments[_i];
    }
    if (logLevel <= LogLevel.DEBUG) {
        var time = new Date().toISOString();
        var args = obj.map(argToString);
        console.log.apply(console, ["Firestore (" + SDK_VERSION + ") " + time + " [" + tag + "]: " + msg].concat(args));
    }
}
export function error(msg) {
    var obj = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        obj[_i - 1] = arguments[_i];
    }
    if (logLevel <= LogLevel.ERROR) {
        var time = new Date().toISOString();
        var args = obj.map(argToString);
        console.error.apply(console, ["Firestore (" + SDK_VERSION + ") " + time + ": " + msg].concat(args));
    }
}
/**
 * Converts an additional log parameter to a string representation.
 */
function argToString(obj) {
    if (typeof obj === 'string') {
        return obj;
    }
    else {
        var platform = PlatformSupport.getPlatform();
        try {
            return platform.formatJSON(obj);
        }
        catch (e) {
            // Converting to JSON failed, just log the object directly
            return obj;
        }
    }
}

//# sourceMappingURL=log.js.map
