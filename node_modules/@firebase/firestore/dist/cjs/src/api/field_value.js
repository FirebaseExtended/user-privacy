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
Object.defineProperty(exports, "__esModule", { value: true });
var api_1 = require("../util/api");
/**
 * An opaque base class for FieldValue sentinel objects in our public API,
 * with public static methods for creating said sentinel objects.
 */
// tslint:disable-next-line:class-as-namespace  We use this as a base class.
var FieldValueImpl = /** @class */ (function () {
    function FieldValueImpl() {
    }
    FieldValueImpl.delete = function () {
        return DeleteFieldValueImpl.instance;
    };
    FieldValueImpl.serverTimestamp = function () {
        return ServerTimestampFieldValueImpl.instance;
    };
    return FieldValueImpl;
}());
exports.FieldValueImpl = FieldValueImpl;
var DeleteFieldValueImpl = /** @class */ (function (_super) {
    __extends(DeleteFieldValueImpl, _super);
    function DeleteFieldValueImpl() {
        return _super.call(this) || this;
    }
    /** Singleton instance. */
    DeleteFieldValueImpl.instance = new DeleteFieldValueImpl();
    return DeleteFieldValueImpl;
}(FieldValueImpl));
exports.DeleteFieldValueImpl = DeleteFieldValueImpl;
var ServerTimestampFieldValueImpl = /** @class */ (function (_super) {
    __extends(ServerTimestampFieldValueImpl, _super);
    function ServerTimestampFieldValueImpl() {
        return _super.call(this) || this;
    }
    /** Singleton instance. */
    ServerTimestampFieldValueImpl.instance = new ServerTimestampFieldValueImpl();
    return ServerTimestampFieldValueImpl;
}(FieldValueImpl));
exports.ServerTimestampFieldValueImpl = ServerTimestampFieldValueImpl;
// Public instance that disallows construction at runtime. This constructor is
// used when exporting FieldValueImpl on firebase.firestore.FieldValue and will
// be called FieldValue publicly. Internally we still use FieldValueImpl which
// has a type-checked private constructor. Note that FieldValueImpl and
// PublicFieldValue can be used interchangeably in instanceof checks.
// For our internal TypeScript code PublicFieldValue doesn't exist as a type,
// and so we need to use FieldValueImpl as type and export it too.
// tslint:disable-next-line:variable-name  We treat this as a class name.
exports.PublicFieldValue = api_1.makeConstructorPrivate(FieldValueImpl, 'Use FieldValue.<field>() instead.');

//# sourceMappingURL=field_value.js.map
