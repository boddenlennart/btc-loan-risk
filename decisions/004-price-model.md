# 004 · Price model: real 30-day stretches, recent years weigh more

Date: 2026-10-15, weighting 2026-10-19 · Status: in force

## Decision
The headline simulation is a block bootstrap of real BTC history since 2014 (30-day blocks, hourly lows for liquidation triggers, 10,000 paths, no trend). Recent years weigh more: half-life 3 years. Cross-checks shown next to it: GARCH(1,1) with Student-t errors, the real-history replay (every start day), and the textbook barrier/option value. Not lognormal.

## Why
Real crashes are far more frequent than a bell curve allows (since 2014: 10 days with falls of 15% or more, where lognormal expects about 0.01). The owner judges BTC's volatility to be maturing, so recent data weighs more, disclosed openly.

## Alternatives considered
Lognormal/GBM (only as a sanity check); equal weights for all years (cautious, but the owner chose 3-year half-life); jump diffusion (GARCH-t chosen).

## Consequences
Known limit: crash clusters longer than 30 days are only partly kept (GARCH models them); stated on How it works. A volatility stress is in the backlog.

## Sources
Owner 2026-10-15 (GARCH), 2026-10-19 (half-life); commit 85cb5e5; ux/K-math-audit.md; How it works.
