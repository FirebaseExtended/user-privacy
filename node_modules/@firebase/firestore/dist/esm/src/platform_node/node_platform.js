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
import * as util from 'util';
import { JsonProtoSerializer } from '../remote/serializer';
import { Code, FirestoreError } from '../util/error';
import { GrpcConnection } from './grpc_connection';
import { loadProtos } from './load_protos';
var NodePlatform = /** @class */ (function () {
    function NodePlatform() {
        this.base64Available = true;
        this.emptyByteString = new Uint8Array(0);
    }
    NodePlatform.prototype.loadConnection = function (databaseInfo) {
        var protos = loadProtos();
        return Promise.resolve(new GrpcConnection(protos, databaseInfo));
    };
    NodePlatform.prototype.newSerializer = function (partitionId) {
        return new JsonProtoSerializer(partitionId, { useProto3Json: false });
    };
    NodePlatform.prototype.formatJSON = function (value) {
        // util.inspect() results in much more readable output than JSON.stringify()
        return util.inspect(value, { depth: 100 });
    };
    NodePlatform.prototype.atob = function (encoded) {
        // Node actually doesn't validate base64 strings.
        // A quick sanity check that is not a fool-proof validation
        if (/[^-A-Za-z0-9+/=]/.test(encoded)) {
            throw new FirestoreError(Code.INVALID_ARGUMENT, 'Not a valid Base64 string: ' + encoded);
        }
        return new Buffer(encoded, 'base64').toString('binary');
    };
    NodePlatform.prototype.btoa = function (raw) {
        return new Buffer(raw, 'binary').toString('base64');
    };
    return NodePlatform;
}());
export { NodePlatform };

//# sourceMappingURL=node_platform.js.map
