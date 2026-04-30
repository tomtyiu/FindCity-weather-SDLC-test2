# Release Checklist

This iteration is **local-only**. The checklist below is what would gate a future remote deploy.

## Gates

- [x] Requirements documented (`delivery/requirements.md`)
- [x] Design covers architecture, threat model, failure modes (`delivery/design.md`)
- [x] All 24 automated tests pass (`npm test`)
- [x] Manual smoke against live Open-Meteo passes (`delivery/test-plan.md`)
- [x] Static frontend renders and calls backend successfully
- [x] No secrets in source, env, or logs (verified by grep + design — Open-Meteo is keyless)
- [x] Final text-error pass across all authored files
- [ ] CI pipeline (out of scope this iteration)
- [ ] Helmet / CSP / TLS termination (required before any internet-facing deploy)
- [ ] Persistent rate-limit store (in-memory store does not survive restart or scale-out)

## Rollback plan

| Failure mode            | Action                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| Server crashes on start | `git revert` the offending commit; restart prior known-good binary.  |
| Open-Meteo outage       | Backend returns 502 already; UI shows a clear error. No action needed.|
| Upstream API change     | Pin a version-aware client behind the existing `openMeteo.js` seam.  |

## Observability today

- Stdout JSON logs with `event`, `query` (city or `coords:lat,lon`), `outcome`, `latencyMs`.
- `/healthz` for liveness checks.

## Observability deferred

- Metrics export (Prometheus / OTel).
- Structured trace IDs across request → upstream calls.
- Error rate alerting.
