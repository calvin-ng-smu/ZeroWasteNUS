from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class SimulatorConfig:
    base_url: str
    tick_seconds: float
    events_per_tick: int
    p_rental: float
    p_byo: float
    p_disposable: float
    initial_active_rentals: int
    return_prob_per_active_per_tick: float
    max_returns_per_tick: int
    once: bool
    quiet: bool


def clamp_int(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, int(value)))


def poisson(lam: float) -> int:
    """Poisson sampler without numpy.

    - For small lam, use Knuth algorithm.
    - For larger lam, use normal approximation.
    """

    if lam <= 0:
        return 0

    if lam < 30:
        l = math.exp(-lam)
        k = 0
        p = 1.0
        while p > l:
            k += 1
            p *= random.random()
        return k - 1

    # Normal approximation; clamp to >= 0
    x = random.gauss(lam, math.sqrt(lam))
    return max(0, int(round(x)))


def post_json(url: str, payload: dict, timeout_seconds: float = 5.0) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else {}


def build_config(argv: list[str]) -> SimulatorConfig:
    parser = argparse.ArgumentParser(description="Simulate cup rentals/returns and cup-share choices.")
    parser.add_argument("--base-url", default="http://localhost:3001", help="API base URL")
    parser.add_argument("--tick-seconds", type=float, default=1.0, help="Seconds between updates")
    parser.add_argument("--events-per-tick", type=int, default=12, help="How many cup-choice events per tick")

    parser.add_argument("--p-rental", type=float, default=0.33, help="Probability of choosing Campus Rental")
    parser.add_argument("--p-byo", type=float, default=0.33, help="Probability of choosing BYO")
    parser.add_argument("--p-disposable", type=float, default=0.34, help="Probability of choosing Single-Use")

    parser.add_argument(
        "--initial-active-rentals",
        type=int,
        default=1850,
        help="Starting point for local return simulation (UI seed shows 1850)",
    )
    parser.add_argument(
        "--return-prob",
        type=float,
        default=0.001,
        help="Per-tick probability each active rental returns (e.g. 0.001)",
    )
    parser.add_argument(
        "--max-returns-per-tick",
        type=int,
        default=25,
        help="Safety cap to avoid huge sudden drops",
    )

    parser.add_argument("--once", action="store_true", help="Run a single tick then exit")
    parser.add_argument("--quiet", action="store_true", help="No per-tick logs")

    args = parser.parse_args(argv)

    p_sum = args.p_rental + args.p_byo + args.p_disposable
    if p_sum <= 0:
        parser.error("Probabilities must sum to > 0")

    # Normalize probabilities so user doesn't need exact sum=1.
    p_rental = args.p_rental / p_sum
    p_byo = args.p_byo / p_sum
    p_disposable = args.p_disposable / p_sum

    return SimulatorConfig(
        base_url=args.base_url.rstrip("/"),
        tick_seconds=max(0.05, float(args.tick_seconds)),
        events_per_tick=clamp_int(args.events_per_tick, 0, 10_000),
        p_rental=p_rental,
        p_byo=p_byo,
        p_disposable=p_disposable,
        initial_active_rentals=max(0, int(args.initial_active_rentals)),
        return_prob_per_active_per_tick=max(0.0, float(args.return_prob)),
        max_returns_per_tick=clamp_int(args.max_returns_per_tick, 0, 10_000),
        once=bool(args.once),
        quiet=bool(args.quiet),
    )


def main(argv: list[str]) -> int:
    cfg = build_config(argv)

    simulate_url = f"{cfg.base_url}/api/simulate"

    active_rentals_est = cfg.initial_active_rentals

    weights = [cfg.p_rental, cfg.p_byo, cfg.p_disposable]
    labels = ["rental", "BYO", "disposable"]

    if not cfg.quiet:
        print(f"POSTing to {simulate_url}")
        print(
            "Press Ctrl+C to stop. "
            f"tick={cfg.tick_seconds}s events/tick={cfg.events_per_tick} return_prob={cfg.return_prob_per_active_per_tick}"
        )

    while True:
        rental = 0
        byo = 0
        disposable = 0

        for _ in range(cfg.events_per_tick):
            choice = random.choices(labels, weights=weights, k=1)[0]
            if choice == "rental":
                rental += 1
            elif choice == "BYO":
                byo += 1
            else:
                disposable += 1

        # Returns are based on current active rentals estimate.
        expected_returns = active_rentals_est * cfg.return_prob_per_active_per_tick
        returns = poisson(expected_returns)
        returns = clamp_int(returns, 0, min(active_rentals_est, cfg.max_returns_per_tick))

        payload = {
            "byo": byo,
            "rental": rental,
            "disposable": disposable,
            "returns": returns,
        }

        try:
            _ = post_json(simulate_url, payload)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else ""
            print(f"HTTP error {e.code}: {body}", file=sys.stderr)
            return 2
        except urllib.error.URLError as e:
            print(f"Connection error: {e}", file=sys.stderr)
            return 3

        active_rentals_est = max(0, active_rentals_est + rental - returns)

        if not cfg.quiet:
            print(
                f"+tick: rental={rental} byo={byo} single_use={disposable} "
                f"returns={returns} active_rentals_est={active_rentals_est}"
            )

        if cfg.once:
            return 0

        time.sleep(cfg.tick_seconds)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
