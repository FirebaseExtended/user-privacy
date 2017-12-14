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
import * as json from './json';
import { Location } from './location';
import * as path from './path';
import * as type from './type';
import * as UrlUtils from './url';
export function noXform_(metadata, value) {
    return value;
}
/**
 * @struct
 */
var Mapping = /** @class */ (function () {
    function Mapping(server, opt_local, opt_writable, opt_xform) {
        this.server = server;
        this.local = opt_local || server;
        this.writable = !!opt_writable;
        this.xform = opt_xform || noXform_;
    }
    return Mapping;
}());
export { Mapping };
var mappings_ = null;
export function xformPath(fullPath) {
    var valid = type.isString(fullPath);
    if (!valid || fullPath.length < 2) {
        return fullPath;
    }
    else {
        fullPath = fullPath;
        return path.lastComponent(fullPath);
    }
}
export function getMappings() {
    if (mappings_) {
        return mappings_;
    }
    var mappings = [];
    mappings.push(new Mapping('bucket'));
    mappings.push(new Mapping('generation'));
    mappings.push(new Mapping('metageneration'));
    mappings.push(new Mapping('name', 'fullPath', true));
    function mappingsXformPath(metadata, fullPath) {
        return xformPath(fullPath);
    }
    var nameMapping = new Mapping('name');
    nameMapping.xform = mappingsXformPath;
    mappings.push(nameMapping);
    /**
     * Coerces the second param to a number, if it is defined.
     */
    function xformSize(metadata, size) {
        if (type.isDef(size)) {
            return +size;
        }
        else {
            return size;
        }
    }
    var sizeMapping = new Mapping('size');
    sizeMapping.xform = xformSize;
    mappings.push(sizeMapping);
    mappings.push(new Mapping('timeCreated'));
    mappings.push(new Mapping('updated'));
    mappings.push(new Mapping('md5Hash', null, true));
    mappings.push(new Mapping('cacheControl', null, true));
    mappings.push(new Mapping('contentDisposition', null, true));
    mappings.push(new Mapping('contentEncoding', null, true));
    mappings.push(new Mapping('contentLanguage', null, true));
    mappings.push(new Mapping('contentType', null, true));
    mappings.push(new Mapping('metadata', 'customMetadata', true));
    /**
     * Transforms a comma-separated string of tokens into a list of download
     * URLs.
     */
    function xformTokens(metadata, tokens) {
        var valid = type.isString(tokens) && tokens.length > 0;
        if (!valid) {
            // This can happen if objects are uploaded through GCS and retrieved
            // through list, so we don't want to throw an Error.
            return [];
        }
        var encode = encodeURIComponent;
        var tokensList = tokens.split(',');
        var urls = tokensList.map(function (token) {
            var bucket = metadata['bucket'];
            var path = metadata['fullPath'];
            var urlPart = '/b/' + encode(bucket) + '/o/' + encode(path);
            var base = UrlUtils.makeDownloadUrl(urlPart);
            var queryString = UrlUtils.makeQueryString({
                alt: 'media',
                token: token
            });
            return base + queryString;
        });
        return urls;
    }
    mappings.push(new Mapping('downloadTokens', 'downloadURLs', false, xformTokens));
    mappings_ = mappings;
    return mappings_;
}
export function addRef(metadata, authWrapper) {
    function generateRef() {
        var bucket = metadata['bucket'];
        var path = metadata['fullPath'];
        var loc = new Location(bucket, path);
        return authWrapper.makeStorageReference(loc);
    }
    Object.defineProperty(metadata, 'ref', { get: generateRef });
}
export function fromResource(authWrapper, resource, mappings) {
    var metadata = {};
    metadata['type'] = 'file';
    var len = mappings.length;
    for (var i = 0; i < len; i++) {
        var mapping = mappings[i];
        metadata[mapping.local] = mapping.xform(metadata, resource[mapping.server]);
    }
    addRef(metadata, authWrapper);
    return metadata;
}
export function fromResourceString(authWrapper, resourceString, mappings) {
    var obj = json.jsonObjectOrNull(resourceString);
    if (obj === null) {
        return null;
    }
    var resource = obj;
    return fromResource(authWrapper, resource, mappings);
}
export function toResourceString(metadata, mappings) {
    var resource = {};
    var len = mappings.length;
    for (var i = 0; i < len; i++) {
        var mapping = mappings[i];
        if (mapping.writable) {
            resource[mapping.server] = metadata[mapping.local];
        }
    }
    return JSON.stringify(resource);
}
export function metadataValidator(p) {
    var validType = p && type.isObject(p);
    if (!validType) {
        throw 'Expected Metadata object.';
    }
    for (var key in p) {
        var val = p[key];
        if (key === 'customMetadata') {
            if (!type.isObject(val)) {
                throw 'Expected object for \'customMetadata\' mapping.';
            }
        }
        else {
            if (type.isNonNullObject(val)) {
                throw "Mapping for '" + key + "' cannot be an object.";
            }
        }
    }
}

//# sourceMappingURL=metadata.js.map
