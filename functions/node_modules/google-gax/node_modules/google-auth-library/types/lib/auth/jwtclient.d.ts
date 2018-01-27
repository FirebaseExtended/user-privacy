/// <reference types="request" />
/// <reference types="node" />
import { Credentials } from './credentials';
import { OAuth2Client } from './oauth2client';
import * as stream from 'stream';
import * as request from 'request';
export declare class JWT extends OAuth2Client {
    email: string;
    keyFile: string;
    key: string;
    scopes: string | string[];
    subject: string;
    gToken: any;
    gtoken: any;
    projectId: string;
    /**
     * JWT service account credentials.
     *
     * Retrieve access token using gtoken.
     *
     * @param {string=} email service account email address.
     * @param {string=} keyFile path to private key file.
     * @param {string=} key value of key
     * @param {(string|array)=} scopes list of requested scopes or a single scope.
     * @param {string=} subject impersonated account's email address.
     * @constructor
     */
    constructor(email?: string, keyFile?: string, key?: string, scopes?: string | string[], subject?: string);
    /**
     * Creates a copy of the credential with the specified scopes.
     * @param {(string|array)=} scopes List of requested scopes or a single scope.
     * @return {object} The cloned instance.
     */
    createScoped(scopes?: string | string[]): JWT;
    /**
     * Obtains the metadata to be sent with the request.
     *
     * @param {string} opt_uri the URI being authorized.
     * @param {function} metadataCb
     */
    getRequestMetadata(opt_uri: string, metadataCb: (err: Error, result?: any) => void): void | request.Request;
    /**
     * Indicates whether the credential requires scopes to be created by calling
     * createdScoped before use.
     * @return {boolean} false if createScoped does not need to be called.
     */
    createScopedRequired(): boolean;
    /**
     * Get the initial access token using gToken.
     * @param {function=} callback Optional callback.
     */
    authorize(callback?: (err: Error, result?: Credentials) => void): void;
    /**
     * Refreshes the access token.
     * @param {object=} ignored_
     * @param {function=} callback Optional callback.
     * @private
     */
    refreshToken(ignored_: any, callback?: (err: Error, credentials?: Credentials) => void): void;
    /**
     * Create a JWT credentials instance using the given input options.
     * @param {object=} json The input object.
     * @param {function=} callback Optional callback.
     */
    fromJSON(json: any, callback?: (err?: Error) => void): void;
    /**
     * Create a JWT credentials instance using the given input stream.
     * @param {object=} stream The input stream.
     * @param {function=} callback Optional callback.
     */
    fromStream(stream: stream.Readable, callback: (err: Error) => void): void;
    /**
     * Creates a JWT credentials instance using an API Key for authentication.
     * @param {string} apiKey - the API Key in string form.
     * @param {function=} callback - Optional callback to be invoked after
     *  initialization.
     */
    fromAPIKey(apiKey: string, callback?: (err: Error) => void): void;
    /**
     * Creates the gToken instance if it has not been created already.
     * @param {function=} callback Callback.
     * @private
     */
    private _createGToken(callback);
}
