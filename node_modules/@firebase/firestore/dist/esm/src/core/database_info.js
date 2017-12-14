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
import { primitiveComparator } from '../util/misc';
var DatabaseInfo = /** @class */ (function () {
    /**
     * Constructs a DatabaseInfo using the provided host, databaseId and
     * persistenceKey.
     *
     * @param databaseId The database to use.
     * @param persistenceKey A unique identifier for this Firestore's local
     * storage (used in conjunction with the databaseId).
     * @param host The Firestore backend host to connect to.
     * @param ssl Whether to use SSL when connecting.
     */
    function DatabaseInfo(databaseId, persistenceKey, host, ssl) {
        this.databaseId = databaseId;
        this.persistenceKey = persistenceKey;
        this.host = host;
        this.ssl = ssl;
    }
    return DatabaseInfo;
}());
export { DatabaseInfo };
/** The default database name for a project. */
var DEFAULT_DATABASE_NAME = '(default)';
/** Represents the database ID a Firestore client is associated with. */
var DatabaseId = /** @class */ (function () {
    function DatabaseId(projectId, database) {
        this.projectId = projectId;
        this.database = database ? database : DEFAULT_DATABASE_NAME;
    }
    Object.defineProperty(DatabaseId.prototype, "isDefaultDatabase", {
        get: function () {
            return this.database === DEFAULT_DATABASE_NAME;
        },
        enumerable: true,
        configurable: true
    });
    DatabaseId.prototype.equals = function (other) {
        return (other instanceof DatabaseId &&
            other.projectId === this.projectId &&
            other.database === this.database);
    };
    DatabaseId.prototype.compareTo = function (other) {
        return (primitiveComparator(this.projectId, other.projectId) ||
            primitiveComparator(this.database, other.database));
    };
    return DatabaseId;
}());
export { DatabaseId };

//# sourceMappingURL=database_info.js.map
