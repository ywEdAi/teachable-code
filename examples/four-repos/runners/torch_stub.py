"""Minimal numpy-backed stand-in for the few torch calls the notebook helpers use."""
import numpy as np
class T(np.ndarray):
    def numpy(self): return np.asarray(self)
def tensor(x, dtype=None): return np.asarray(x, dtype=float).view(T)
def full_like(x, v, dtype=None): return np.full_like(np.asarray(x, dtype=float), v).view(T)
float = np.float64
Tensor = T
