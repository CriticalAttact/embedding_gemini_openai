/*
reference: https://www.topcoder.com/community/competitive-programming/tutorials/assignment-problem-and-hungarian-algorithm/
*/

class KMMatcher {
    // weights : nxm weight matrix (Array of Arrays, float), n <= m
    constructor(weights) {
        this.weights = weights.map(row => row.map(Number));
        this.n = weights.length;
        this.m = weights[0].length;
        if (this.n > this.m) throw new Error("n should be less than or equal to m");

        // init label
        this.label_x = this.weights.map(row => Math.max(...row));
        this.label_y = Array(this.m).fill(0);

        this.max_match = 0;
        this.xy = Array(this.n).fill(-1);
        this.yx = Array(this.m).fill(-1);
    }

    do_augment(x, y) {
        this.max_match += 1;
        while (x !== -2) {
            this.yx[y] = x;
            let ty = this.xy[x];
            this.xy[x] = y;
            x = this.prev[x];
            y = ty;
        }
    }

    find_augment_path() {
        this.S = Array(this.n).fill(false);
        this.T = Array(this.m).fill(false);

        this.slack = Array(this.m).fill(Infinity);
        this.slackyx = Array(this.m).fill(-1);  // l[slackyx[y]] + l[y] - w[slackx[y], y] == slack[y]

        this.prev = Array(this.n).fill(-1);

        let queue = [];
        let root = -1;

        for (let x = 0; x < this.n; x++) {
            if (this.xy[x] === -1) {
                queue.push(x);
                root = x;
                this.prev[x] = -2;
                this.S[x] = true;
                break;
            }
        }

        this.slack = this.label_y.map((ly, y) => ly + this.label_x[root] - this.weights[root][y]);
        this.slackyx.fill(root);

        while (true) {
            for (let st = 0; st < queue.length; st++) {
                let x = queue[st];

                let is_in_graph = this.weights[x].map((w, y) => Math.abs(w - (this.label_x[x] + this.label_y[y])) < 1e-9);
                let nonzero_inds = is_in_graph.map((inGraph, y) => inGraph && !this.T[y] ? y : -1).filter(y => y !== -1);

                for (let y of nonzero_inds) {
                    if (this.yx[y] === -1) {
                        return [x, y];
                    }
                    this.T[y] = true;
                    queue.push(this.yx[y]);
                    this.add_to_tree(this.yx[y], x);
                }
            }

            this.update_labels();
            queue = [];
            let is_in_graph = this.slack.map(s => Math.abs(s) < 1e-9);
            let nonzero_inds = is_in_graph.map((inGraph, y) => inGraph && !this.T[y] ? y : -1).filter(y => y !== -1);

            for (let y of nonzero_inds) {
                let x = this.slackyx[y];
                if (this.yx[y] === -1) {
                    return [x, y];
                }
                this.T[y] = true;
                if (!this.S[this.yx[y]]) {
                    queue.push(x);
                    this.add_to_tree(this.yx[y], x);
                }
            }
        }
    }

    solve(verbose = false) {
        while (this.max_match < this.n) {
            let [x, y] = this.find_augment_path();
            this.do_augment(x, y);
        }

        let sum = 0;
        for (let x = 0; x < this.n; x++) {
            if (verbose) {
                console.log(`match ${x} to ${this.xy[x]}, weight ${this.weights[x][this.xy[x]].toFixed(4)}`);
            }
            sum += this.weights[x][this.xy[x]];
        }
        this.best = sum;
        if (verbose) {
            console.log(`ans: ${sum.toFixed(4)}`);
        }
        return sum;
    }

    add_to_tree(x, prevx) {
        this.S[x] = true;
        this.prev[x] = prevx;

        for (let y = 0; y < this.m; y++) {
            if (this.label_x[x] + this.label_y[y] - this.weights[x][y] < this.slack[y]) {
                this.slack[y] = this.label_x[x] + this.label_y[y] - this.weights[x][y];
                this.slackyx[y] = x;
            }
        }
    }

    update_labels() {
        let delta = Math.min(...this.slack.filter((s, y) => !this.T[y]));
        for (let x = 0; x < this.n; x++) {
            if (this.S[x]) this.label_x[x] -= delta;
        }
        for (let y = 0; y < this.m; y++) {
            if (this.T[y]) this.label_y[y] += delta;
        }
        for (let y = 0; y < this.m; y++) {
            if (!this.T[y]) this.slack[y] -= delta;
        }
    }
}

// Example usage
// const matcher = new KMMatcher([
//     [2, 3, 0, 3],
//     [0, 4, 4, 0],
//     [5, 6, 0, 0],
//     [0, 0, 7, 0]
// ]);

// matcher.solve(true);

// const n = 10, m = 1000000;
// const weights = Array.from({ length: n }, () => Array.from({ length: m }, () => Math.random()));

// const startTime = Date.now();
// const largeMatcher = new KMMatcher(weights);
// const best = largeMatcher.solve();
// const endTime = Date.now();

// console.log(`time consuming of size (${n}, ${m}) is ${(endTime - startTime) / 1000} seconds`);

module.exports = {
    KMMatcher
};