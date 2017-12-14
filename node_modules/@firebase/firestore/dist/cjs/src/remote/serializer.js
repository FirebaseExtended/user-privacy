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
var blob_1 = require("../api/blob");
var geo_point_1 = require("../api/geo_point");
var database_info_1 = require("../core/database_info");
var query_1 = require("../core/query");
var snapshot_version_1 = require("../core/snapshot_version");
var timestamp_1 = require("../core/timestamp");
var query_data_1 = require("../local/query_data");
var document_1 = require("../model/document");
var document_key_1 = require("../model/document_key");
var fieldValue = require("../model/field_value");
var mutation_1 = require("../model/mutation");
var path_1 = require("../model/path");
var assert_1 = require("../util/assert");
var error_1 = require("../util/error");
var obj = require("../util/obj");
var typeUtils = require("../util/types");
var existence_filter_1 = require("./existence_filter");
var rpc_error_1 = require("./rpc_error");
var watch_change_1 = require("./watch_change");
var DIRECTIONS = (function () {
    var dirs = {};
    dirs[query_1.Direction.ASCENDING.name] = 'ASCENDING';
    dirs[query_1.Direction.DESCENDING.name] = 'DESCENDING';
    return dirs;
})();
var OPERATORS = (function () {
    var ops = {};
    ops[query_1.RelationOp.LESS_THAN.name] = 'LESS_THAN';
    ops[query_1.RelationOp.LESS_THAN_OR_EQUAL.name] = 'LESS_THAN_OR_EQUAL';
    ops[query_1.RelationOp.GREATER_THAN.name] = 'GREATER_THAN';
    ops[query_1.RelationOp.GREATER_THAN_OR_EQUAL.name] = 'GREATER_THAN_OR_EQUAL';
    ops[query_1.RelationOp.EQUAL.name] = 'EQUAL';
    return ops;
})();
function assertPresent(value, description) {
    assert_1.assert(!typeUtils.isNullOrUndefined(value), description + ' is missing');
}
function parseInt64(value) {
    // TODO(bjornick): Handle int64 greater than 53 bits.
    if (typeof value === 'number') {
        return value;
    }
    else if (typeof value === 'string') {
        return parseInt(value, 10);
    }
    else {
        return assert_1.fail("can't parse " + value);
    }
}
/**
 * Generates JsonObject values for the Datastore API suitable for sending to
 * either GRPC stub methods or via the JSON/HTTP REST API.
 * TODO(klimt): We can remove the databaseId argument if we keep the full
 * resource name in documents.
 */
var JsonProtoSerializer = /** @class */ (function () {
    function JsonProtoSerializer(databaseId, options) {
        this.databaseId = databaseId;
        this.options = options;
    }
    JsonProtoSerializer.prototype.emptyByteString = function () {
        if (this.options.useProto3Json) {
            return '';
        }
        else {
            return new Uint8Array(0);
        }
    };
    JsonProtoSerializer.prototype.unsafeCastProtoByteString = function (byteString) {
        // byteStrings can be either string or UInt8Array, but the typings say
        // it's always a string. Cast as string to avoid type check failing
        return byteString;
    };
    JsonProtoSerializer.prototype.fromRpcStatus = function (status) {
        var code = status.code === undefined
            ? error_1.Code.UNKNOWN
            : rpc_error_1.mapCodeFromRpcCode(status.code);
        return new error_1.FirestoreError(code, status.message || '');
    };
    /**
     * Returns a value for a number (or undefined) that's appropriate to put into
     * a google.protobuf.Int32Value proto.
     * DO NOT USE THIS FOR ANYTHING ELSE.
     * This method cheats. It's typed as returning "number" because that's what
     * our generated proto interfaces say Int32Value must be. But GRPC actually
     * expects a { value: <number> } struct.
     */
    JsonProtoSerializer.prototype.toInt32Value = function (val) {
        if (!typeUtils.isNullOrUndefined(val)) {
            return { value: val };
        }
        else {
            return undefined;
        }
    };
    /**
     * Returns a number (or null) from a google.protobuf.Int32Value proto.
     * DO NOT USE THIS FOR ANYTHING ELSE.
     * This method cheats. It's typed as accepting "number" because that's what
     * our generated proto interfaces say Int32Value must be, but it actually
     * accepts { value: number } to match our serialization in toInt32Value().
     */
    JsonProtoSerializer.prototype.fromInt32Value = function (val) {
        var result;
        if (typeof val === 'object') {
            result = val.value;
        }
        else {
            // We accept raw numbers (without the {value: ... } wrapper) for
            // compatibility with legacy persisted data.
            result = val;
        }
        return typeUtils.isNullOrUndefined(result) ? null : result;
    };
    /**
     * Returns a value for a Date that's appropriate to put into a proto.
     * DO NOT USE THIS FOR ANYTHING ELSE.
     * This method cheats. It's typed as returning "string" because that's what
     * our generated proto interfaces say dates must be. But it's easier and safer
     * to actually return a Timestamp proto.
     */
    JsonProtoSerializer.prototype.toTimestamp = function (timestamp) {
        return {
            seconds: timestamp.seconds,
            nanos: timestamp.nanos
            // tslint:disable-next-line:no-any
        };
    };
    JsonProtoSerializer.prototype.fromTimestamp = function (date) {
        // The json interface (for the browser) will return an iso timestamp string,
        // while the proto js library (for node) will return a
        // google.protobuf.Timestamp instance.
        if (typeof date === 'string') {
            // TODO(b/37282237): Use strings for Proto3 timestamps
            // assert(this.options.useProto3Json,
            //   'The timestamp string format requires Proto3.');
            return timestamp_1.Timestamp.fromISOString(date);
        }
        else {
            assert_1.assert(!!date, 'Cannot deserialize null or undefined timestamp.');
            // TODO(b/37282237): Use strings for Proto3 timestamps
            // assert(!this.options.useProto3Json,
            //   'The timestamp instance format requires Proto JS.');
            var seconds = parseInt64(date.seconds || '0');
            var nanos = date.nanos || 0;
            return new timestamp_1.Timestamp(seconds, nanos);
        }
    };
    /**
     * Returns a value for bytes that's appropriate to put in a proto.
     * DO NOT USE THIS FOR ANYTHING ELSE.
     * This method cheats. It's typed as returning "string" because that's what
     * our generated proto interfaces say bytes must be. But it should return
     * an Uint8Array in Node.
     */
    JsonProtoSerializer.prototype.toBytes = function (bytes) {
        if (this.options.useProto3Json) {
            return bytes.toBase64();
        }
        else {
            // The typings say it's a string, but it needs to be a Uint8Array in Node.
            return this.unsafeCastProtoByteString(bytes.toUint8Array());
        }
    };
    /**
     * Parse the blob from the protos into the internal Blob class. Note that the
     * typings assume all blobs are strings, but they are actually Uint8Arrays
     * on Node.
     */
    JsonProtoSerializer.prototype.fromBlob = function (blob) {
        if (typeof blob === 'string') {
            assert_1.assert(this.options.useProto3Json, 'Expected bytes to be passed in as Uint8Array, but got a string instead.');
            return blob_1.Blob.fromBase64String(blob);
        }
        else {
            assert_1.assert(!this.options.useProto3Json, 'Expected bytes to be passed in as string, but got something else instead.');
            return blob_1.Blob.fromUint8Array(blob);
        }
    };
    JsonProtoSerializer.prototype.toVersion = function (version) {
        return this.toTimestamp(version.toTimestamp());
    };
    JsonProtoSerializer.prototype.fromVersion = function (version) {
        assert_1.assert(!!version, "Trying to deserialize version that isn't set");
        return snapshot_version_1.SnapshotVersion.fromTimestamp(this.fromTimestamp(version));
    };
    JsonProtoSerializer.prototype.toResourceName = function (databaseId, path) {
        return this.fullyQualifiedPrefixPath(databaseId)
            .child('documents')
            .child(path)
            .canonicalString();
    };
    JsonProtoSerializer.prototype.fromResourceName = function (name) {
        var resource = path_1.ResourcePath.fromString(name);
        assert_1.assert(this.isValidResourceName(resource), 'Tried to deserialize invalid key ' + resource.toString());
        return resource;
    };
    JsonProtoSerializer.prototype.toName = function (key) {
        return this.toResourceName(this.databaseId, key.path);
    };
    JsonProtoSerializer.prototype.fromName = function (name) {
        var resource = this.fromResourceName(name);
        assert_1.assert(resource.get(1) === this.databaseId.projectId, 'Tried to deserialize key from different project: ' +
            resource.get(1) +
            ' vs ' +
            this.databaseId.projectId);
        assert_1.assert((!resource.get(3) && !this.databaseId.database) ||
            resource.get(3) === this.databaseId.database, 'Tried to deserialize key from different database: ' +
            resource.get(3) +
            ' vs ' +
            this.databaseId.database);
        return new document_key_1.DocumentKey(this.extractLocalPathFromResourceName(resource));
    };
    JsonProtoSerializer.prototype.toQueryPath = function (path) {
        if (path.length === 0) {
            // If the path is empty, the backend requires we leave off the /documents
            // at the end.
            return this.encodedDatabaseId;
        }
        return this.toResourceName(this.databaseId, path);
    };
    JsonProtoSerializer.prototype.fromQueryPath = function (name) {
        var resourceName = this.fromResourceName(name);
        if (resourceName.length === 4) {
            return path_1.ResourcePath.EMPTY_PATH;
        }
        return this.extractLocalPathFromResourceName(resourceName);
    };
    Object.defineProperty(JsonProtoSerializer.prototype, "encodedDatabaseId", {
        get: function () {
            var path = new path_1.ResourcePath([
                'projects',
                this.databaseId.projectId,
                'databases',
                this.databaseId.database
            ]);
            return path.canonicalString();
        },
        enumerable: true,
        configurable: true
    });
    JsonProtoSerializer.prototype.fullyQualifiedPrefixPath = function (databaseId) {
        return new path_1.ResourcePath([
            'projects',
            databaseId.projectId,
            'databases',
            databaseId.database
        ]);
    };
    JsonProtoSerializer.prototype.extractLocalPathFromResourceName = function (resourceName) {
        assert_1.assert(resourceName.length > 4 && resourceName.get(4) === 'documents', 'tried to deserialize invalid key ' + resourceName.toString());
        return resourceName.popFirst(5);
    };
    JsonProtoSerializer.prototype.isValidResourceName = function (path) {
        // Resource names have at least 4 components (project ID, database ID)
        return (path.length >= 4 &&
            path.get(0) === 'projects' &&
            path.get(2) === 'databases');
    };
    JsonProtoSerializer.prototype.toValue = function (val) {
        if (val instanceof fieldValue.NullValue) {
            return { nullValue: 'NULL_VALUE' };
        }
        else if (val instanceof fieldValue.BooleanValue) {
            return { booleanValue: val.value() };
        }
        else if (val instanceof fieldValue.IntegerValue) {
            return { integerValue: '' + val.value() };
        }
        else if (val instanceof fieldValue.DoubleValue) {
            var doubleValue = val.value();
            if (this.options.useProto3Json) {
                // Proto 3 let's us encode NaN and Infinity as string values as
                // expected by the backend. This is currently not checked by our unit
                // tests because they rely on protobuf.js.
                if (isNaN(doubleValue)) {
                    return { doubleValue: 'NaN' };
                }
                else if (doubleValue === Infinity) {
                    return { doubleValue: 'Infinity' };
                }
                else if (doubleValue === -Infinity) {
                    return { doubleValue: '-Infinity' };
                }
            }
            return { doubleValue: val.value() };
        }
        else if (val instanceof fieldValue.StringValue) {
            return { stringValue: val.value() };
        }
        else if (val instanceof fieldValue.ObjectValue) {
            return { mapValue: this.toMapValue(val) };
        }
        else if (val instanceof fieldValue.ArrayValue) {
            return { arrayValue: this.toArrayValue(val) };
        }
        else if (val instanceof fieldValue.TimestampValue) {
            return {
                timestampValue: this.toTimestamp(val.internalValue)
            };
        }
        else if (val instanceof fieldValue.GeoPointValue) {
            return {
                geoPointValue: {
                    latitude: val.value().latitude,
                    longitude: val.value().longitude
                }
            };
        }
        else if (val instanceof fieldValue.BlobValue) {
            return {
                bytesValue: this.toBytes(val.value())
            };
        }
        else if (val instanceof fieldValue.RefValue) {
            return {
                referenceValue: this.toResourceName(val.databaseId, val.key.path)
            };
        }
        else {
            return assert_1.fail('Unknown FieldValue ' + JSON.stringify(val));
        }
    };
    JsonProtoSerializer.prototype.fromValue = function (obj) {
        var _this = this;
        // tslint:disable-next-line:no-any
        var type = obj['value_type'];
        if (hasTag(obj, type, 'nullValue')) {
            return fieldValue.NullValue.INSTANCE;
        }
        else if (hasTag(obj, type, 'booleanValue')) {
            return fieldValue.BooleanValue.of(obj.booleanValue);
        }
        else if (hasTag(obj, type, 'integerValue')) {
            return new fieldValue.IntegerValue(parseInt64(obj.integerValue));
        }
        else if (hasTag(obj, type, 'doubleValue')) {
            if (this.options.useProto3Json) {
                // Proto 3 uses the string values 'NaN' and 'Infinity'.
                if (obj.doubleValue === 'NaN') {
                    return fieldValue.DoubleValue.NAN;
                }
                else if (obj.doubleValue === 'Infinity') {
                    return fieldValue.DoubleValue.POSITIVE_INFINITY;
                }
                else if (obj.doubleValue === '-Infinity') {
                    return fieldValue.DoubleValue.NEGATIVE_INFINITY;
                }
            }
            return new fieldValue.DoubleValue(obj.doubleValue);
        }
        else if (hasTag(obj, type, 'stringValue')) {
            return new fieldValue.StringValue(obj.stringValue);
        }
        else if (hasTag(obj, type, 'mapValue')) {
            return this.fromFields(obj.mapValue.fields || {});
        }
        else if (hasTag(obj, type, 'arrayValue')) {
            // "values" is not present if the array is empty
            assertPresent(obj.arrayValue, 'arrayValue');
            var values = obj.arrayValue.values || [];
            return new fieldValue.ArrayValue(values.map(function (v) { return _this.fromValue(v); }));
        }
        else if (hasTag(obj, type, 'timestampValue')) {
            assertPresent(obj.timestampValue, 'timestampValue');
            return new fieldValue.TimestampValue(this.fromTimestamp(obj.timestampValue));
        }
        else if (hasTag(obj, type, 'geoPointValue')) {
            assertPresent(obj.geoPointValue, 'geoPointValue');
            var latitude = obj.geoPointValue.latitude || 0;
            var longitude = obj.geoPointValue.longitude || 0;
            return new fieldValue.GeoPointValue(new geo_point_1.GeoPoint(latitude, longitude));
        }
        else if (hasTag(obj, type, 'bytesValue')) {
            assertPresent(obj.bytesValue, 'bytesValue');
            var blob = this.fromBlob(obj.bytesValue);
            return new fieldValue.BlobValue(blob);
        }
        else if (hasTag(obj, type, 'referenceValue')) {
            assertPresent(obj.referenceValue, 'referenceValue');
            var resourceName = this.fromResourceName(obj.referenceValue);
            var dbId = new database_info_1.DatabaseId(resourceName.get(1), resourceName.get(3));
            var key = new document_key_1.DocumentKey(this.extractLocalPathFromResourceName(resourceName));
            return new fieldValue.RefValue(dbId, key);
        }
        else {
            return assert_1.fail('Unknown Value proto ' + JSON.stringify(obj));
        }
    };
    /** Creates an api.Document from key and fields (but no create/update time) */
    JsonProtoSerializer.prototype.toMutationDocument = function (key, fields) {
        return {
            name: this.toName(key),
            fields: this.toFields(fields)
        };
    };
    JsonProtoSerializer.prototype.toDocument = function (document) {
        assert_1.assert(!document.hasLocalMutations, "Can't serialize documents with mutations.");
        return {
            name: this.toName(document.key),
            fields: this.toFields(document.data),
            updateTime: this.toTimestamp(document.version.toTimestamp())
        };
    };
    JsonProtoSerializer.prototype.fromDocument = function (document) {
        return new document_1.Document(this.fromName(document.name), this.fromVersion(document.updateTime), this.fromFields(document.fields || {}), { hasLocalMutations: false });
    };
    JsonProtoSerializer.prototype.toFields = function (fields) {
        var _this = this;
        var result = {};
        fields.forEach(function (key, value) {
            result[key] = _this.toValue(value);
        });
        return result;
    };
    JsonProtoSerializer.prototype.fromFields = function (object) {
        var _this = this;
        // Proto map<string, Value> gets mapped to Object, so cast it.
        var map = object;
        var result = fieldValue.ObjectValue.EMPTY;
        obj.forEach(map, function (key, value) {
            result = result.set(new path_1.FieldPath([key]), _this.fromValue(value));
        });
        return result;
    };
    JsonProtoSerializer.prototype.toMapValue = function (map) {
        return {
            fields: this.toFields(map)
        };
    };
    JsonProtoSerializer.prototype.toArrayValue = function (array) {
        var _this = this;
        var result = [];
        array.forEach(function (value) {
            result.push(_this.toValue(value));
        });
        return { values: result };
    };
    JsonProtoSerializer.prototype.fromFound = function (doc) {
        assert_1.assert(!!doc.found, 'Tried to deserialize a found document from a missing document.');
        assertPresent(doc.found.name, 'doc.found.name');
        assertPresent(doc.found.updateTime, 'doc.found.updateTime');
        var key = this.fromName(doc.found.name);
        var version = this.fromVersion(doc.found.updateTime);
        var fields = this.fromFields(doc.found.fields || {});
        return new document_1.Document(key, version, fields, { hasLocalMutations: false });
    };
    JsonProtoSerializer.prototype.fromMissing = function (result) {
        assert_1.assert(!!result.missing, 'Tried to deserialize a missing document from a found document.');
        assert_1.assert(!!result.readTime, 'Tried to deserialize a missing document without a read time.');
        var key = this.fromName(result.missing);
        var version = this.fromVersion(result.readTime);
        return new document_1.NoDocument(key, version);
    };
    JsonProtoSerializer.prototype.fromMaybeDocument = function (result) {
        // tslint:disable-next-line:no-any
        var type = result['result'];
        if (hasTag(result, type, 'found')) {
            return this.fromFound(result);
        }
        else if (hasTag(result, type, 'missing')) {
            return this.fromMissing(result);
        }
        return assert_1.fail('invalid batch get response: ' + JSON.stringify(result));
    };
    JsonProtoSerializer.prototype.toWatchTargetChangeState = function (state) {
        switch (state) {
            case watch_change_1.WatchTargetChangeState.Added:
                return 'ADD';
            case watch_change_1.WatchTargetChangeState.Current:
                return 'CURRENT';
            case watch_change_1.WatchTargetChangeState.NoChange:
                return 'NO_CHANGE';
            case watch_change_1.WatchTargetChangeState.Removed:
                return 'REMOVE';
            case watch_change_1.WatchTargetChangeState.Reset:
                return 'RESET';
            default:
                return assert_1.fail('Unknown WatchTargetChangeState: ' + state);
        }
    };
    JsonProtoSerializer.prototype.toTestWatchChange = function (watchChange) {
        if (watchChange instanceof watch_change_1.ExistenceFilterChange) {
            return {
                filter: {
                    count: watchChange.existenceFilter.count,
                    targetId: watchChange.targetId
                }
            };
        }
        if (watchChange instanceof watch_change_1.DocumentWatchChange) {
            if (watchChange.newDoc instanceof document_1.Document) {
                var doc = watchChange.newDoc;
                return {
                    documentChange: {
                        document: {
                            name: this.toName(doc.key),
                            fields: this.toFields(doc.data),
                            updateTime: this.toVersion(doc.version)
                        },
                        targetIds: watchChange.updatedTargetIds,
                        removedTargetIds: watchChange.removedTargetIds
                    }
                };
            }
            else if (watchChange.newDoc instanceof document_1.NoDocument) {
                var doc = watchChange.newDoc;
                return {
                    documentDelete: {
                        document: this.toName(doc.key),
                        readTime: this.toVersion(doc.version),
                        removedTargetIds: watchChange.removedTargetIds
                    }
                };
            }
            else if (watchChange.newDoc === null) {
                return {
                    documentRemove: {
                        document: this.toName(watchChange.key),
                        removedTargetIds: watchChange.removedTargetIds
                    }
                };
            }
        }
        if (watchChange instanceof watch_change_1.WatchTargetChange) {
            var cause = undefined;
            if (watchChange.cause) {
                cause = {
                    code: rpc_error_1.mapRpcCodeFromCode(watchChange.cause.code),
                    message: watchChange.cause.message
                };
            }
            return {
                targetChange: {
                    targetChangeType: this.toWatchTargetChangeState(watchChange.state),
                    targetIds: watchChange.targetIds,
                    resumeToken: this.unsafeCastProtoByteString(watchChange.resumeToken),
                    cause: cause
                }
            };
        }
        return assert_1.fail('Unrecognized watch change: ' + JSON.stringify(watchChange));
    };
    JsonProtoSerializer.prototype.fromWatchChange = function (change) {
        // tslint:disable-next-line:no-any
        var type = change['response_type'];
        var watchChange;
        if (hasTag(change, type, 'targetChange')) {
            assertPresent(change.targetChange, 'targetChange');
            // proto3 default value is unset in JSON (undefined), so use 'NO_CHANGE'
            // if unset
            var state = this.fromWatchTargetChangeState(change.targetChange.targetChangeType || 'NO_CHANGE');
            var targetIds = change.targetChange.targetIds || [];
            var resumeToken = change.targetChange.resumeToken || this.emptyByteString();
            var causeProto = change.targetChange.cause;
            var cause = causeProto && this.fromRpcStatus(causeProto);
            watchChange = new watch_change_1.WatchTargetChange(state, targetIds, resumeToken, cause || null);
        }
        else if (hasTag(change, type, 'documentChange')) {
            assertPresent(change.documentChange, 'documentChange');
            assertPresent(change.documentChange.document, 'documentChange.name');
            assertPresent(change.documentChange.document.name, 'documentChange.document.name');
            assertPresent(change.documentChange.document.updateTime, 'documentChange.document.updateTime');
            var entityChange = change.documentChange;
            var key = this.fromName(entityChange.document.name);
            var version = this.fromVersion(entityChange.document.updateTime);
            var fields = this.fromFields(entityChange.document.fields || {});
            var doc = new document_1.Document(key, version, fields, {
                hasLocalMutations: false
            });
            var updatedTargetIds = entityChange.targetIds || [];
            var removedTargetIds = entityChange.removedTargetIds || [];
            watchChange = new watch_change_1.DocumentWatchChange(updatedTargetIds, removedTargetIds, doc.key, doc);
        }
        else if (hasTag(change, type, 'documentDelete')) {
            assertPresent(change.documentDelete, 'documentDelete');
            assertPresent(change.documentDelete.document, 'documentDelete.document');
            var docDelete = change.documentDelete;
            var key = this.fromName(docDelete.document);
            var version = docDelete.readTime
                ? this.fromVersion(docDelete.readTime)
                : snapshot_version_1.SnapshotVersion.forDeletedDoc();
            var doc = new document_1.NoDocument(key, version);
            var removedTargetIds = docDelete.removedTargetIds || [];
            watchChange = new watch_change_1.DocumentWatchChange([], removedTargetIds, doc.key, doc);
        }
        else if (hasTag(change, type, 'documentRemove')) {
            assertPresent(change.documentRemove, 'documentRemove');
            assertPresent(change.documentRemove.document, 'documentRemove');
            var docRemove = change.documentRemove;
            var key = this.fromName(docRemove.document);
            var removedTargetIds = docRemove.removedTargetIds || [];
            watchChange = new watch_change_1.DocumentWatchChange([], removedTargetIds, key, null);
        }
        else if (hasTag(change, type, 'filter')) {
            // TODO(dimond): implement existence filter parsing with strategy.
            assertPresent(change.filter, 'filter');
            assertPresent(change.filter.targetId, 'filter.targetId');
            var filter = change.filter;
            var count = filter.count || 0;
            var existenceFilter = new existence_filter_1.ExistenceFilter(count);
            var targetId = filter.targetId;
            watchChange = new watch_change_1.ExistenceFilterChange(targetId, existenceFilter);
        }
        else {
            return assert_1.fail('Unknown change type ' + JSON.stringify(change));
        }
        return watchChange;
    };
    JsonProtoSerializer.prototype.fromWatchTargetChangeState = function (state) {
        if (state === 'NO_CHANGE') {
            return watch_change_1.WatchTargetChangeState.NoChange;
        }
        else if (state === 'ADD') {
            return watch_change_1.WatchTargetChangeState.Added;
        }
        else if (state === 'REMOVE') {
            return watch_change_1.WatchTargetChangeState.Removed;
        }
        else if (state === 'CURRENT') {
            return watch_change_1.WatchTargetChangeState.Current;
        }
        else if (state === 'RESET') {
            return watch_change_1.WatchTargetChangeState.Reset;
        }
        else {
            return assert_1.fail('Got unexpected TargetChange.state: ' + state);
        }
    };
    JsonProtoSerializer.prototype.versionFromListenResponse = function (change) {
        // We have only reached a consistent snapshot for the entire stream if there
        // is a read_time set and it applies to all targets (i.e. the list of
        // targets is empty). The backend is guaranteed to send such responses.
        // tslint:disable-next-line:no-any
        var type = change['response_type'];
        if (!hasTag(change, type, 'targetChange')) {
            return snapshot_version_1.SnapshotVersion.MIN;
        }
        var targetChange = change.targetChange;
        if (targetChange.targetIds && targetChange.targetIds.length) {
            return snapshot_version_1.SnapshotVersion.MIN;
        }
        if (!targetChange.readTime) {
            return snapshot_version_1.SnapshotVersion.MIN;
        }
        return this.fromVersion(targetChange.readTime);
    };
    JsonProtoSerializer.prototype.toMutation = function (mutation) {
        var _this = this;
        var result;
        if (mutation instanceof mutation_1.SetMutation) {
            result = {
                update: this.toMutationDocument(mutation.key, mutation.value)
            };
        }
        else if (mutation instanceof mutation_1.DeleteMutation) {
            result = { delete: this.toName(mutation.key) };
        }
        else if (mutation instanceof mutation_1.PatchMutation) {
            result = {
                update: this.toMutationDocument(mutation.key, mutation.data),
                updateMask: this.toDocumentMask(mutation.fieldMask)
            };
        }
        else if (mutation instanceof mutation_1.TransformMutation) {
            result = {
                transform: {
                    document: this.toName(mutation.key),
                    fieldTransforms: mutation.fieldTransforms.map(function (transform) {
                        return _this.toFieldTransform(transform);
                    })
                }
            };
        }
        else {
            return assert_1.fail('Unknown mutation type ' + mutation.type);
        }
        if (!mutation.precondition.isNone) {
            result.currentDocument = this.toPrecondition(mutation.precondition);
        }
        return result;
    };
    JsonProtoSerializer.prototype.fromMutation = function (proto) {
        var _this = this;
        var precondition = proto.currentDocument
            ? this.fromPrecondition(proto.currentDocument)
            : mutation_1.Precondition.NONE;
        if (proto.update) {
            assertPresent(proto.update.name, 'name');
            var key = this.fromName(proto.update.name);
            var value = this.fromFields(proto.update.fields || {});
            if (proto.updateMask) {
                var fieldMask = this.fromDocumentMask(proto.updateMask);
                return new mutation_1.PatchMutation(key, value, fieldMask, precondition);
            }
            else {
                return new mutation_1.SetMutation(key, value, precondition);
            }
        }
        else if (proto.delete) {
            var key = this.fromName(proto.delete);
            return new mutation_1.DeleteMutation(key, precondition);
        }
        else if (proto.transform) {
            var key = this.fromName(proto.transform.document);
            var fieldTransforms = proto.transform.fieldTransforms.map(function (transform) {
                return _this.fromFieldTransform(transform);
            });
            assert_1.assert(precondition.exists === true, 'Transforms only support precondition "exists == true"');
            return new mutation_1.TransformMutation(key, fieldTransforms);
        }
        else {
            return assert_1.fail('unknown mutation proto: ' + JSON.stringify(proto));
        }
    };
    JsonProtoSerializer.prototype.toPrecondition = function (precondition) {
        assert_1.assert(!precondition.isNone, "Can't serialize an empty precondition");
        if (precondition.updateTime !== undefined) {
            return {
                updateTime: this.toVersion(precondition.updateTime)
            };
        }
        else if (precondition.exists !== undefined) {
            return { exists: precondition.exists };
        }
        else {
            return assert_1.fail('Unknown precondition');
        }
    };
    JsonProtoSerializer.prototype.fromPrecondition = function (precondition) {
        if (precondition.updateTime !== undefined) {
            return mutation_1.Precondition.updateTime(this.fromVersion(precondition.updateTime));
        }
        else if (precondition.exists !== undefined) {
            return mutation_1.Precondition.exists(precondition.exists);
        }
        else {
            return mutation_1.Precondition.NONE;
        }
    };
    JsonProtoSerializer.prototype.fromWriteResult = function (proto) {
        var _this = this;
        // NOTE: Deletes don't have an updateTime.
        var version = proto.updateTime
            ? this.fromVersion(proto.updateTime)
            : null;
        var transformResults = null;
        if (proto.transformResults && proto.transformResults.length > 0) {
            transformResults = proto.transformResults.map(function (result) {
                return _this.fromValue(result);
            });
        }
        return new mutation_1.MutationResult(version, transformResults);
    };
    JsonProtoSerializer.prototype.fromWriteResults = function (protos) {
        var _this = this;
        return (protos || []).map(function (proto) { return _this.fromWriteResult(proto); });
    };
    JsonProtoSerializer.prototype.toFieldTransform = function (fieldTransform) {
        assert_1.assert(fieldTransform.transform instanceof mutation_1.ServerTimestampTransform, 'Unknown transform: ' + fieldTransform.transform);
        return {
            fieldPath: fieldTransform.field.canonicalString(),
            setToServerValue: 'REQUEST_TIME'
        };
    };
    JsonProtoSerializer.prototype.fromFieldTransform = function (proto) {
        assert_1.assert(proto.setToServerValue === 'REQUEST_TIME', 'Unknown transform proto: ' + JSON.stringify(proto));
        var fieldPath = path_1.FieldPath.fromServerFormat(proto.fieldPath);
        return new mutation_1.FieldTransform(fieldPath, mutation_1.ServerTimestampTransform.instance);
    };
    JsonProtoSerializer.prototype.toDocumentsTarget = function (query) {
        return { documents: [this.toQueryPath(query.path)] };
    };
    JsonProtoSerializer.prototype.fromDocumentsTarget = function (documentsTarget) {
        var count = documentsTarget.documents.length;
        assert_1.assert(count === 1, 'DocumentsTarget contained other than 1 document: ' + count);
        var name = documentsTarget.documents[0];
        return query_1.Query.atPath(this.fromQueryPath(name));
    };
    JsonProtoSerializer.prototype.toQueryTarget = function (query) {
        // Dissect the path into parent, collectionId, and optional key filter.
        var result = { structuredQuery: {} };
        if (query.path.isEmpty()) {
            result.parent = this.toQueryPath(path_1.ResourcePath.EMPTY_PATH);
        }
        else {
            var path = query.path;
            assert_1.assert(path.length % 2 !== 0, 'Document queries with filters are not supported.');
            result.parent = this.toQueryPath(path.popLast());
            result.structuredQuery.from = [{ collectionId: path.lastSegment() }];
        }
        var where = this.toFilter(query.filters);
        if (where) {
            result.structuredQuery.where = where;
        }
        var orderBy = this.toOrder(query.orderBy);
        if (orderBy) {
            result.structuredQuery.orderBy = orderBy;
        }
        var limit = this.toInt32Value(query.limit);
        if (limit !== undefined) {
            result.structuredQuery.limit = limit;
        }
        if (query.startAt) {
            result.structuredQuery.startAt = this.toCursor(query.startAt);
        }
        if (query.endAt) {
            result.structuredQuery.endAt = this.toCursor(query.endAt);
        }
        return result;
    };
    JsonProtoSerializer.prototype.fromQueryTarget = function (target) {
        var path = this.fromQueryPath(target.parent);
        var query = target.structuredQuery;
        var fromCount = query.from ? query.from.length : 0;
        if (fromCount > 0) {
            assert_1.assert(fromCount === 1, 'StructuredQuery.from with more than one collection is not supported.');
            var from = query.from[0];
            path = path.child(from.collectionId);
        }
        var filterBy = [];
        if (query.where) {
            filterBy = this.fromFilter(query.where);
        }
        var orderBy = [];
        if (query.orderBy) {
            orderBy = this.fromOrder(query.orderBy);
        }
        var limit = null;
        if (query.limit) {
            limit = this.fromInt32Value(query.limit);
        }
        var startAt = null;
        if (query.startAt) {
            startAt = this.fromCursor(query.startAt);
        }
        var endAt = null;
        if (query.endAt) {
            endAt = this.fromCursor(query.endAt);
        }
        return new query_1.Query(path, orderBy, filterBy, limit, startAt, endAt);
    };
    JsonProtoSerializer.prototype.toListenRequestLabels = function (queryData) {
        var value = this.toLabel(queryData.purpose);
        if (value == null) {
            return null;
        }
        else {
            return {
                'goog-listen-tags': value
            };
        }
    };
    JsonProtoSerializer.prototype.toLabel = function (purpose) {
        switch (purpose) {
            case query_data_1.QueryPurpose.Listen:
                return null;
            case query_data_1.QueryPurpose.ExistenceFilterMismatch:
                return 'existence-filter-mismatch';
            case query_data_1.QueryPurpose.LimboResolution:
                return 'limbo-document';
            default:
                return assert_1.fail('Unrecognized query purpose: ' + purpose);
        }
    };
    JsonProtoSerializer.prototype.toTarget = function (queryData) {
        var result;
        var query = queryData.query;
        if (query.isDocumentQuery()) {
            result = { documents: this.toDocumentsTarget(query) };
        }
        else {
            result = { query: this.toQueryTarget(query) };
        }
        result.targetId = queryData.targetId;
        if (queryData.resumeToken.length > 0) {
            result.resumeToken = this.unsafeCastProtoByteString(queryData.resumeToken);
        }
        return result;
    };
    JsonProtoSerializer.prototype.toFilter = function (filters) {
        var _this = this;
        if (filters.length === 0)
            return;
        var protos = filters.map(function (filter) {
            return filter instanceof query_1.RelationFilter
                ? _this.toRelationFilter(filter)
                : _this.toUnaryFilter(filter);
        });
        if (protos.length === 1) {
            return protos[0];
        }
        return { compositeFilter: { op: 'AND', filters: protos } };
    };
    JsonProtoSerializer.prototype.fromFilter = function (filter) {
        var _this = this;
        if (!filter) {
            return [];
        }
        else if (filter.unaryFilter !== undefined) {
            return [this.fromUnaryFilter(filter)];
        }
        else if (filter.fieldFilter !== undefined) {
            return [this.fromRelationFilter(filter)];
        }
        else if (filter.compositeFilter !== undefined) {
            return filter.compositeFilter.filters
                .map(function (f) { return _this.fromFilter(f); })
                .reduce(function (accum, current) { return accum.concat(current); });
        }
        else {
            return assert_1.fail('Unknown filter: ' + JSON.stringify(filter));
        }
    };
    JsonProtoSerializer.prototype.toOrder = function (orderBys) {
        var _this = this;
        if (orderBys.length === 0)
            return;
        return orderBys.map(function (order) { return _this.toPropertyOrder(order); });
    };
    JsonProtoSerializer.prototype.fromOrder = function (orderBys) {
        var _this = this;
        return orderBys.map(function (order) { return _this.fromPropertyOrder(order); });
    };
    JsonProtoSerializer.prototype.toCursor = function (cursor) {
        var _this = this;
        return {
            before: cursor.before,
            values: cursor.position.map(function (component) { return _this.toValue(component); })
        };
    };
    JsonProtoSerializer.prototype.fromCursor = function (cursor) {
        var _this = this;
        var before = !!cursor.before;
        var position = cursor.values.map(function (component) { return _this.fromValue(component); });
        return new query_1.Bound(position, before);
    };
    // visible for testing
    JsonProtoSerializer.prototype.toDirection = function (dir) {
        return DIRECTIONS[dir.name];
    };
    // visible for testing
    JsonProtoSerializer.prototype.fromDirection = function (dir) {
        switch (dir) {
            case 'ASCENDING':
                return query_1.Direction.ASCENDING;
            case 'DESCENDING':
                return query_1.Direction.DESCENDING;
            default:
                return undefined;
        }
    };
    // visible for testing
    JsonProtoSerializer.prototype.toOperatorName = function (op) {
        return OPERATORS[op.name];
    };
    JsonProtoSerializer.prototype.fromOperatorName = function (op) {
        switch (op) {
            case 'EQUAL':
                return query_1.RelationOp.EQUAL;
            case 'GREATER_THAN':
                return query_1.RelationOp.GREATER_THAN;
            case 'GREATER_THAN_OR_EQUAL':
                return query_1.RelationOp.GREATER_THAN_OR_EQUAL;
            case 'LESS_THAN':
                return query_1.RelationOp.LESS_THAN;
            case 'LESS_THAN_OR_EQUAL':
                return query_1.RelationOp.LESS_THAN_OR_EQUAL;
            case 'OPERATOR_UNSPECIFIED':
                return assert_1.fail('Unspecified relation');
            default:
                return assert_1.fail('Unknown relation');
        }
    };
    JsonProtoSerializer.prototype.toFieldPathReference = function (path) {
        return { fieldPath: path.canonicalString() };
    };
    JsonProtoSerializer.prototype.fromFieldPathReference = function (fieldReference) {
        return path_1.FieldPath.fromServerFormat(fieldReference.fieldPath);
    };
    // visible for testing
    JsonProtoSerializer.prototype.toPropertyOrder = function (orderBy) {
        return {
            field: this.toFieldPathReference(orderBy.field),
            direction: this.toDirection(orderBy.dir)
        };
    };
    JsonProtoSerializer.prototype.fromPropertyOrder = function (orderBy) {
        return new query_1.OrderBy(this.fromFieldPathReference(orderBy.field), this.fromDirection(orderBy.direction));
    };
    // visible for testing
    JsonProtoSerializer.prototype.toRelationFilter = function (filter) {
        if (filter instanceof query_1.RelationFilter) {
            return {
                fieldFilter: {
                    field: this.toFieldPathReference(filter.field),
                    op: this.toOperatorName(filter.op),
                    value: this.toValue(filter.value)
                }
            };
        }
        else {
            return assert_1.fail('Unrecognized filter: ' + JSON.stringify(filter));
        }
    };
    JsonProtoSerializer.prototype.fromRelationFilter = function (filter) {
        return new query_1.RelationFilter(this.fromFieldPathReference(filter.fieldFilter.field), this.fromOperatorName(filter.fieldFilter.op), this.fromValue(filter.fieldFilter.value));
    };
    // visible for testing
    JsonProtoSerializer.prototype.toUnaryFilter = function (filter) {
        if (filter instanceof query_1.NanFilter) {
            return {
                unaryFilter: {
                    field: this.toFieldPathReference(filter.field),
                    op: 'IS_NAN'
                }
            };
        }
        else if (filter instanceof query_1.NullFilter) {
            return {
                unaryFilter: {
                    field: this.toFieldPathReference(filter.field),
                    op: 'IS_NULL'
                }
            };
        }
        else {
            return assert_1.fail('Unrecognized filter: ' + JSON.stringify(filter));
        }
    };
    JsonProtoSerializer.prototype.fromUnaryFilter = function (filter) {
        switch (filter.unaryFilter.op) {
            case 'IS_NAN':
                var nanField = this.fromFieldPathReference(filter.unaryFilter.field);
                return new query_1.NanFilter(nanField);
            case 'IS_NULL':
                var nullField = this.fromFieldPathReference(filter.unaryFilter.field);
                return new query_1.NullFilter(nullField);
            case 'OPERATOR_UNSPECIFIED':
                return assert_1.fail('Unspecified filter');
            default:
                return assert_1.fail('Unknown filter');
        }
    };
    JsonProtoSerializer.prototype.toDocumentMask = function (fieldMask) {
        return {
            fieldPaths: fieldMask.fields.map(function (field) { return field.canonicalString(); })
        };
    };
    JsonProtoSerializer.prototype.fromDocumentMask = function (proto) {
        var paths = proto.fieldPaths || [];
        var fields = paths.map(function (path) { return path_1.FieldPath.fromServerFormat(path); });
        return new mutation_1.FieldMask(fields);
    };
    return JsonProtoSerializer;
}());
exports.JsonProtoSerializer = JsonProtoSerializer;
/**
 * Checks for a specific oneof tag in a protocol buffer message.
 *
 * This intentionally accommodates two distinct cases:
 *
 * 1) Messages containing a type tag: these are the format produced by GRPC in
 * return values. These may contain default-value mappings for all tags in the
 * oneof but the type tag specifies which one was actually set.
 *
 * 2) Messages that don't contain a type tag: these are the format required by
 * GRPC as inputs. If we emitted objects with type tags, ProtoBuf.js would
 * choke claiming that the tags aren't fields in the Message.
 *
 * Allowing both formats here makes the serializer able to consume the outputs
 * it produces: for all messages it supports, fromX(toX(value)) == value.
 *
 * Note that case 2 suffers from ambiguity: if multiple tags are present
 * without a type tag then the callers are structured in such a way that the
 * first invocation will win. Since we only parse in this mode when parsing
 * the output of a serialize method this works, but it's not a general
 * solution.
 *
 * Unfortunately there is no general solution here because proto3 makes it
 * impossible to distinguish unset from explicitly set fields: both have the
 * default value for the type. Without the type tag but multiple value tags
 * it's possible to have default values for each tag in the oneof and not be
 * able to know which was actually in effect.
 */
function hasTag(obj, type, tag) {
    return type === tag || (!type && tag in obj);
}

//# sourceMappingURL=serializer.js.map
