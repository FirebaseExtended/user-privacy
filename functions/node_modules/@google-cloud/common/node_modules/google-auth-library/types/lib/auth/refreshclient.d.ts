/// <reference types="request" />
/// <reference types="node" />
/**
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import * as request from 'request';
import * as stream from 'stream';
import { BodyResponseCallback } from './../transporters';
import { OAuth2Client } from './oauth2client';
export declare class UserRefreshClient extends OAuth2Client {
    _refreshToken: string;
    /**
     * User Refresh Token credentials.
     *
     * @param {string} clientId The authentication client ID.
     * @param {string} clientSecret The authentication client secret.
     * @param {string} refreshToken The authentication refresh token.
     * @constructor
     */
    constructor(clientId?: string, clientSecret?: string, refreshToken?: string);
    private callback(c, err?, res?);
    /**
     * Refreshes the access token.
     * @param {object=} ignored_
     * @param {function=} callback Optional callback.
     * @private
     */
    protected refreshToken(ignored_: any, callback?: BodyResponseCallback): request.Request | void;
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * options.
     * @param {object=} json The input object.
     * @param {function=} callback Optional callback.
     */
    fromJSON(json: any, callback?: (err?: Error) => void): void;
    /**
     * Create a UserRefreshClient credentials instance using the given input
     * stream.
     * @param {object=} stream The input stream.
     * @param {function=} callback Optional callback.
     */
    fromStream(stream: stream.Readable, callback?: (err?: Error) => void): void;
}
