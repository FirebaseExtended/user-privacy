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
var args = require("./implementation/args");
var authwrapper_1 = require("./implementation/authwrapper");
var location_1 = require("./implementation/location");
var fbsPromiseImpl = require("./implementation/promise_external");
var RequestExports = require("./implementation/request");
var reference_1 = require("./reference");
/**
 * A service that provides firebaseStorage.Reference instances.
 * @param opt_url gs:// url to a custom Storage Bucket
 *
 * @struct
 */
var Service = /** @class */ (function () {
    function Service(app, pool, url) {
        this.bucket_ = null;
        function maker(authWrapper, loc) {
            return new reference_1.Reference(authWrapper, loc);
        }
        this.authWrapper_ = new authwrapper_1.AuthWrapper(app, maker, RequestExports.makeRequest, this, pool);
        this.app_ = app;
        if (url != null) {
            this.bucket_ = location_1.Location.makeFromBucketSpec(url);
        }
        else {
            var authWrapperBucket = this.authWrapper_.bucket();
            if (authWrapperBucket != null) {
                this.bucket_ = new location_1.Location(authWrapperBucket, '');
            }
        }
        this.internals_ = new ServiceInternals(this);
    }
    /**
     * Returns a firebaseStorage.Reference for the given path in the default
     * bucket.
     */
    Service.prototype.ref = function (path) {
        function validator(path) {
            if (/^[A-Za-z]+:\/\//.test(path)) {
                throw 'Expected child path but got a URL, use refFromURL instead.';
            }
        }
        args.validate('ref', [args.stringSpec(validator, true)], arguments);
        if (this.bucket_ == null) {
            throw new Error('No Storage Bucket defined in Firebase Options.');
        }
        var ref = new reference_1.Reference(this.authWrapper_, this.bucket_);
        if (path != null) {
            return ref.child(path);
        }
        else {
            return ref;
        }
    };
    /**
     * Returns a firebaseStorage.Reference object for the given absolute URL,
     * which must be a gs:// or http[s]:// URL.
     */
    Service.prototype.refFromURL = function (url) {
        function validator(p) {
            if (!/^[A-Za-z]+:\/\//.test(p)) {
                throw 'Expected full URL but got a child path, use ref instead.';
            }
            try {
                location_1.Location.makeFromUrl(p);
            }
            catch (e) {
                throw 'Expected valid full URL but got an invalid one.';
            }
        }
        args.validate('refFromURL', [args.stringSpec(validator, false)], arguments);
        return new reference_1.Reference(this.authWrapper_, url);
    };
    Object.defineProperty(Service.prototype, "maxUploadRetryTime", {
        get: function () {
            return this.authWrapper_.maxUploadRetryTime();
        },
        enumerable: true,
        configurable: true
    });
    Service.prototype.setMaxUploadRetryTime = function (time) {
        args.validate('setMaxUploadRetryTime', [args.nonNegativeNumberSpec()], arguments);
        this.authWrapper_.setMaxUploadRetryTime(time);
    };
    Object.defineProperty(Service.prototype, "maxOperationRetryTime", {
        get: function () {
            return this.authWrapper_.maxOperationRetryTime();
        },
        enumerable: true,
        configurable: true
    });
    Service.prototype.setMaxOperationRetryTime = function (time) {
        args.validate('setMaxOperationRetryTime', [args.nonNegativeNumberSpec()], arguments);
        this.authWrapper_.setMaxOperationRetryTime(time);
    };
    Object.defineProperty(Service.prototype, "app", {
        get: function () {
            return this.app_;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Service.prototype, "INTERNAL", {
        get: function () {
            return this.internals_;
        },
        enumerable: true,
        configurable: true
    });
    return Service;
}());
exports.Service = Service;
/**
 * @struct
 */
var ServiceInternals = /** @class */ (function () {
    function ServiceInternals(service) {
        this.service_ = service;
    }
    /**
     * Called when the associated app is deleted.
     * @see {!fbs.AuthWrapper.prototype.deleteApp}
     */
    ServiceInternals.prototype.delete = function () {
        this.service_.authWrapper_.deleteApp();
        return fbsPromiseImpl.resolve(undefined);
    };
    return ServiceInternals;
}());
exports.ServiceInternals = ServiceInternals;

//# sourceMappingURL=service.js.map
