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
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { assert, fail } from '../util/assert';
import { Code, FirestoreError } from '../util/error';
export var DOCUMENT_KEY_NAME = '__name__';
/**
 * Path represents an ordered sequence of string segments.
 */
var Path = /** @class */ (function () {
    function Path(segments, offset, length) {
        this.init(segments, offset, length);
    }
    /**
     * An initialization method that can be called from outside the constructor.
     * We need this so that we can have a non-static construct method that returns
     * the polymorphic `this` type.
     */
    Path.prototype.init = function (segments, offset, length) {
        if (offset === undefined) {
            offset = 0;
        }
        else if (offset > segments.length) {
            fail('offset ' + offset + ' out of range ' + segments.length);
        }
        if (length === undefined) {
            length = segments.length - offset;
        }
        else if (length > segments.length - offset) {
            fail('length ' + length + ' out of range ' + (segments.length - offset));
        }
        this.segments = segments;
        this.offset = offset;
        this.len = length;
    };
    /**
     * Constructs a new instance of Path using the same concrete type as `this`.
     * We need this instead of using the normal constructor, because polymorphic
     * `this` doesn't work on static methods.
     */
    Path.prototype.construct = function (segments, offset, length) {
        var path = Object.create(Object.getPrototypeOf(this));
        path.init(segments, offset, length);
        return path;
    };
    Object.defineProperty(Path.prototype, "length", {
        get: function () {
            return this.len;
        },
        enumerable: true,
        configurable: true
    });
    Path.prototype.equals = function (other) {
        return Path.comparator(this, other) === 0;
    };
    Path.prototype.child = function (nameOrPath) {
        var segments = this.segments.slice(this.offset, this.limit());
        if (nameOrPath instanceof Path) {
            nameOrPath.forEach(function (segment) {
                segments.push(segment);
            });
        }
        else if (typeof nameOrPath === 'string') {
            segments.push(nameOrPath);
        }
        else {
            fail('Unknown parameter type for Path.child(): ' + nameOrPath);
        }
        return this.construct(segments);
    };
    /** The index of one past the last segment of the path. */
    Path.prototype.limit = function () {
        return this.offset + this.length;
    };
    Path.prototype.popFirst = function (size) {
        size = size === undefined ? 1 : size;
        assert(this.length >= size, "Can't call popFirst() with less segments");
        return this.construct(this.segments, this.offset + size, this.length - size);
    };
    Path.prototype.popLast = function () {
        assert(!this.isEmpty(), "Can't call popLast() on empty path");
        return this.construct(this.segments, this.offset, this.length - 1);
    };
    Path.prototype.firstSegment = function () {
        assert(!this.isEmpty(), "Can't call firstSegment() on empty path");
        return this.segments[this.offset];
    };
    Path.prototype.lastSegment = function () {
        assert(!this.isEmpty(), "Can't call lastSegment() on empty path");
        return this.segments[this.limit() - 1];
    };
    Path.prototype.get = function (index) {
        assert(index < this.length, 'Index out of range');
        return this.segments[this.offset + index];
    };
    Path.prototype.isEmpty = function () {
        return this.length === 0;
    };
    Path.prototype.isPrefixOf = function (other) {
        if (other.length < this.length) {
            return false;
        }
        for (var i = 0; i < this.length; i++) {
            if (this.get(i) !== other.get(i)) {
                return false;
            }
        }
        return true;
    };
    Path.prototype.forEach = function (fn) {
        for (var i = this.offset, end = this.limit(); i < end; i++) {
            fn(this.segments[i]);
        }
    };
    Path.prototype.toArray = function () {
        return this.segments.slice(this.offset, this.limit());
    };
    Path.comparator = function (p1, p2) {
        var len = Math.min(p1.length, p2.length);
        for (var i = 0; i < len; i++) {
            var left = p1.get(i);
            var right = p2.get(i);
            if (left < right)
                return -1;
            if (left > right)
                return 1;
        }
        if (p1.length < p2.length)
            return -1;
        if (p1.length > p2.length)
            return 1;
        return 0;
    };
    return Path;
}());
export { Path };
/**
 * A slash-separated path for navigating resources (documents and collections)
 * within Firestore.
 */
var ResourcePath = /** @class */ (function (_super) {
    __extends(ResourcePath, _super);
    function ResourcePath() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ResourcePath.prototype.canonicalString = function () {
        // NOTE: The client is ignorant of any path segments containing escape
        // sequences (e.g. __id123__) and just passes them through raw (they exist
        // for legacy reasons and should not be used frequently).
        return this.toArray().join('/');
    };
    ResourcePath.prototype.toString = function () {
        return this.canonicalString();
    };
    /**
     * Creates a resource path from the given slash-delimited string.
     */
    ResourcePath.fromString = function (path) {
        // NOTE: The client is ignorant of any path segments containing escape
        // sequences (e.g. __id123__) and just passes them through raw (they exist
        // for legacy reasons and should not be used frequently).
        if (path.indexOf('//') >= 0) {
            throw new FirestoreError(Code.INVALID_ARGUMENT, "Invalid path (" + path + "). Paths must not contain // in them.");
        }
        // We may still have an empty segment at the beginning or end if they had a
        // leading or trailing slash (which we allow).
        var segments = path.split('/').filter(function (segment) { return segment.length > 0; });
        return new ResourcePath(segments);
    };
    ResourcePath.EMPTY_PATH = new ResourcePath([]);
    return ResourcePath;
}(Path));
export { ResourcePath };
var identifierRegExp = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
/** A dot-separated path for navigating sub-objects within a document. */
var FieldPath = /** @class */ (function (_super) {
    __extends(FieldPath, _super);
    function FieldPath() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    /**
     * Returns true if the string could be used as a segment in a field path
     * without escaping.
     */
    FieldPath.isValidIdentifier = function (segment) {
        return identifierRegExp.test(segment);
    };
    FieldPath.prototype.canonicalString = function () {
        return this.toArray()
            .map(function (str) {
            str = str.replace('\\', '\\\\').replace('`', '\\`');
            if (!FieldPath.isValidIdentifier(str)) {
                str = '`' + str + '`';
            }
            return str;
        })
            .join('.');
    };
    FieldPath.prototype.toString = function () {
        return this.canonicalString();
    };
    /**
     * Returns true if this field references the key of a document.
     */
    FieldPath.prototype.isKeyField = function () {
        return this.length === 1 && this.get(0) === DOCUMENT_KEY_NAME;
    };
    /**
     * The field designating the key of a document.
     */
    FieldPath.keyField = function () {
        return new FieldPath([DOCUMENT_KEY_NAME]);
    };
    /**
     * Parses a field string from the given server-formatted string.
     *
     * - Splitting the empty string is not allowed (for now at least).
     * - Empty segments within the string (e.g. if there are two consecutive
     *   separators) are not allowed.
     *
     * TODO(b/37244157): we should make this more strict. Right now, it allows
     * non-identifier path components, even if they aren't escaped.
     */
    FieldPath.fromServerFormat = function (path) {
        var segments = [];
        var current = '';
        var i = 0;
        var addCurrentSegment = function () {
            if (current.length === 0) {
                throw new FirestoreError(Code.INVALID_ARGUMENT, "Invalid field path (" + path + "). Paths must not be empty, begin " +
                    "with '.', end with '.', or contain '..'");
            }
            segments.push(current);
            current = '';
        };
        var inBackticks = false;
        while (i < path.length) {
            var c = path[i];
            if (c === '\\') {
                if (i + 1 === path.length) {
                    throw new FirestoreError(Code.INVALID_ARGUMENT, 'Path has trailing escape character: ' + path);
                }
                var next = path[i + 1];
                if (!(next === '\\' || next === '.' || next === '`')) {
                    throw new FirestoreError(Code.INVALID_ARGUMENT, 'Path has invalid escape sequence: ' + path);
                }
                current += next;
                i += 2;
            }
            else if (c === '`') {
                inBackticks = !inBackticks;
                i++;
            }
            else if (c === '.' && !inBackticks) {
                addCurrentSegment();
                i++;
            }
            else {
                current += c;
                i++;
            }
        }
        addCurrentSegment();
        if (inBackticks) {
            throw new FirestoreError(Code.INVALID_ARGUMENT, 'Unterminated ` in path: ' + path);
        }
        return new FieldPath(segments);
    };
    FieldPath.EMPTY_PATH = new FieldPath([]);
    return FieldPath;
}(Path));
export { FieldPath };

//# sourceMappingURL=path.js.map
