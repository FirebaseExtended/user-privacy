/// <reference types="node" />
import * as fs from 'fs';
import * as stream from 'stream';
import { DefaultTransporter, Transporter } from '../transporters';
import { Compute } from './computeclient';
import { JWTInput } from './credentials';
import { IAMAuth } from './iam';
import { JWTAccess } from './jwtaccess';
import { JWT } from './jwtclient';
import { OAuth2Client } from './oauth2client';
import { UserRefreshClient } from './refreshclient';
export interface ProjectIdCallback {
    (err: Error, projectId: string): void;
}
export interface CredentialBody {
    client_email?: string;
    private_key?: string;
}
export declare class GoogleAuth {
    transporter: Transporter;
    /**
     * Caches a value indicating whether the auth layer is running on Google
     * Compute Engine.
     * @private
     */
    private _isGCE;
    readonly isGCE: boolean;
    private _cachedProjectId;
    cachedProjectId: string;
    jsonContent: JWTInput | null;
    cachedCredential: any;
    protected JWTClient: typeof JWT;
    protected ComputeClient: typeof Compute;
    /**
     * Convenience field mapping in the IAM credential type.
     */
    IAMAuth: typeof IAMAuth;
    /**
     * Convenience field mapping in the Compute credential type.
     */
    Compute: typeof Compute;
    /**
     * Convenience field mapping in the JWT credential type.
     */
    JWT: typeof JWT;
    /**
     * Convenience field mapping in the JWT Access credential type.
     */
    JWTAccess: typeof JWTAccess;
    /**
     * Convenience field mapping in the OAuth2 credential type.
     */
    OAuth2: typeof OAuth2Client;
    /**
     * Convenience field mapping to the UserRefreshClient credential type.
     */
    UserRefreshClient: typeof UserRefreshClient;
    /**
     * Export DefaultTransporter as a static property of the class.
     */
    static DefaultTransporter: typeof DefaultTransporter;
    /**
     * Obtains the default project ID for the application..
     * @param {function=} callback Optional callback.
     */
    getDefaultProjectId(callback: ProjectIdCallback): void;
    /**
     * Run the Google Cloud SDK command that prints the default project ID
     * @param {function} _callback Callback.
     * @api private
     */
    _getSDKDefaultProjectId(_callback: (error: Error, stdout: string, stderr: string) => void): void;
    /**
     * Obtains the default service-level credentials for the application..
     * @param {function=} callback Optional callback.
     */
    getApplicationDefault(callback?: (err: Error, credential: any, projectId: string) => void): void;
    /**
     * Determines whether the auth layer is running on Google Compute Engine.
     * @param {function=} callback The callback.
     * @api private
     */
    _checkIsGCE(callback: (err: Error, isGCE?: boolean) => void): void;
    /**
     * Attempts to load default credentials from the environment variable path..
     * @param {function=} callback Optional callback.
     * @return {boolean} Returns true if the callback has been executed; false otherwise.
     * @api private
     */
    _tryGetApplicationCredentialsFromEnvironmentVariable(callback?: (err: Error, result: any) => void): boolean;
    /**
     * Attempts to load default credentials from a well-known file location
     * @param {function=} callback Optional callback.
     * @return {boolean} Returns true if the callback has been executed; false otherwise.
     * @api private
     */
    _tryGetApplicationCredentialsFromWellKnownFile(callback?: (err: Error, result?: any) => void): boolean;
    /**
     * Attempts to load default credentials from a file at the given path..
     * @param {string=} filePath The path to the file to read.
     * @param {function=} callback Optional callback.
     * @api private
     */
    _getApplicationCredentialsFromFilePath(filePath: string, callback: (err: Error, result?: any) => void): void;
    /**
     * Create a credentials instance using the given input options.
     * @param {object=} json The input object.
     * @param {function=} callback Optional callback.
     */
    fromJSON(json: any, callback?: (err: Error, client?: any) => void): void;
    /**
     * Create a credentials instance using the given input stream.
     * @param {object=} stream The input stream.
     * @param {function=} callback Optional callback.
     */
    fromStream(stream: stream.Readable, callback?: (err: Error, result?: any) => void): void;
    /**
     * Create a credentials instance using the given API key string.
     * @param {string} - The API key string
     * @param {function=} - Optional callback function
     */
    fromAPIKey(apiKey: string, callback?: (err: Error, client?: JWT) => void): void;
    /**
     * Determines whether the current operating system is Windows.
     * @api private
     */
    private _isWindows();
    /**
     * Creates a file stream. Allows mocking.
     * @api private
     */
    _createReadStream(filePath: string): fs.ReadStream;
    /**
     * Gets the value of the environment variable with the given name. Allows
     * mocking.
     * @api private
     */
    private _getEnv(name);
    /**
     * Gets the current operating system platform. Allows mocking.
     * @api private
     */
    _osPlatform(): NodeJS.Platform;
    /**
     * Determines whether a file exists. Allows mocking.
     * @api private
     */
    _fileExists(filePath: string): boolean;
    /**
     * Joins two parts of a path. Allows mocking.
     * @api private
     */
    _pathJoin(item1: string, item2: string): string;
    /**
     * Allows mocking of the path to a well-known file.
     * @api private
     */
    private _mockWellKnownFilePath(filePath);
    private callback(c, err?, ...args);
    private createError(message, err);
    /**
     * Loads the default project of the Google Cloud SDK.
     * @param {function} _callback Callback.
     * @api private
     */
    private _getDefaultServiceProjectId(_callback);
    /**
     * Loads the project id from environment variables.
     * @param {function} _callback Callback.
     * @api private
     */
    private _getProductionProjectId(_callback);
    /**
     * Loads the project id from the GOOGLE_APPLICATION_CREDENTIALS json file.
     * @param {function} _callback Callback.
     * @api private
     */
    private _getFileProjectId(_callback);
    /**
     * Gets the Compute Engine project ID if it can be inferred.
     * Uses 169.254.169.254 for the metadata server to avoid request
     * latency from DNS lookup.
     * See https://cloud.google.com/compute/docs/metadata#metadataserver
     * for information about this IP address. (This IP is also used for
     * Amazon EC2 instances, so the metadata flavor is crucial.)
     * See https://github.com/google/oauth2client/issues/93 for context about
     * DNS latency.
     *
     * @param {function} _callback Callback.
     * @api private
     */
    private _getGCEProjectId(_callback);
    /**
     * The callback function handles a credential object that contains the
     * client_email and private_key (if exists).
     * getCredentials checks for these values from the user JSON at first.
     * If it doesn't exist, and the environment is on GCE, it gets the
     * client_email from the cloud metadata server.
     * @param callback Callback that handles the credential object that contains
     * a client_email and optional private key, or the error.
     * returned
     */
    getCredentials(callback: (err: Error | null, credentials?: CredentialBody) => void): void;
}
