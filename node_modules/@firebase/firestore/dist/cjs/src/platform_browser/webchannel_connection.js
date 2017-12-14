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
var webchannel_wrapper_1 = require("@firebase/webchannel-wrapper");
var version_1 = require("../core/version");
var rpc_error_1 = require("../remote/rpc_error");
var stream_bridge_1 = require("../remote/stream_bridge");
var assert_1 = require("../util/assert");
var error_1 = require("../util/error");
var log = require("../util/log");
var LOG_TAG = 'Connection';
var RPC_STREAM_SERVICE = 'google.firestore.v1beta1.Firestore';
var RPC_URL_VERSION = 'v1beta1';
/** Maps RPC names to the corresponding REST endpoint name. */
var RPC_NAME_REST_MAPPING = {
    BatchGetDocuments: 'batchGet',
    Commit: 'commit'
};
// TODO(b/38203344): The SDK_VERSION is set independently from Firebase because
// we are doing out-of-band releases. Once we release as part of Firebase, we
// should use the Firebase version instead.
var X_GOOG_API_CLIENT_VALUE = 'gl-js/ fire/' + version_1.SDK_VERSION;
var XHR_TIMEOUT_SECS = 15;
var WebChannelConnection = /** @class */ (function () {
    function WebChannelConnection(info) {
        this.databaseId = info.databaseId;
        this.pool = new webchannel_wrapper_1.XhrIoPool();
        var proto = info.ssl ? 'https' : 'http';
        this.baseUrl = proto + '://' + info.host;
    }
    /**
     * Modifies the headers for a request, adding any authorization token if
     * present and any additional headers for the request.
     */
    WebChannelConnection.prototype.modifyHeadersForRequest = function (headers, token) {
        if (token) {
            for (var header in token.authHeaders) {
                if (token.authHeaders.hasOwnProperty(header)) {
                    headers[header] = token.authHeaders[header];
                }
            }
        }
        headers['X-Goog-Api-Client'] = X_GOOG_API_CLIENT_VALUE;
        // This header is used to improve routing and project isolation by the
        // backend.
        headers['google-cloud-resource-prefix'] =
            "projects/" + this.databaseId.projectId + "/" +
                ("databases/" + this.databaseId.database);
    };
    WebChannelConnection.prototype.invokeRPC = function (rpcName, request, token) {
        var _this = this;
        var url = this.makeUrl(rpcName);
        return new Promise(function (resolve, reject) {
            _this.pool.getObject(function (xhr) {
                xhr.listenOnce(webchannel_wrapper_1.EventType.COMPLETE, function () {
                    try {
                        switch (xhr.getLastErrorCode()) {
                            case webchannel_wrapper_1.ErrorCode.NO_ERROR:
                                var json = xhr.getResponseJson();
                                log.debug(LOG_TAG, 'XHR received:', JSON.stringify(json));
                                resolve(json);
                                break;
                            case webchannel_wrapper_1.ErrorCode.TIMEOUT:
                                log.debug(LOG_TAG, 'RPC "' + rpcName + '" timed out');
                                reject(new error_1.FirestoreError(error_1.Code.DEADLINE_EXCEEDED, 'Request time out'));
                                break;
                            case webchannel_wrapper_1.ErrorCode.HTTP_ERROR:
                                var status_1 = xhr.getStatus();
                                log.debug(LOG_TAG, 'RPC "' + rpcName + '" failed with status:', status_1, 'response text:', xhr.getResponseText());
                                if (status_1 > 0) {
                                    reject(new error_1.FirestoreError(rpc_error_1.mapCodeFromHttpStatus(status_1), 'Server responded with status ' + xhr.getStatusText()));
                                }
                                else {
                                    // If we received an HTTP_ERROR but there's no status code,
                                    // it's most probably a connection issue
                                    log.debug(LOG_TAG, 'RPC "' + rpcName + '" failed');
                                    reject(new error_1.FirestoreError(error_1.Code.UNAVAILABLE, 'Connection failed.'));
                                }
                                break;
                            default:
                                assert_1.fail('RPC "' +
                                    rpcName +
                                    '" failed with unanticipated ' +
                                    'webchannel error ' +
                                    xhr.getLastErrorCode() +
                                    ': ' +
                                    xhr.getLastError() +
                                    ', giving up.');
                        }
                    }
                    finally {
                        log.debug(LOG_TAG, 'RPC "' + rpcName + '" completed.');
                        _this.pool.releaseObject(xhr);
                    }
                });
                var requestString = JSON.stringify(request);
                log.debug(LOG_TAG, 'XHR sending: ', url + ' ' + requestString);
                // Content-Type: text/plain will avoid preflight requests which might
                // mess with CORS and redirects by proxies. If we add custom headers
                // we will need to change this code to potentially use the
                // $httpOverwrite parameter supported by ESF to avoid
                // triggering preflight requests.
                var headers = { 'Content-Type': 'text/plain' };
                _this.modifyHeadersForRequest(headers, token);
                xhr.send(url, 'POST', requestString, headers, XHR_TIMEOUT_SECS);
            });
        });
    };
    WebChannelConnection.prototype.invokeStreamingRPC = function (rpcName, request, token) {
        // The REST API automatically aggregates all of the streamed results, so we
        // can just use the normal invoke() method.
        return this.invokeRPC(rpcName, request, token);
    };
    WebChannelConnection.prototype.openStream = function (rpcName, token) {
        var urlParts = [
            this.baseUrl,
            '/',
            RPC_STREAM_SERVICE,
            '/',
            rpcName,
            '/channel'
        ];
        var webchannelTransport = webchannel_wrapper_1.createWebChannelTransport();
        var request = {
            // Background channel test avoids the initial two test calls and decreases
            // initial cold start time.
            // TODO(dimond): wenboz@ mentioned this might affect use with proxies and
            // we should monitor closely for any reports.
            backgroundChannelTest: true,
            // Required for backend stickiness, routing behavior is based on this
            // parameter.
            httpSessionIdParam: 'gsessionid',
            initMessageHeaders: {},
            // Send our custom headers as a '$httpHeaders=' url param to avoid CORS
            // preflight round-trip. This is formally defined here:
            // https://github.com/google/closure-library/blob/b0e1815b13fb92a46d7c9b3c30de5d6a396a3245/closure/goog/net/rpc/httpcors.js#L40
            httpHeadersOverwriteParam: '$httpHeaders',
            sendRawJson: true,
            supportsCrossDomainXhr: true
        };
        this.modifyHeadersForRequest(request.initMessageHeaders, token);
        var url = urlParts.join('');
        log.debug(LOG_TAG, 'Creating WebChannel: ' + url + ' ' + request);
        // tslint:disable-next-line:no-any Because listen isn't defined on it.
        var channel = webchannelTransport.createWebChannel(url, request);
        // WebChannel supports sending the first message with the handshake - saving
        // a network round trip. However, it will have to call send in the same
        // JS event loop as open. In order to enforce this, we delay actually
        // opening the WebChannel until send is called. Whether we have called
        // open is tracked with this variable.
        var opened = false;
        // A flag to determine whether the stream was closed (by us or through an
        // error/close event) to avoid delivering multiple close events or sending
        // on a closed stream
        var closed = false;
        // tslint:disable-next-line:no-any
        var streamBridge = new stream_bridge_1.StreamBridge({
            sendFn: function (msg) {
                if (!closed) {
                    if (!opened) {
                        log.debug(LOG_TAG, 'Opening WebChannel transport.');
                        channel.open();
                        opened = true;
                    }
                    log.debug(LOG_TAG, 'WebChannel sending:', msg);
                    channel.send(msg);
                }
                else {
                    log.debug(LOG_TAG, 'Not sending because WebChannel is closed:', msg);
                }
            },
            closeFn: function () { return channel.close(); }
        });
        // Closure events are guarded and exceptions are swallowed, so catch any
        // exception and rethrow using a setTimeout so they become visible again.
        // Note that eventually this function could go away if we are confident
        // enough the code is exception free.
        var unguardedEventListen = function (type, fn) {
            // TODO(dimond): closure typing seems broken because WebChannel does
            // not implement goog.events.Listenable
            channel.listen(type, function (param) {
                try {
                    fn(param);
                }
                catch (e) {
                    setTimeout(function () {
                        throw e;
                    }, 0);
                }
            });
        };
        unguardedEventListen(webchannel_wrapper_1.WebChannel.EventType.OPEN, function () {
            if (!closed) {
                log.debug(LOG_TAG, 'WebChannel transport opened.');
            }
        });
        unguardedEventListen(webchannel_wrapper_1.WebChannel.EventType.CLOSE, function () {
            if (!closed) {
                closed = true;
                log.debug(LOG_TAG, 'WebChannel transport closed');
                streamBridge.callOnClose();
            }
        });
        unguardedEventListen(webchannel_wrapper_1.WebChannel.EventType.ERROR, function (err) {
            if (!closed) {
                closed = true;
                log.debug(LOG_TAG, 'WebChannel transport errored:', err);
                streamBridge.callOnClose(new error_1.FirestoreError(error_1.Code.UNAVAILABLE, 'The operation could not be completed'));
            }
        });
        unguardedEventListen(webchannel_wrapper_1.WebChannel.EventType.MESSAGE, function (msg) {
            if (!closed) {
                // WebChannel delivers message events as array. If batching
                // is not enabled (it's off by default) each message will be
                // delivered alone, resulting in a single element array.
                var msgData = msg.data[0];
                assert_1.assert(!!msgData, 'Got a webchannel message without data.');
                // TODO(b/35143891): There is a bug in One Platform that caused errors
                // (and only errors) to be wrapped in an extra array. To be forward
                // compatible with the bug we need to check either condition. The latter
                // can be removed once the fix has been rolled out.
                var error = msgData.error || (msgData[0] && msgData[0].error);
                if (error) {
                    log.debug(LOG_TAG, 'WebChannel received error:', error);
                    // error.status will be a string like 'OK' or 'NOT_FOUND'.
                    var status_2 = error.status;
                    var code = rpc_error_1.mapCodeFromRpcStatus(status_2);
                    var message = error.message;
                    if (code === undefined) {
                        code = error_1.Code.INTERNAL;
                        message =
                            'Unknown error status: ' +
                                status_2 +
                                ' with message ' +
                                error.message;
                    }
                    // Mark closed so no further events are propagated
                    closed = true;
                    streamBridge.callOnClose(new error_1.FirestoreError(code, message));
                    channel.close();
                }
                else {
                    log.debug(LOG_TAG, 'WebChannel received:', msgData);
                    streamBridge.callOnMessage(msgData);
                }
            }
        });
        setTimeout(function () {
            // Technically we could/should wait for the WebChannel opened event,
            // but because we want to send the first message with the WebChannel
            // handshake we pretend the channel opened here (asynchronously), and
            // then delay the actual open until the first message is sent.
            streamBridge.callOnOpen();
        }, 0);
        return streamBridge;
    };
    // visible for testing
    WebChannelConnection.prototype.makeUrl = function (rpcName) {
        var urlRpcName = RPC_NAME_REST_MAPPING[rpcName];
        assert_1.assert(urlRpcName !== undefined, 'Unknown REST mapping for: ' + rpcName);
        var url = [this.baseUrl, '/', RPC_URL_VERSION];
        url.push('/projects/');
        url.push(this.databaseId.projectId);
        url.push('/databases/');
        url.push(this.databaseId.database);
        url.push('/documents');
        url.push(':');
        url.push(urlRpcName);
        return url.join('');
    };
    return WebChannelConnection;
}());
exports.WebChannelConnection = WebChannelConnection;

//# sourceMappingURL=webchannel_connection.js.map
