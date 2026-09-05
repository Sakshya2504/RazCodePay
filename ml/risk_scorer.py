"""Small, reproducible scoring utility for the Track 3 demo.

The scorer uses synthetic features only. It is intentionally easy to inspect so
that the demo never presents an opaque number as if it were a financial truth.
"""

import json
import sys

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression


def train_demo_model() -> LogisticRegression:
    """Train on synthetic recovery outcomes used by the demo environment."""
    frame = pd.DataFrame(
        [
            # amount, attempts, has_consent, has_prior_success, recoverable
            [49900, 0, 1, 1, 1],
            [99900, 0, 1, 1, 1],
            [199900, 1, 1, 1, 1],
            [299900, 2, 1, 1, 0],
            [499900, 2, 0, 1, 0],
            [79900, 0, 1, 0, 1],
            [149900, 1, 0, 0, 0],
            [249900, 3, 1, 1, 0],
            [59900, 0, 1, 1, 1],
            [399900, 2, 1, 0, 0],
        ],
        columns=["amount_minor", "attempts", "has_consent", "has_prior_success", "recoverable"],
    )

    model = LogisticRegression(random_state=42, max_iter=1000)
    model.fit(frame.drop(columns="recoverable"), frame["recoverable"])
    return model


def score_case(case: dict) -> dict:
    model = train_demo_model()
    features = pd.DataFrame(
        [
            [
                float(case.get("amount_minor", 0)),
                float(case.get("attempts", 0)),
                int(bool(case.get("has_consent", False))),
                int(bool(case.get("has_prior_success", False))),
            ]
        ],
        columns=["amount_minor", "attempts", "has_consent", "has_prior_success"],
    )

    probability = float(model.predict_proba(features)[0, 1])
    # Keep the externally visible value stable to four decimal places.
    return {"recoverability_score": round(float(np.clip(probability, 0, 1)), 4)}


if __name__ == "__main__":
    payload = json.loads(sys.stdin.read() or "{}")
    print(json.dumps(score_case(payload)))
