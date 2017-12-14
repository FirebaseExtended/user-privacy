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
var path_1 = require("./path");
var DocumentKey = /** @class */ (function () {
    function DocumentKey(path) {
        this.path = path;
        assert_1.assert(DocumentKey.isDocumentKey(path), 'Invalid DocumentKey with an odd number of segments: ' +
            path.toArray().join('/'));
    }
    DocumentKey.prototype.equals = function (other) {
        return (other !== null && path_1.ResourcePath.comparator(this.path, other.path) === 0);
    };
    DocumentKey.prototype.toString = function () {
        return this.path.toString();
    };
    DocumentKey.comparator = function (k1, k2) {
        return path_1.ResourcePath.comparator(k1.path, k2.path);
    };
    DocumentKey.isDocumentKey = function (path) {
        return path.length % 2 === 0;
    };
    /**
     * Creates and returns a new document key with the given segments.
     *
     * @param path The segments of the path to the document
     * @return A new instance of DocumentKey
     */
    DocumentKey.fromSegments = function (segments) {
        return new DocumentKey(new path_1.ResourcePath(segments.slice()));
    };
    /**
     * Creates and returns a new document key using '/' to split the string into
     * segments.
     *
     * @param path The slash-separated path string to the document
     * @return A new instance of DocumentKey
     */
    DocumentKey.fromPathString = function (path) {
        return new DocumentKey(path_1.ResourcePath.fromString(path));
    };
    DocumentKey.EMPTY = new DocumentKey(new path_1.ResourcePath([]));
    return DocumentKey;
}());
exports.DocumentKey = DocumentKey;

//# sourceMappingURL=document_key.js.map
