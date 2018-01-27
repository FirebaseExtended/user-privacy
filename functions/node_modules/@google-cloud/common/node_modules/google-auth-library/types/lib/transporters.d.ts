/// <reference types="request" />
/**
 * Copyright 2012 Google Inc. All Rights Reserved.
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
export interface Transporter {
    request(opts: any, callback?: BodyResponseCallback): any;
}
export interface BodyResponseCallback {
    (err: Error, body: any, res?: request.RequestResponse): void;
}
export declare class RequestError extends Error {
    code: number;
    errors: Error[];
}
export declare class DefaultTransporter {
    /**
     * Default user agent.
     */
    static readonly USER_AGENT: string;
    /**
     * Configures request options before making a request.
     * @param {object} opts Options to configure.
     * @return {object} Configured options.
     */
    configure(opts: any): any;
    /**
     * Makes a request with given options and invokes callback.
     * @param {object} opts Options.
     * @param {Function=} callback Optional callback.
     * @return {Request} Request object
     */
    request(opts: any, callback?: BodyResponseCallback): request.Request;
    /**
     * Wraps the response callback.
     * @param {Function=} callback Optional callback.
     * @return {Function} Wrapped callback function.
     * @private
     */
    private wrapCallback_(callback?);
}
