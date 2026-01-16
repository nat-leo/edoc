## Problem: Shortest Path in an Unweighted Graph (BFS)

You are given an **undirected, unweighted** graph with `n` nodes labeled `0` to `n-1`, represented as an **adjacency list** `graph`, where `graph[u]` is a list of nodes directly connected to `u`.

You are also given two integers `start` and `target`.

Return the **minimum number of edges** in any path from `start` to `target`.

If there is no path, return `-1`.

---

### Input

* `n`: number of nodes
* `graph`: adjacency list of length `n`
* `start`: starting node
* `target`: destination node

---

### Output

* An integer: the minimum number of edges from `start` to `target`, or `-1` if unreachable.

---

### Example 1

**Input:**

```
n = 6
graph = [
  [1, 2],    // 0
  [0, 3],    // 1
  [0, 3, 4], // 2
  [1, 2, 5], // 3
  [2],       // 4
  [3]        // 5
]
start = 0
target = 5
```

**Output:**

```
3
```

**Explanation:** One shortest path is `0 -> 1 -> 3 -> 5` (3 edges). Another is `0 -> 2 -> 3 -> 5`.

---

### Example 2

**Input:**

```
n = 4
graph = [
  [1],   // 0
  [0],   // 1
  [3],   // 2
  [2]    // 3
]
start = 0
target = 3
```

**Output:**

```
-1
```

**Explanation:** Nodes `{0,1}` are disconnected from `{2,3}`.

---

### Constraints

* `1 <= n <= 200000`
* `0 <= start, target < n`
* `graph.length == n`
* `0 <= graph[u].length <= 200000` (sum of lengths across all `u` is `<= 200000`)
* No self-loops: `u` is not in `graph[u]`
* No duplicate edges in `graph[u]` (assume adjacency lists are clean)
