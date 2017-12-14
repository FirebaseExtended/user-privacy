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
var database_1 = require("../api/database");
var field_path_1 = require("../api/field_path");
var field_value_1 = require("../api/field_value");
var geo_point_1 = require("../api/geo_point");
var obj_1 = require("../util/obj");
var firestoreNamespace = {
    Firestore: database_1.PublicFirestore,
    GeoPoint: geo_point_1.GeoPoint,
    Blob: blob_1.PublicBlob,
    Transaction: database_1.PublicTransaction,
    WriteBatch: database_1.PublicWriteBatch,
    DocumentReference: database_1.PublicDocumentReference,
    DocumentSnapshot: database_1.PublicDocumentSnapshot,
    Query: database_1.PublicQuery,
    QuerySnapshot: database_1.PublicQuerySnapshot,
    CollectionReference: database_1.PublicCollectionReference,
    FieldPath: field_path_1.FieldPath,
    FieldValue: field_value_1.PublicFieldValue,
    setLogLevel: database_1.Firestore.setLogLevel
};
/**
 * Configures Firestore as part of the Firebase SDK by calling registerService.
 */
function configureForFirebase(firebase) {
    firebase.INTERNAL.registerService('firestore', function (app) { return new database_1.Firestore(app); }, obj_1.shallowCopy(firestoreNamespace));
}
exports.configureForFirebase = configureForFirebase;
/**
 * Exports the Firestore namespace into the provided `exportObject` object under
 * the key 'firestore'. This is used for wrapped binary that exposes Firestore
 * as a goog module.
 */
function configureForStandalone(exportObject) {
    var copiedNamespace = obj_1.shallowCopy(firestoreNamespace);
    // Unlike the use with Firebase, the standalone allows the use of the
    // constructor, so export it's internal class
    copiedNamespace['Firestore'] = database_1.Firestore;
    exportObject['firestore'] = copiedNamespace;
}
exports.configureForStandalone = configureForStandalone;

//# sourceMappingURL=config.js.map
