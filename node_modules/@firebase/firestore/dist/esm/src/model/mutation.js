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
import { SnapshotVersion } from '../core/snapshot_version';
import { assert, fail } from '../util/assert';
import * as misc from '../util/misc';
import { Document, NoDocument } from './document';
import { ObjectValue, ServerTimestampValue } from './field_value';
/**
 * Provides a set of fields that can be used to partially patch a document.
 * FieldMask is used in conjunction with ObjectValue.
 * Examples:
 *   foo - Overwrites foo entirely with the provided value. If foo is not
 *         present in the companion ObjectValue, the field is deleted.
 *   foo.bar - Overwrites only the field bar of the object foo.
 *             If foo is not an object, foo is replaced with an object
 *             containing foo
 */
var FieldMask = /** @class */ (function () {
    function FieldMask(fields) {
        this.fields = fields;
        // TODO(dimond): validation of FieldMask
    }
    FieldMask.prototype.equals = function (other) {
        return misc.arrayEquals(this.fields, other.fields);
    };
    return FieldMask;
}());
export { FieldMask };
/** Transforms a value into a server-generated timestamp. */
var ServerTimestampTransform = /** @class */ (function () {
    function ServerTimestampTransform() {
    }
    ServerTimestampTransform.prototype.equals = function (other) {
        return other instanceof ServerTimestampTransform;
    };
    ServerTimestampTransform.instance = new ServerTimestampTransform();
    return ServerTimestampTransform;
}());
export { ServerTimestampTransform };
/** A field path and the TransformOperation to perform upon it. */
var FieldTransform = /** @class */ (function () {
    function FieldTransform(field, transform) {
        this.field = field;
        this.transform = transform;
    }
    FieldTransform.prototype.equals = function (other) {
        return (this.field.equals(other.field) && this.transform.equals(other.transform));
    };
    return FieldTransform;
}());
export { FieldTransform };
/** The result of successfully applying a mutation to the backend. */
var MutationResult = /** @class */ (function () {
    function MutationResult(
        /**
         * The version at which the mutation was committed or null for a delete.
         */
        version, 
        /**
         * The resulting fields returned from the backend after a
         * TransformMutation has been committed. Contains one FieldValue for each
         * FieldTransform that was in the mutation.
         *
         * Will be null if the mutation was not a TransformMutation.
         */
        transformResults) {
        this.version = version;
        this.transformResults = transformResults;
    }
    return MutationResult;
}());
export { MutationResult };
export var MutationType;
(function (MutationType) {
    MutationType[MutationType["Set"] = 0] = "Set";
    MutationType[MutationType["Patch"] = 1] = "Patch";
    MutationType[MutationType["Transform"] = 2] = "Transform";
    MutationType[MutationType["Delete"] = 3] = "Delete";
})(MutationType || (MutationType = {}));
/**
 * Encodes a precondition for a mutation. This follows the model that the
 * backend accepts with the special case of an explicit "empty" precondition
 * (meaning no precondition).
 */
var Precondition = /** @class */ (function () {
    function Precondition(updateTime, exists) {
        this.updateTime = updateTime;
        this.exists = exists;
        assert(updateTime === undefined || exists === undefined, 'Precondition can specify "exists" or "updateTime" but not both');
    }
    /** Creates a new Precondition with an exists flag. */
    Precondition.exists = function (exists) {
        return new Precondition(undefined, exists);
    };
    /** Creates a new Precondition based on a version a document exists at. */
    Precondition.updateTime = function (version) {
        return new Precondition(version);
    };
    Object.defineProperty(Precondition.prototype, "isNone", {
        /** Returns whether this Precondition is empty. */
        get: function () {
            return this.updateTime === undefined && this.exists === undefined;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Returns true if the preconditions is valid for the given document
     * (or null if no document is available).
     */
    Precondition.prototype.isValidFor = function (maybeDoc) {
        if (this.updateTime !== undefined) {
            return (maybeDoc instanceof Document && maybeDoc.version.equals(this.updateTime));
        }
        else if (this.exists !== undefined) {
            if (this.exists) {
                return maybeDoc instanceof Document;
            }
            else {
                return maybeDoc === null || maybeDoc instanceof NoDocument;
            }
        }
        else {
            assert(this.isNone, 'Precondition should be empty');
            return true;
        }
    };
    Precondition.prototype.equals = function (other) {
        return (misc.equals(this.updateTime, other.updateTime) &&
            this.exists === other.exists);
    };
    Precondition.NONE = new Precondition();
    return Precondition;
}());
export { Precondition };
/**
 * A mutation describes a self-contained change to a document. Mutations can
 * create, replace, delete, and update subsets of documents.
 *
 * Mutations not only act on the value of the document but also it version.
 * In the case of Set, Patch, and Transform mutations we preserve the existing
 * version. In the case of Delete mutations, we reset the version to 0.
 *
 * Here's the expected transition table.
 *
 * MUTATION           APPLIED TO            RESULTS IN
 *
 * SetMutation        Document(v3)          Document(v3)
 * SetMutation        NoDocument(v3)        Document(v0)
 * SetMutation        null                  Document(v0)
 * PatchMutation      Document(v3)          Document(v3)
 * PatchMutation      NoDocument(v3)        NoDocument(v3)
 * PatchMutation      null                  null
 * TransformMutation  Document(v3)          Document(v3)
 * TransformMutation  NoDocument(v3)        NoDocument(v3)
 * TransformMutation  null                  null
 * DeleteMutation     Document(v3)          NoDocument(v0)
 * DeleteMutation     NoDocument(v3)        NoDocument(v0)
 * DeleteMutation     null                  NoDocument(v0)
 *
 * Note that TransformMutations don't create Documents (in the case of being
 * applied to a NoDocument), even though they would on the backend. This is
 * because the client always combines the TransformMutation with a SetMutation
 * or PatchMutation and we only want to apply the transform if the prior
 * mutation resulted in a Document (always true for a SetMutation, but not
 * necessarily for a PatchMutation).
 *
 * ## Subclassing Notes
 *
 * Subclasses of Mutation need to implement applyToRemoteDocument() and
 * applyToLocalView() to implement the actual behavior of applying the mutation
 * to some source document.
 */
var Mutation = /** @class */ (function () {
    function Mutation() {
    }
    Mutation.prototype.verifyKeyMatches = function (maybeDoc) {
        if (maybeDoc != null) {
            assert(maybeDoc.key.equals(this.key), 'Can only apply a mutation to a document with the same key');
        }
    };
    /**
     * Returns the version from the given document for use as the result of a
     * mutation. Mutations are defined to return the version of the base document
     * only if it is an existing document. Deleted and unknown documents have a
     * post-mutation version of SnapshotVersion.MIN.
     */
    Mutation.getPostMutationVersion = function (maybeDoc) {
        if (maybeDoc instanceof Document) {
            return maybeDoc.version;
        }
        else {
            return SnapshotVersion.MIN;
        }
    };
    return Mutation;
}());
export { Mutation };
/**
 * A mutation that creates or replaces the document at the given key with the
 * object value contents.
 */
var SetMutation = /** @class */ (function (_super) {
    __extends(SetMutation, _super);
    function SetMutation(key, value, precondition) {
        var _this = _super.call(this) || this;
        _this.key = key;
        _this.value = value;
        _this.precondition = precondition;
        _this.type = MutationType.Set;
        return _this;
    }
    SetMutation.prototype.applyToRemoteDocument = function (maybeDoc, mutationResult) {
        this.verifyKeyMatches(maybeDoc);
        assert(mutationResult.transformResults == null, 'Transform results received by SetMutation.');
        // Unlike applyToLocalView, if we're applying a mutation to a remote
        // document the server has accepted the mutation so the precondition must
        // have held.
        var version = Mutation.getPostMutationVersion(maybeDoc);
        return new Document(this.key, version, this.value, {
            hasLocalMutations: false
        });
    };
    SetMutation.prototype.applyToLocalView = function (maybeDoc, localWriteTime) {
        this.verifyKeyMatches(maybeDoc);
        if (!this.precondition.isValidFor(maybeDoc)) {
            return maybeDoc;
        }
        var version = Mutation.getPostMutationVersion(maybeDoc);
        return new Document(this.key, version, this.value, {
            hasLocalMutations: true
        });
    };
    SetMutation.prototype.equals = function (other) {
        return (other instanceof SetMutation &&
            this.key.equals(other.key) &&
            this.value.equals(other.value) &&
            this.precondition.equals(other.precondition));
    };
    return SetMutation;
}(Mutation));
export { SetMutation };
/**
 * A mutation that modifies fields of the document at the given key with the
 * given values. The values are applied through a field mask:
 *
 *  * When a field is in both the mask and the values, the corresponding field
 *    is updated.
 *  * When a field is in neither the mask nor the values, the corresponding
 *    field is unmodified.
 *  * When a field is in the mask but not in the values, the corresponding field
 *    is deleted.
 *  * When a field is not in the mask but is in the values, the values map is
 *    ignored.
 */
var PatchMutation = /** @class */ (function (_super) {
    __extends(PatchMutation, _super);
    function PatchMutation(key, data, fieldMask, precondition) {
        var _this = _super.call(this) || this;
        _this.key = key;
        _this.data = data;
        _this.fieldMask = fieldMask;
        _this.precondition = precondition;
        _this.type = MutationType.Patch;
        return _this;
    }
    PatchMutation.prototype.applyToRemoteDocument = function (maybeDoc, mutationResult) {
        this.verifyKeyMatches(maybeDoc);
        assert(mutationResult.transformResults == null, 'Transform results received by PatchMutation.');
        // TODO(mcg): Relax enforcement of this precondition
        //
        // We shouldn't actually enforce the precondition since it already passed on
        // the backend, but we may not have a local version of the document to
        // patch, so we use the precondition to prevent incorrectly putting a
        // partial document into our cache.
        if (!this.precondition.isValidFor(maybeDoc)) {
            return maybeDoc;
        }
        var version = Mutation.getPostMutationVersion(maybeDoc);
        var newData = this.patchDocument(maybeDoc);
        return new Document(this.key, version, newData, {
            hasLocalMutations: false
        });
    };
    PatchMutation.prototype.applyToLocalView = function (maybeDoc, localWriteTime) {
        this.verifyKeyMatches(maybeDoc);
        if (!this.precondition.isValidFor(maybeDoc)) {
            return maybeDoc;
        }
        var version = Mutation.getPostMutationVersion(maybeDoc);
        var newData = this.patchDocument(maybeDoc);
        return new Document(this.key, version, newData, {
            hasLocalMutations: true
        });
    };
    PatchMutation.prototype.equals = function (other) {
        return (other instanceof PatchMutation &&
            this.key.equals(other.key) &&
            this.fieldMask.equals(other.fieldMask) &&
            this.precondition.equals(other.precondition));
    };
    /**
     * Patches the data of document if available or creates a new document. Note
     * that this does not check whether or not the precondition of this patch
     * holds.
     */
    PatchMutation.prototype.patchDocument = function (maybeDoc) {
        var data;
        if (maybeDoc instanceof Document) {
            data = maybeDoc.data;
        }
        else {
            data = ObjectValue.EMPTY;
        }
        return this.patchObject(data);
    };
    PatchMutation.prototype.patchObject = function (data) {
        for (var _i = 0, _a = this.fieldMask.fields; _i < _a.length; _i++) {
            var fieldPath = _a[_i];
            var newValue = this.data.field(fieldPath);
            if (newValue !== undefined) {
                data = data.set(fieldPath, newValue);
            }
            else {
                data = data.delete(fieldPath);
            }
        }
        return data;
    };
    return PatchMutation;
}(Mutation));
export { PatchMutation };
/**
 * A mutation that modifies specific fields of the document with transform
 * operations. Currently the only supported transform is a server timestamp, but
 * IP Address, increment(n), etc. could be supported in the future.
 *
 * It is somewhat similar to a PatchMutation in that it patches specific fields
 * and has no effect when applied to a null or NoDocument (see comment on
 * Mutation for rationale).
 */
var TransformMutation = /** @class */ (function (_super) {
    __extends(TransformMutation, _super);
    function TransformMutation(key, fieldTransforms) {
        var _this = _super.call(this) || this;
        _this.key = key;
        _this.fieldTransforms = fieldTransforms;
        _this.type = MutationType.Transform;
        // NOTE: We set a precondition of exists: true as a safety-check, since we
        // always combine TransformMutations with a SetMutation or PatchMutation which
        // (if successful) should end up with an existing document.
        _this.precondition = Precondition.exists(true);
        return _this;
    }
    TransformMutation.prototype.applyToRemoteDocument = function (maybeDoc, mutationResult) {
        this.verifyKeyMatches(maybeDoc);
        assert(mutationResult.transformResults != null, 'Transform results missing for TransformMutation.');
        var transformResults = mutationResult.transformResults;
        // TODO(mcg): Relax enforcement of this precondition
        //
        // We shouldn't actually enforce the precondition since it already passed on
        // the backend, but we may not have a local version of the document to
        // patch, so we use the precondition to prevent incorrectly putting a
        // partial document into our cache.
        if (!this.precondition.isValidFor(maybeDoc)) {
            return maybeDoc;
        }
        var doc = this.requireDocument(maybeDoc);
        var newData = this.transformObject(doc.data, transformResults);
        return new Document(this.key, doc.version, newData, {
            hasLocalMutations: false
        });
    };
    TransformMutation.prototype.applyToLocalView = function (maybeDoc, localWriteTime) {
        this.verifyKeyMatches(maybeDoc);
        if (!this.precondition.isValidFor(maybeDoc)) {
            return maybeDoc;
        }
        var doc = this.requireDocument(maybeDoc);
        var transformResults = this.localTransformResults(localWriteTime);
        var newData = this.transformObject(doc.data, transformResults);
        return new Document(this.key, doc.version, newData, {
            hasLocalMutations: true
        });
    };
    TransformMutation.prototype.equals = function (other) {
        return (other instanceof TransformMutation &&
            this.key.equals(other.key) &&
            misc.arrayEquals(this.fieldTransforms, other.fieldTransforms) &&
            this.precondition.equals(other.precondition));
    };
    /**
     * Asserts that the given MaybeDocument is actually a Document and verifies
     * that it matches the key for this mutation. Since we only support
     * transformations with precondition exists this method is guaranteed to be
     * safe.
     */
    TransformMutation.prototype.requireDocument = function (maybeDoc) {
        assert(maybeDoc instanceof Document, 'Unknown MaybeDocument type ' + maybeDoc);
        var doc = maybeDoc;
        assert(doc.key.equals(this.key), 'Can only transform a document with the same key');
        return doc;
    };
    /**
     * Creates a list of "transform results" (a transform result is a field value
     * representing the result of applying a transform) for use when applying a
     * TransformMutation locally.
     *
     * @param localWriteTime The local time of the transform mutation (used to
     *     generate ServerTimestampValues).
     * @return The transform results list.
     */
    TransformMutation.prototype.localTransformResults = function (localWriteTime) {
        var transformResults = [];
        for (var _i = 0, _a = this.fieldTransforms; _i < _a.length; _i++) {
            var fieldTransform = _a[_i];
            var transform = fieldTransform.transform;
            if (transform instanceof ServerTimestampTransform) {
                transformResults.push(new ServerTimestampValue(localWriteTime));
            }
            else {
                return fail('Encountered unknown transform: ' + transform);
            }
        }
        return transformResults;
    };
    TransformMutation.prototype.transformObject = function (data, transformResults) {
        assert(transformResults.length === this.fieldTransforms.length, 'TransformResults length mismatch.');
        for (var i = 0; i < this.fieldTransforms.length; i++) {
            var fieldTransform = this.fieldTransforms[i];
            var transform = fieldTransform.transform;
            var fieldPath = fieldTransform.field;
            if (transform instanceof ServerTimestampTransform) {
                data = data.set(fieldPath, transformResults[i]);
            }
            else {
                return fail('Encountered unknown transform: ' + transform);
            }
        }
        return data;
    };
    return TransformMutation;
}(Mutation));
export { TransformMutation };
/** A mutation that deletes the document at the given key. */
var DeleteMutation = /** @class */ (function (_super) {
    __extends(DeleteMutation, _super);
    function DeleteMutation(key, precondition) {
        var _this = _super.call(this) || this;
        _this.key = key;
        _this.precondition = precondition;
        _this.type = MutationType.Delete;
        return _this;
    }
    DeleteMutation.prototype.applyToRemoteDocument = function (maybeDoc, mutationResult) {
        this.verifyKeyMatches(maybeDoc);
        assert(mutationResult.transformResults == null, 'Transform results received by DeleteMutation.');
        // Unlike applyToLocalView, if we're applying a mutation to a remote
        // document the server has accepted the mutation so the precondition must
        // have held.
        return new NoDocument(this.key, SnapshotVersion.MIN);
    };
    DeleteMutation.prototype.applyToLocalView = function (maybeDoc, localWriteTime) {
        this.verifyKeyMatches(maybeDoc);
        if (!this.precondition.isValidFor(maybeDoc)) {
            return maybeDoc;
        }
        if (maybeDoc) {
            assert(maybeDoc.key.equals(this.key), 'Can only apply mutation to document with same key');
        }
        return new NoDocument(this.key, SnapshotVersion.forDeletedDoc());
    };
    DeleteMutation.prototype.equals = function (other) {
        return (other instanceof DeleteMutation &&
            this.key.equals(other.key) &&
            this.precondition.equals(other.precondition));
    };
    return DeleteMutation;
}(Mutation));
export { DeleteMutation };

//# sourceMappingURL=mutation.js.map
