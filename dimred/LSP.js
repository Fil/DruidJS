import { simultaneous_poweriteration} from "../linear_algebra/index";
import { Matrix } from "../matrix/index";
import { DR } from "./DR.js";
import { MDS } from "./MDS.js";
import { KMedoids } from "../clustering/index";
import { euclidean } from "../metrics/index";
import { BallTree } from "../knn/index";
/**
 * @class
 * @alias LSP
 */
export class LSP extends DR {
    static parameter_list = ["k", "control_points"];

    /**
     * 
     * @constructor
     * @memberof module:dimensionality_reduction
     * @alias LSP
     * @param {Matrix} X - the high-dimensional data. 
     * @param {number} [k = Math.max(Math.floor(N / 10), 2)] - number of neighbors to consider.
     * @param {number} [control_points = Math.ceil(Math.sqrt(N))] - number of controlpoints
     * @param {number} [d = 2] - the dimensionality of the projection.
     * @param {function} [metric = euclidean] - the metric which defines the distance between two points.  
     * @returns {LSP}
     * @see {@link https://ieeexplore.ieee.org/document/4378370}
     */
    constructor(X, k, control_points, d=2, metric=euclidean, seed=1212) {
        super(X, d, metric, seed);
        super.parameter_list = LSP.parameter_list;
        this.parameter("k", k || Math.max(Math.floor(this.X.shape[0] / 10), 2));
        this.parameter("control_points", control_points || Math.ceil(Math.sqrt(this._N)));
        this._is_initialized = false;
        return this;
    }

    /**
     * 
     * @param {DR} DR - method used for position control points.
     * @param {DR_parameters} DR_parameters - array containing parameters for the DR method which projects the control points
     * @returns {LSP} 
     */
    init(DR=MDS, DR_parameters=[], KNN=BallTree) {
        if (this._is_initialized) return;
        const X = this.X;
        const N = this._N;
        const K = this.parameter("k");
        const d = this._d;
        const metric = this._metric;
        const nc = this.parameter("control_points");
        const control_points = new KMedoids(X, nc, null, metric).get_clusters().medoids;
        const C = new Matrix(nc, N, "zeros")
        control_points.forEach((c_i, i) => {
            C.set_entry(i, c_i, 1);
        })
        const Y_C = new DR(Matrix.from(control_points.map(c_i => X.row(c_i))), ...DR_parameters, d).transform();
        
        const XA = X.to2dArray;
        const knn = new KNN(XA, metric);
        const L = new Matrix(N, N, "I");
        const alpha = -1/K;
        XA.forEach((x_i, i) => {
            for (const {"index": j} of knn.search(x_i, K).iterate()) {
                if (i === j) continue;
                L.set_entry(i, j, alpha);
            }
        })
        const A = L.concat(C, "vertical");

        const z = new Matrix(N, d, "zeros");
        const b = z.concat(Y_C, "vertical");
        
        this._A = A;
        this._b = b;
        this._is_initialized = true;
        return this;
    }


    /**
     * Computes the projection.
     * @returns {Matrix} Returns the projection.
     */
    transform() {
        if (!this._is_initialized) this.init();
        const A = this._A;
        const AT = A.T
        const b = this._b;
        const ATA = AT.dot(A);
        const ATb = AT.dot(b);
        this.Y = Matrix.solve_CG(ATA, ATb, this._randomizer);
        return this.projection;
    }
} 