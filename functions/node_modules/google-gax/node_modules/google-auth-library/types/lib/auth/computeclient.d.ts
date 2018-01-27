/// <reference types="request" />
/**
 * Copyright 2013 Google Inc. All Rights Reserved.
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
import { BodyResponseCallback } from './../transporters';
import { OAuth2Client } from './oauth2client';
export interface Token {
    expires_in: number;
    expiry_date: number;
}
export declare type RefreshTokenCallback = (err: Error, token: Token, response: request.RequestResponse) => void;
export declare class Compute extends OAuth2Client {
    /**
     * Google Compute Engine metadata server token endpoint.
     */
    protected static readonly _GOOGLE_OAUTH2_TOKEN_URL: string;
    /**
     * Google Compute Engine service account credentials.
     *
     * Retrieve access token from the metadata server.
     * See: https://developers.google.com/compute/docs/authentication
     */
    constructor();
    /**
     * Indicates whether the credential requires scopes to be created by calling
     * createdScoped before use.
     * @return {object} The cloned instance.
     */
    createScopedRequired(): boolean;
    /**
     * Refreshes the access token.
     * @param {object=} ignored_
     * @param {function=} callback Optional callback.
     */
    protected refreshToken(ignored: any, callback?: RefreshTokenCallback): request.Request;
    /**
     * Inserts a helpful error message guiding the user toward fixing common auth
     * issues.
     * @param {object} err Error result.
     * @param {object} result The result.
     * @param {object} response The HTTP response.
     * @param {Function} callback The callback.
     */
    protected postRequest(err: Error, result: any, response: request.RequestResponse, callback: BodyResponseCallback): void;
}
