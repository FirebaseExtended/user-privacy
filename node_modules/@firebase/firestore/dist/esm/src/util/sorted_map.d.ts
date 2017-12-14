export declare type Comparator<K> = (key1: K, key2: K) => number;
export interface Entry<K, V> {
    key: K;
    value: V;
}
export declare class SortedMap<K, V> {
    comparator: Comparator<K>;
    root: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    constructor(comparator: Comparator<K>, root?: LLRBNode<K, V>);
    insert(key: K, value: V): SortedMap<K, V>;
    remove(key: K): SortedMap<K, V>;
    get(key: K): V | null;
    getPredecessorKey(key: K): K | null;
    indexOf(key: K): number;
    isEmpty(): boolean;
    readonly size: number;
    minKey(): K | null;
    maxKey(): K | null;
    inorderTraversal<T>(action: (k: K, v: V) => T): T;
    forEach(fn: (k: K, v: V) => void): void;
    reverseTraversal<T>(action: (k: K, v: V) => T): T;
    getIterator(): SortedMapIterator<K, V, Entry<K, V>>;
    getIterator<T>(resultGenerator: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getIteratorFrom(key: K): SortedMapIterator<K, V, Entry<K, V>>;
    getIteratorFrom<T>(key: K, resultGenerator: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getReverseIterator(): SortedMapIterator<K, V, Entry<K, V>>;
    getReverseIterator<T>(resultGenerator: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
    getReverseIteratorFrom(key: K): SortedMapIterator<K, V, Entry<K, V>>;
    getReverseIteratorFrom<T>(key: K, resultGenerator: (k: K, v: V) => T): SortedMapIterator<K, V, T>;
}
export declare class SortedMapIterator<K, V, T> {
    private resultGenerator;
    private isReverse;
    private nodeStack;
    constructor(node: LLRBNode<K, V> | LLRBEmptyNode<K, V>, startKey: K | null, comparator: Comparator<K>, isReverse: boolean, resultGenerator?: (k: K, v: V) => T);
    getNext(): T;
    hasNext(): boolean;
    peek(): any;
}
export declare class LLRBNode<K, V> {
    key: K;
    value: V;
    readonly color: boolean;
    readonly left: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    readonly right: LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    readonly size: number;
    static EMPTY: LLRBEmptyNode<any, any>;
    static RED: boolean;
    static BLACK: boolean;
    constructor(key: K, value: V, color?: boolean, left?: LLRBNode<K, V> | LLRBEmptyNode<K, V>, right?: LLRBNode<K, V> | LLRBEmptyNode<K, V>);
    copy(key: K | null, value: V | null, color: boolean | null, left: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null): any;
    isEmpty(): boolean;
    inorderTraversal<T>(action: (k: K, v: V) => T): T;
    reverseTraversal<T>(action: (k: K, v: V) => T): T;
    private min();
    minKey(): K | null;
    maxKey(): K | null;
    insert(key: K, value: V, comparator: Comparator<K>): LLRBNode<K, V>;
    private removeMin();
    remove(key: K, comparator: Comparator<K>): LLRBNode<K, V> | LLRBEmptyNode<K, V>;
    isRed(): boolean;
    private fixUp();
    private moveRedLeft();
    private moveRedRight();
    private rotateLeft();
    private rotateRight();
    private colorFlip();
    checkMaxDepth(): boolean;
    private check();
}
export declare class LLRBEmptyNode<K, V> {
    key: K;
    value: V;
    color: boolean;
    left: LLRBNode<K, V>;
    right: LLRBNode<K, V>;
    size: number;
    constructor();
    copy(key: K | null, value: V | null, color: boolean | null, left: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null, right: LLRBNode<K, V> | LLRBEmptyNode<K, V> | null): LLRBEmptyNode<K, V>;
    insert(key: K, value: V, comparator: Comparator<K>): LLRBNode<K, V>;
    remove(key: K, comparator: Comparator<K>): LLRBEmptyNode<K, V>;
    isEmpty(): boolean;
    inorderTraversal(action: (k: K, v: V) => boolean): boolean;
    reverseTraversal(action: (k: K, v: V) => boolean): boolean;
    minKey(): K | null;
    maxKey(): K | null;
    isRed(): boolean;
    checkMaxDepth(): boolean;
    private check();
}
