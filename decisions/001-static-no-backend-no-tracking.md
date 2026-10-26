# 001 · Static pages, no backend, no tracking

Date: 2026-10-15 (brief), 2026-10-17 (measurement) · Status: in force

## Decision
The page runs entirely in the visitor's browser. No server of our own, no accounts, no cookies, no analytics script. Inputs stay in the browser (sessionStorage; localStorage only if the visitor ticks "Remember my inputs"). The only outside requests are the live BTC price (Bitstamp, Coinbase as fallback).

## Why
Trust and privacy are the product's core for a Bitcoin audience; no server means nothing to attack or to leak; hosting is free.

## Alternatives considered
A small analytics script (rejected: breaks the privacy promise). Visitor numbers come from Cloudflare's server statistics, search terms from Google Search Console.

## Consequences
Any new outside service needs the privacy notice updated first (EN and DE, new version date).

## Sources
Owner's brief 2026-10-15; commit 370adef; README "Hosting and privacy"; decision 014.
