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
import * as grpc from 'grpc';
import { Token } from '../api/credentials';
import { DatabaseInfo } from '../core/database_info';
import { Connection, Stream } from '../remote/connection';
/**
 * A Connection implemented by GRPC-Node.
 */
export declare class GrpcConnection implements Connection {
    private databaseInfo;
    private firestore;
    private cachedStub;
    constructor(protos: grpc.GrpcObject, databaseInfo: DatabaseInfo);
    private sameToken(tokenA, tokenB);
    private getStub(token);
    private getRpc(rpcName, token);
    invokeRPC(rpcName: string, request: any, token: Token | null): Promise<any>;
    invokeStreamingRPC(rpcName: string, request: any, token: Token | null): Promise<any[]>;
    openStream(rpcName: string, token: Token | null): Stream<any, any>;
}
