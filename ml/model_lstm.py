"""PyTorch LSTM for weekly case forecasting (TensorFlow alternative for Python 3.14+).

Architecture (per thesis §2.4.1):
  Input  -> LSTM(hidden) -> Dropout -> LSTM(hidden) -> Linear(horizon)

The two stacked LSTM layers learn lagged, non-linear dependencies between
historical morbidity, climate (rain/temp/humidity), and environmental risk
factors, projecting 1..4-week ahead case counts for one (municipality, disease).
"""
from __future__ import annotations

import torch
import torch.nn as nn


class CaseLSTM(nn.Module):
    """Stacked LSTM forecaster mapping a [B, L, F] window to H future weeks.

    Parameters
    ----------
    n_features : int
        Number of input features per timestep (F).
    hidden : int
        Hidden state size for both LSTM layers.
    dropout : float
        Dropout probability applied between the two LSTM layers.
    horizon : int
        Number of future weeks to predict (output dimension H).
    """

    def __init__(
        self,
        n_features: int,
        hidden: int = 64,
        dropout: float = 0.2,
        horizon: int = 4,
    ) -> None:
        super().__init__()
        self.lstm1 = nn.LSTM(n_features, hidden, batch_first=True)
        self.drop = nn.Dropout(dropout)
        self.lstm2 = nn.LSTM(hidden, hidden, batch_first=True)
        self.head = nn.Linear(hidden, horizon)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm1(x)
        out = self.drop(out)
        out, _ = self.lstm2(out)
        last = out[:, -1, :]
        return self.head(last)
