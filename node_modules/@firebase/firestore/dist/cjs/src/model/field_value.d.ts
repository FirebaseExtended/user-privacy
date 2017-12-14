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
import { Blob } from '../api/blob';
import { GeoPoint } from '../api/geo_point';
import { DatabaseId } from '../core/database_info';
import { Timestamp } from '../core/timestamp';
import { SortedMap } from '../util/sorted_map';
import { DocumentKey } from './document_key';
import { FieldPath } from './path';
/**
 * Supported data value types:
 *  - Null
 *  - Boolean
 *  - Long
 *  - Double
 *  - String
 *  - Object
 *  - Array
 *  - Binary
 *  - Timestamp
 *  - ServerTimestamp (a sentinel used in uncommitted writes)
 *  - GeoPoint
 *  - (Document) References
 */
export interface JsonObject<T> {
    [name: string]: T;
}
export declare enum TypeOrder {
    NullValue = 0,
    BooleanValue = 1,
    NumberValue = 2,
    TimestampValue = 3,
    StringValue = 4,
    BlobValue = 5,
    RefValue = 6,
    GeoPointValue = 7,
    ArrayValue = 8,
    ObjectValue = 9,
}
/**
 * Potential types returned by FieldValue.value(). This could be stricter
 * (instead of using {}), but there's little benefit.
 *
 * Note that currently we use AnyJs (which is identical except includes
 * undefined) for incoming user data as a convenience to the calling code (but
 * we'll throw if the data contains undefined). This should probably be changed
 * to use FieldType, but all consuming code will have to be updated to
 * explicitly handle undefined and then cast to FieldType or similar. Perhaps
 * we should tackle this when adding robust argument validation to the API.
 */
export declare type FieldType = null | boolean | number | string | {};
/**
 * A field value represents a datatype as stored by Firestore.
 */
export declare abstract class FieldValue {
    readonly typeOrder: TypeOrder;
    abstract value(): FieldType;
    abstract equals(other: FieldValue): boolean;
    abstract compareTo(other: FieldValue): number;
    toString(): string;
    defaultCompareTo(other: FieldValue): number;
}
export declare class NullValue extends FieldValue {
    typeOrder: TypeOrder;
    readonly internalValue: any;
    private constructor();
    value(): FieldType;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
    static INSTANCE: NullValue;
}
export declare class BooleanValue extends FieldValue {
    readonly internalValue: boolean;
    typeOrder: TypeOrder;
    private constructor();
    value(): boolean;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
    static of(value: boolean): BooleanValue;
    static TRUE: BooleanValue;
    static FALSE: BooleanValue;
}
/** Base class for IntegerValue and DoubleValue. */
export declare abstract class NumberValue extends FieldValue {
    readonly internalValue: number;
    typeOrder: TypeOrder;
    constructor(internalValue: number);
    value(): number;
    compareTo(other: FieldValue): number;
}
export declare class IntegerValue extends NumberValue {
    constructor(internalValue: number);
    equals(other: FieldValue): boolean;
}
export declare class DoubleValue extends NumberValue {
    readonly internalValue: number;
    constructor(internalValue: number);
    static NAN: DoubleValue;
    static POSITIVE_INFINITY: DoubleValue;
    static NEGATIVE_INFINITY: DoubleValue;
    equals(other: FieldValue): boolean;
}
export declare class StringValue extends FieldValue {
    readonly internalValue: string;
    typeOrder: TypeOrder;
    constructor(internalValue: string);
    value(): string;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
}
export declare class TimestampValue extends FieldValue {
    readonly internalValue: Timestamp;
    typeOrder: TypeOrder;
    constructor(internalValue: Timestamp);
    value(): Date;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
}
/**
 * Represents a locally-applied ServerTimestamp.
 *
 * Notes:
 * - ServerTimestampValue instances are created as the result of applying a
 *   TransformMutation (see TransformMutation.applyTo()). They can only exist in
 *   the local view of a document. Therefore they do not need to be parsed or
 *   serialized.
 * - When evaluated locally (e.g. for snapshot.data()), they evaluate to null.
 * - With respect to other ServerTimestampValues, they sort by their
 *   localWriteTime.
 */
export declare class ServerTimestampValue extends FieldValue {
    readonly localWriteTime: Timestamp;
    typeOrder: TypeOrder;
    constructor(localWriteTime: Timestamp);
    value(): null;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
    toString(): string;
}
export declare class BlobValue extends FieldValue {
    readonly internalValue: Blob;
    typeOrder: TypeOrder;
    constructor(internalValue: Blob);
    value(): Blob;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
}
export declare class RefValue extends FieldValue {
    readonly databaseId: DatabaseId;
    readonly key: DocumentKey;
    typeOrder: TypeOrder;
    constructor(databaseId: DatabaseId, key: DocumentKey);
    value(): DocumentKey;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
}
export declare class GeoPointValue extends FieldValue {
    readonly internalValue: GeoPoint;
    typeOrder: TypeOrder;
    constructor(internalValue: GeoPoint);
    value(): GeoPoint;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
}
export declare class ObjectValue extends FieldValue {
    readonly internalValue: SortedMap<string, FieldValue>;
    typeOrder: TypeOrder;
    constructor(internalValue: SortedMap<string, FieldValue>);
    value(): JsonObject<FieldType>;
    forEach(action: (key: string, value: FieldValue) => void): void;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
    set(path: FieldPath, to: FieldValue): ObjectValue;
    delete(path: FieldPath): ObjectValue;
    contains(path: FieldPath): boolean;
    field(path: FieldPath): FieldValue;
    toString(): string;
    private child(childName);
    private setChild(childName, value);
    static EMPTY: ObjectValue;
}
export declare class ArrayValue extends FieldValue {
    readonly internalValue: FieldValue[];
    typeOrder: TypeOrder;
    constructor(internalValue: FieldValue[]);
    value(): FieldType[];
    forEach(action: (value: FieldValue) => void): void;
    equals(other: FieldValue): boolean;
    compareTo(other: FieldValue): number;
    toString(): string;
}
