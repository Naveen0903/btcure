"""
Discrete-Time Markov Chain (DTMC) Engine for TB Progression
Based on 5x5 empirical transition matrices from Karnataka NTEP (2021-2025).
States:
S1: Susceptible
S2: Infectious (Active Disease)
S3: Treated (Under NTEP Care)
S4: Recovered (Clinically Cured / Completed)
S5: TB-Death (Absorbing State)
"""

from typing import List, Dict, Any, Tuple

class MarkovEngine:
    def __init__(self):
        self.state_names = ["Susceptible", "Infectious", "Treated", "Recovered", "Death"]
        # Default 2024 calibrated transition matrix
        self.default_matrix = [
            [0.9988, 0.0010, 0.0000, 0.0000, 0.0002],
            [0.0000, 0.0031, 0.9934, 0.0000, 0.0035],
            [0.0000, 0.0000, 0.0042, 0.9359, 0.0599],
            [0.0618, 0.0000, 0.0000, 0.9380, 0.0002],
            [0.0000, 0.0000, 0.0000, 0.0000, 1.0000]
        ]

    def _matmul(self, A: List[List[float]], B: List[List[float]]) -> List[List[float]]:
        rows_A, cols_A = len(A), len(A[0])
        rows_B, cols_B = len(B), len(B[0])
        assert cols_A == rows_B, "Dimension mismatch for matrix multiplication"
        result = [[0.0 for _ in range(cols_B)] for _ in range(rows_A)]
        for i in range(rows_A):
            for k in range(cols_A):
                if A[i][k] != 0:
                    for j in range(cols_B):
                        result[i][j] += A[i][k] * B[k][j]
        return result

    def _vec_mat_mul(self, v: List[float], M: List[List[float]]) -> List[float]:
        cols = len(M[0])
        res = [0.0] * cols
        for j in range(cols):
            res[j] = sum(v[i] * M[i][j] for i in range(len(v)))
        return res

    def matrix_power(self, P: List[List[float]], n: int) -> List[List[float]]:
        """Computes P^n using repeated squaring"""
        size = len(P)
        result = [[1.0 if i == j else 0.0 for j in range(size)] for i in range(size)]
        base = [row[:] for row in P]
        power = n
        while power > 0:
            if power % 2 == 1:
                result = self._matmul(result, base)
            base = self._matmul(base, base)
            power //= 2
        return result

    def invert_matrix_4x4(self, A: List[List[float]]) -> List[List[float]]:
        """Inverts a 4x4 matrix using Gauss-Jordan elimination with partial pivoting"""
        n = 4
        # Augment A with identity
        aug = [A[i][:] + [1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]

        for col in range(n):
            # Pivot
            max_row = max(range(col, n), key=lambda r: abs(aug[r][col]))
            if abs(aug[max_row][col]) < 1e-12:
                raise ValueError("Singular matrix encountered in Markov fundamental matrix computation")
            aug[col], aug[max_row] = aug[max_row], aug[col]

            pivot = aug[col][col]
            for j in range(2 * n):
                aug[col][j] /= pivot

            for row in range(n):
                if row != col:
                    factor = aug[row][col]
                    for j in range(2 * n):
                        aug[row][j] -= factor * aug[col][j]

        return [[aug[i][n + j] for j in range(n)] for i in range(n)]

    def compute_fundamental_matrix(self, P: List[List[float]]) -> Dict[str, Any]:
        """
        Calculates Fundamental Matrix N = (I_4 - Q)^-1 for absorbing Markov chain.
        Q is 4x4 transient submatrix; R is 4x1 absorption matrix to Death.
        """
        # Extract Q (4x4) and R (4x1)
        Q = [[P[i][j] for j in range(4)] for i in range(4)]
        R = [[P[i][4]] for i in range(4)]

        # Compute I - Q
        I_minus_Q = [
            [(1.0 if i == j else 0.0) - Q[i][j] for j in range(4)]
            for i in range(4)
        ]

        try:
            N = self.invert_matrix_4x4(I_minus_Q)
        except Exception:
            # Fallback perturbation if near singular
            for i in range(4):
                I_minus_Q[i][i] += 1e-5
            N = self.invert_matrix_4x4(I_minus_Q)

        # Expected steps to absorption: t = N * 1
        t_steps = [sum(N[i][j] for j in range(4)) for i in range(4)]

        # Absorption probabilities: B = N * R
        B = self._matmul(N, R)

        transient_names = self.state_names[:4]
        return {
            "Q_submatrix": [[round(val, 4) for val in row] for row in Q],
            "fundamental_matrix_N": [[round(val, 3) for val in row] for row in N],
            "expected_time_to_absorption_years": {
                transient_names[i]: round(t_steps[i], 2) for i in range(4)
            },
            "ultimate_death_probability": {
                transient_names[i]: round(B[i][0], 4) for i in range(4)
            }
        }

    def project_trajectory(self, 
                           initial_distribution: List[float] = None, 
                           transition_matrix: List[List[float]] = None, 
                           cycles: int = 10) -> Dict[str, Any]:
        """
        Simulates year-over-year Markov cohort progression.
        """
        P = transition_matrix if transition_matrix else self.default_matrix
        if not initial_distribution:
            # Typical starting cohort of 100,000 infected individuals entering cascade
            initial_distribution = [0.0, 100000.0, 0.0, 0.0, 0.0]

        # Normalize initial distribution if needed
        total = sum(initial_distribution)
        dist = [x / total for x in initial_distribution]

        timeline = []
        series = {name: [] for name in self.state_names}

        curr = dist[:]
        for cycle in range(cycles + 1):
            timeline.append(2024 + cycle)
            for idx, name in enumerate(self.state_names):
                series[name].append(round(curr[idx] * total, 1))

            if cycle < cycles:
                curr = self._vec_mat_mul(curr, P)

        fund_analysis = self.compute_fundamental_matrix(P)

        return {
            "timeline": timeline,
            "series": series,
            "final_distribution_pct": {
                self.state_names[i]: round(curr[i] * 100, 2) for i in range(5)
            },
            "absorbing_metrics": fund_analysis
        }

