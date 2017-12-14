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
var document_key_1 = require("./document_key");
var Document = /** @class */ (function () {
    function Document(key, version, data, options) {
        this.key = key;
        this.version = version;
        this.data = data;
        this.hasLocalMutations = options.hasLocalMutations;
    }
    Document.prototype.field = function (path) {
        return this.data.field(path);
    };
    Document.prototype.fieldValue = function (path) {
        var field = this.field(path);
        return field ? field.value() : undefined;
    };
    Document.prototype.value = function () {
        return this.data.value();
    };
    Document.prototype.equals = function (other) {
        return (other instanceof Document &&
            this.key.equals(other.key) &&
            this.version.equals(other.version) &&
            this.data.equals(other.data) &&
            this.hasLocalMutations === other.hasLocalMutations);
    };
    Document.prototype.toString = function () {
        return ("Document(" + this.key + ", " + this.version + ", " + this.data.toString() + ", " +
            ("{hasLocalMutations: " + this.hasLocalMutations + "})"));
    };
    Document.compareByKey = function (d1, d2) {
        return document_key_1.DocumentKey.comparator(d1.key, d2.key);
    };
    Document.compareByField = function (field, d1, d2) {
        var v1 = d1.field(field);
        var v2 = d2.field(field);
        if (v1 !== undefined && v2 !== undefined) {
            return v1.compareTo(v2);
        }
        else {
            return assert_1.fail("Trying to compare documents on fields that don't exist");
        }
    };
    return Document;
}());
exports.Document = Document;
/**
 * A class representing a deleted document.
 * Version is set to 0 if we don't point to any specific time, otherwise it
 * denotes time we know it didn't exist at.
 */
var NoDocument = /** @class */ (function () {
    function NoDocument(key, version) {
        this.key = key;
        this.version = version;
    }
    NoDocument.prototype.toString = function () {
        return "NoDocument(" + this.key + ", " + this.version + ")";
    };
    NoDocument.prototype.equals = function (other) {
        return (other && other.version.equals(this.version) && other.key.equals(this.key));
    };
    NoDocument.compareByKey = function (d1, d2) {
        return document_key_1.DocumentKey.comparator(d1.key, d2.key);
    };
    return NoDocument;
}());
exports.NoDocument = NoDocument;

//# sourceMappingURL=document.js.map
