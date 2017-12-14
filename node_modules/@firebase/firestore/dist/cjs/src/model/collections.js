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
var sorted_map_1 = require("../util/sorted_map");
var sorted_set_1 = require("../util/sorted_set");
var document_key_1 = require("./document_key");
var EMPTY_MAYBE_DOCUMENT_MAP = new sorted_map_1.SortedMap(document_key_1.DocumentKey.comparator);
function maybeDocumentMap() {
    return EMPTY_MAYBE_DOCUMENT_MAP;
}
exports.maybeDocumentMap = maybeDocumentMap;
var EMPTY_DOCUMENT_MAP = new sorted_map_1.SortedMap(document_key_1.DocumentKey.comparator);
function documentMap() {
    return EMPTY_DOCUMENT_MAP;
}
exports.documentMap = documentMap;
var EMPTY_DOCUMENT_VERSION_MAP = new sorted_map_1.SortedMap(document_key_1.DocumentKey.comparator);
function documentVersionMap() {
    return EMPTY_DOCUMENT_VERSION_MAP;
}
exports.documentVersionMap = documentVersionMap;
var EMPTY_DOCUMENT_KEY_SET = new sorted_set_1.SortedSet(document_key_1.DocumentKey.comparator);
function documentKeySet() {
    return EMPTY_DOCUMENT_KEY_SET;
}
exports.documentKeySet = documentKeySet;

//# sourceMappingURL=collections.js.map
