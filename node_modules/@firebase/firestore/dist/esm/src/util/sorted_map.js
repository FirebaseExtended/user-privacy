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
import { assert, fail } from './assert';
// An immutable sorted map implementation, based on a Left-leaning Red-Black
// tree.
var SortedMap = /** @class */ (function () {
    function SortedMap(comparator, root) {
        this.comparator = comparator;
        this.root = root ? root : LLRBNode.EMPTY;
    }
    // Returns a copy of the map, with the specified key/value added or replaced.
    SortedMap.prototype.insert = function (key, value) {
        return new SortedMap(this.comparator, this.root
            .insert(key, value, this.comparator)
            .copy(null, null, LLRBNode.BLACK, null, null));
    };
    // Returns a copy of the map, with the specified key removed.
    SortedMap.prototype.remove = function (key) {
        return new SortedMap(this.comparator, this.root
            .remove(key, this.comparator)
            .copy(null, null, LLRBNode.BLACK, null, null));
    };
    // Returns the value of the node with the given key, or null.
    SortedMap.prototype.get = function (key) {
        var node = this.root;
        while (!node.isEmpty()) {
            var cmp = this.comparator(key, node.key);
            if (cmp === 0) {
                return node.value;
            }
            else if (cmp < 0) {
                node = node.left;
            }
            else if (cmp > 0) {
                node = node.right;
            }
        }
        return null;
    };
    // Returns the key of the item *before* the specified key, or null if key is
    // the first item.
    SortedMap.prototype.getPredecessorKey = function (key) {
        var node = this.root;
        var rightParent = null;
        while (!node.isEmpty()) {
            var cmp = this.comparator(key, node.key);
            if (cmp === 0) {
                if (!node.left.isEmpty()) {
                    node = node.left;
                    while (!node.right.isEmpty())
                        node = node.right;
                    return node.key;
                }
                else if (rightParent) {
                    return rightParent.key;
                }
                else {
                    return null; // first item.
                }
            }
            else if (cmp < 0) {
                node = node.left;
            }
            else if (cmp > 0) {
                rightParent = node;
                node = node.right;
            }
        }
        throw fail('Attempted to find predecessor key for a nonexistent key.' +
            '  What gives?');
    };
    // Returns the index of the element in this sorted map, or -1 if it doesn't
    // exist.
    SortedMap.prototype.indexOf = function (key) {
        // Number of nodes that were pruned when descending right
        var prunedNodes = 0;
        var node = this.root;
        while (!node.isEmpty()) {
            var cmp = this.comparator(key, node.key);
            if (cmp === 0) {
                return prunedNodes + node.left.size;
            }
            else if (cmp < 0) {
                node = node.left;
            }
            else {
                // Count all nodes left of the node plus the node itself
                prunedNodes += node.left.size + 1;
                node = node.right;
            }
        }
        // Node not found
        return -1;
    };
    SortedMap.prototype.isEmpty = function () {
        return this.root.isEmpty();
    };
    Object.defineProperty(SortedMap.prototype, "size", {
        // Returns the total number of nodes in the map.
        get: function () {
            return this.root.size;
        },
        enumerable: true,
        configurable: true
    });
    // Returns the minimum key in the map.
    SortedMap.prototype.minKey = function () {
        return this.root.minKey();
    };
    // Returns the maximum key in the map.
    SortedMap.prototype.maxKey = function () {
        return this.root.maxKey();
    };
    // Traverses the map in key order and calls the specified action function
    // for each key/value pair. If action returns true, traversal is aborted.
    // Returns the first truthy value returned by action, or the last falsey
    // value returned by action.
    SortedMap.prototype.inorderTraversal = function (action) {
        return this.root.inorderTraversal(action);
    };
    SortedMap.prototype.forEach = function (fn) {
        this.inorderTraversal(function (k, v) {
            fn(k, v);
            return false;
        });
    };
    // Traverses the map in reverse key order and calls the specified action
    // function for each key/value pair. If action returns true, traversal is
    // aborted.
    // Returns the first truthy value returned by action, or the last falsey
    // value returned by action.
    SortedMap.prototype.reverseTraversal = function (action) {
        return this.root.reverseTraversal(action);
    };
    SortedMap.prototype.getIterator = function (resultGenerator) {
        return new SortedMapIterator(this.root, null, this.comparator, false, resultGenerator);
    };
    SortedMap.prototype.getIteratorFrom = function (key, resultGenerator) {
        return new SortedMapIterator(this.root, key, this.comparator, false, resultGenerator);
    };
    SortedMap.prototype.getReverseIterator = function (resultGenerator) {
        return new SortedMapIterator(this.root, null, this.comparator, true, resultGenerator);
    };
    SortedMap.prototype.getReverseIteratorFrom = function (key, resultGenerator) {
        return new SortedMapIterator(this.root, key, this.comparator, true, resultGenerator);
    };
    return SortedMap;
}()); // end SortedMap
export { SortedMap };
// An iterator over an LLRBNode.
var SortedMapIterator = /** @class */ (function () {
    function SortedMapIterator(node, startKey, comparator, isReverse, resultGenerator) {
        this.resultGenerator = resultGenerator || null;
        this.isReverse = isReverse;
        this.nodeStack = [];
        var cmp = 1;
        while (!node.isEmpty()) {
            cmp = startKey ? comparator(node.key, startKey) : 1;
            // flip the comparison if we're going in reverse
            if (isReverse)
                cmp *= -1;
            if (cmp < 0) {
                // This node is less than our start key. ignore it
                if (this.isReverse) {
                    node = node.left;
                }
                else {
                    node = node.right;
                }
            }
            else if (cmp === 0) {
                // This node is exactly equal to our start key. Push it on the stack,
                // but stop iterating;
                this.nodeStack.push(node);
                break;
            }
            else {
                // This node is greater than our start key, add it to the stack and move
                // to the next one
                this.nodeStack.push(node);
                if (this.isReverse) {
                    node = node.right;
                }
                else {
                    node = node.left;
                }
            }
        }
    }
    SortedMapIterator.prototype.getNext = function () {
        assert(this.nodeStack.length > 0, 'getNext() called on iterator when hasNext() is false.');
        var node = this.nodeStack.pop();
        var result;
        if (this.resultGenerator)
            result = this.resultGenerator(node.key, node.value);
        else
            result = { key: node.key, value: node.value };
        if (this.isReverse) {
            node = node.left;
            while (!node.isEmpty()) {
                this.nodeStack.push(node);
                node = node.right;
            }
        }
        else {
            node = node.right;
            while (!node.isEmpty()) {
                this.nodeStack.push(node);
                node = node.left;
            }
        }
        return result;
    };
    SortedMapIterator.prototype.hasNext = function () {
        return this.nodeStack.length > 0;
    };
    SortedMapIterator.prototype.peek = function () {
        if (this.nodeStack.length === 0)
            return null;
        var node = this.nodeStack[this.nodeStack.length - 1];
        if (this.resultGenerator) {
            return this.resultGenerator(node.key, node.value);
        }
        else {
            return { key: node.key, value: node.value };
        }
    };
    return SortedMapIterator;
}()); // end SortedMapIterator
export { SortedMapIterator };
// Represents a node in a Left-leaning Red-Black tree.
var LLRBNode = /** @class */ (function () {
    function LLRBNode(key, value, color, left, right) {
        this.key = key;
        this.value = value;
        this.color = color != null ? color : LLRBNode.RED;
        this.left = left != null ? left : LLRBNode.EMPTY;
        this.right = right != null ? right : LLRBNode.EMPTY;
        this.size = this.left.size + 1 + this.right.size;
    }
    // Returns a copy of the current node, optionally replacing pieces of it.
    LLRBNode.prototype.copy = function (key, value, color, left, right) {
        return new LLRBNode(key != null ? key : this.key, value != null ? value : this.value, color != null ? color : this.color, left != null ? left : this.left, right != null ? right : this.right);
    };
    LLRBNode.prototype.isEmpty = function () {
        return false;
    };
    // Traverses the tree in key order and calls the specified action function
    // for each node. If action returns true, traversal is aborted.
    // Returns the first truthy value returned by action, or the last falsey
    // value returned by action.
    LLRBNode.prototype.inorderTraversal = function (action) {
        return (this.left.inorderTraversal(action) ||
            action(this.key, this.value) ||
            this.right.inorderTraversal(action));
    };
    // Traverses the tree in reverse key order and calls the specified action
    // function for each node. If action returns true, traversal is aborted.
    // Returns the first truthy value returned by action, or the last falsey
    // value returned by action.
    LLRBNode.prototype.reverseTraversal = function (action) {
        return (this.right.reverseTraversal(action) ||
            action(this.key, this.value) ||
            this.left.reverseTraversal(action));
    };
    // Returns the minimum node in the tree.
    LLRBNode.prototype.min = function () {
        if (this.left.isEmpty()) {
            return this;
        }
        else {
            return this.left.min();
        }
    };
    // Returns the maximum key in the tree.
    LLRBNode.prototype.minKey = function () {
        return this.min().key;
    };
    // Returns the maximum key in the tree.
    LLRBNode.prototype.maxKey = function () {
        if (this.right.isEmpty()) {
            return this.key;
        }
        else {
            return this.right.maxKey();
        }
    };
    // Returns new tree, with the key/value added.
    LLRBNode.prototype.insert = function (key, value, comparator) {
        var n = this;
        var cmp = comparator(key, n.key);
        if (cmp < 0) {
            n = n.copy(null, null, null, n.left.insert(key, value, comparator), null);
        }
        else if (cmp === 0) {
            n = n.copy(null, value, null, null, null);
        }
        else {
            n = n.copy(null, null, null, null, n.right.insert(key, value, comparator));
        }
        return n.fixUp();
    };
    LLRBNode.prototype.removeMin = function () {
        if (this.left.isEmpty()) {
            return LLRBNode.EMPTY;
        }
        var n = this;
        if (!n.left.isRed() && !n.left.left.isRed())
            n = n.moveRedLeft();
        n = n.copy(null, null, null, n.left.removeMin(), null);
        return n.fixUp();
    };
    // Returns new tree, with the specified item removed.
    LLRBNode.prototype.remove = function (key, comparator) {
        var smallest;
        var n = this;
        if (comparator(key, n.key) < 0) {
            if (!n.left.isEmpty() && !n.left.isRed() && !n.left.left.isRed()) {
                n = n.moveRedLeft();
            }
            n = n.copy(null, null, null, n.left.remove(key, comparator), null);
        }
        else {
            if (n.left.isRed())
                n = n.rotateRight();
            if (!n.right.isEmpty() && !n.right.isRed() && !n.right.left.isRed()) {
                n = n.moveRedRight();
            }
            if (comparator(key, n.key) === 0) {
                if (n.right.isEmpty()) {
                    return LLRBNode.EMPTY;
                }
                else {
                    smallest = n.right.min();
                    n = n.copy(smallest.key, smallest.value, null, null, n.right.removeMin());
                }
            }
            n = n.copy(null, null, null, null, n.right.remove(key, comparator));
        }
        return n.fixUp();
    };
    LLRBNode.prototype.isRed = function () {
        return this.color;
    };
    // Returns new tree after performing any needed rotations.
    LLRBNode.prototype.fixUp = function () {
        var n = this;
        if (n.right.isRed() && !n.left.isRed())
            n = n.rotateLeft();
        if (n.left.isRed() && n.left.left.isRed())
            n = n.rotateRight();
        if (n.left.isRed() && n.right.isRed())
            n = n.colorFlip();
        return n;
    };
    LLRBNode.prototype.moveRedLeft = function () {
        var n = this.colorFlip();
        if (n.right.left.isRed()) {
            n = n.copy(null, null, null, null, n.right.rotateRight());
            n = n.rotateLeft();
            n = n.colorFlip();
        }
        return n;
    };
    LLRBNode.prototype.moveRedRight = function () {
        var n = this.colorFlip();
        if (n.left.left.isRed()) {
            n = n.rotateRight();
            n = n.colorFlip();
        }
        return n;
    };
    LLRBNode.prototype.rotateLeft = function () {
        var nl = this.copy(null, null, LLRBNode.RED, null, this.right.left);
        return this.right.copy(null, null, this.color, nl, null);
    };
    LLRBNode.prototype.rotateRight = function () {
        var nr = this.copy(null, null, LLRBNode.RED, this.left.right, null);
        return this.left.copy(null, null, this.color, null, nr);
    };
    LLRBNode.prototype.colorFlip = function () {
        var left = this.left.copy(null, null, !this.left.color, null, null);
        var right = this.right.copy(null, null, !this.right.color, null, null);
        return this.copy(null, null, !this.color, left, right);
    };
    // For testing.
    LLRBNode.prototype.checkMaxDepth = function () {
        var blackDepth = this.check();
        if (Math.pow(2.0, blackDepth) <= this.size + 1) {
            return true;
        }
        else {
            return false;
        }
    };
    // In a balanced RB tree, the black-depth (number of black nodes) from root to
    // leaves is equal on both sides.  This function verifies that or asserts.
    LLRBNode.prototype.check = function () {
        if (this.isRed() && this.left.isRed()) {
            throw fail('Red node has red child(' + this.key + ',' + this.value + ')');
        }
        if (this.right.isRed()) {
            throw fail('Right child of (' + this.key + ',' + this.value + ') is red');
        }
        var blackDepth = this.left.check();
        if (blackDepth !== this.right.check()) {
            throw fail('Black depths differ');
        }
        else {
            return blackDepth + (this.isRed() ? 0 : 1);
        }
    };
    LLRBNode.EMPTY = null;
    LLRBNode.RED = true;
    LLRBNode.BLACK = false;
    return LLRBNode;
}()); // end LLRBNode
export { LLRBNode };
// Represents an empty node (a leaf node in the Red-Black Tree).
var LLRBEmptyNode = /** @class */ (function () {
    function LLRBEmptyNode() {
        this.size = 0;
    }
    // Returns a copy of the current node.
    LLRBEmptyNode.prototype.copy = function (key, value, color, left, right) {
        return this;
    };
    // Returns a copy of the tree, with the specified key/value added.
    LLRBEmptyNode.prototype.insert = function (key, value, comparator) {
        return new LLRBNode(key, value);
    };
    // Returns a copy of the tree, with the specified key removed.
    LLRBEmptyNode.prototype.remove = function (key, comparator) {
        return this;
    };
    LLRBEmptyNode.prototype.isEmpty = function () {
        return true;
    };
    LLRBEmptyNode.prototype.inorderTraversal = function (action) {
        return false;
    };
    LLRBEmptyNode.prototype.reverseTraversal = function (action) {
        return false;
    };
    LLRBEmptyNode.prototype.minKey = function () {
        return null;
    };
    LLRBEmptyNode.prototype.maxKey = function () {
        return null;
    };
    LLRBEmptyNode.prototype.isRed = function () {
        return false;
    };
    // For testing.
    LLRBEmptyNode.prototype.checkMaxDepth = function () {
        return true;
    };
    LLRBEmptyNode.prototype.check = function () {
        return 0;
    };
    return LLRBEmptyNode;
}()); // end LLRBEmptyNode
export { LLRBEmptyNode };
LLRBNode.EMPTY = new LLRBEmptyNode();

//# sourceMappingURL=sorted_map.js.map
