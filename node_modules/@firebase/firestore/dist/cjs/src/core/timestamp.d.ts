export declare class Timestamp {
    readonly seconds: number;
    readonly nanos: number;
    static now(): Timestamp;
    static fromDate(date: Date): Timestamp;
    static fromEpochMilliseconds(milliseconds: number): Timestamp;
    static fromISOString(utc: string): Timestamp;
    constructor(seconds: number, nanos: number);
    toDate(): Date;
    toEpochMilliseconds(): number;
    compareTo(other: Timestamp): number;
    equals(other: Timestamp): boolean;
    toString(): string;
}
