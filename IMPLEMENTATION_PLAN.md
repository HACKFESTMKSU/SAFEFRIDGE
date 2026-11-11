# ColdGuard — Phased Implementation Plan

| Field | Value |
| --- | --- |
| Based on | SRS v1.0 (11 November 2026) |
| Goal | Ship a working MVP that meets §11.1 acceptance, then layer commercial and AI features |
| Stack (from SRS) | ESP32 firmware · MQTT/TLS · FastAPI · PostgreSQL · TimescaleDB · Redis · React · Africa’s Talking / Twilio / WhatsApp |

---

## Guiding principles

1. **Vertical slices over horizontal layers** — each phase ends with something demonstrable (device → cloud → UI → alert), not only backend scaffolding.
2. **MVP Must-haves (M) first** — Should (S) and Could (C) items are deferred unless they unblock an M requirement.
3. **Threshold monitoring before AI** — AI is decision support and must be disableable (ML-05, ML-06).
4. **Offline resilience is core** — local buffer + GSM SMS fallback are MVP acceptance items, not polish.
5. **Tenant isolation from day one** — every query and MQTT topic is scoped by tenant (FR-02, NFR-15).

---

## Phase map

```text
Phase 0  Foundation & platform skeleton
Phase 1  Edge device + cloud ingestion (telemetry path)
Phase 2  Registry, dashboard, live monitoring
Phase 3  Alerts, incidents, notifications (MVP core)
Phase 4  Offline resilience, GSM, OTA, hardening
Phase 5  AI / analytics (anomaly + explainability)
Phase 6  Commercial release (S features) & pilot
Phase 7  Production readiness, UAT, launch
```

| Phase | Focus | Outcome |
| --- | --- | --- |
| 0 | Foundation | Runnable local stack, auth, empty schemas |
| 1 | Ingestion | Device publishes; cloud stores readings |
| 2 | Dashboard | Sites/assets/devices managed; live + history UI |
| 3 | Incidents | Excursion → alert → ack → resolve → report |
| 4 | Resilience | Buffer, SMS fallback, OTA, security bar |
| 5 | AI MVP | Baseline anomaly + root-cause hints |
| 6 | Commercial | Humidity/compressor/ambient, webhooks, exports |
| 7 | Launch | Lab + field UAT, staging/prod, pilot |

---

## Phase 0 — Foundation & platform skeleton

**Objective:** Shared infrastructure, identity, and multi-tenant data model so later phases plug into a stable core.

### Deliverables

- Monorepo (or clear multi-repo) layout: `firmware/`, `backend/`, `web/`, `infra/`, `docs/`
- Local `docker-compose`: PostgreSQL, TimescaleDB (or Postgres + Timescale), Redis, Mosquitto/EMQX
- FastAPI project skeleton with health checks, structured logging, config via env
- React app scaffold with routing, auth shell, design tokens
- Core relational schema: Tenant, User, Role, Site, Asset, Device, Sensor, AuditLog
- Auth: email/password registration, verification email, login, password reset (FR-01 partial)
- RBAC middleware enforcing roles on API (FR-03); tenant isolation tests
- CI: lint, unit tests, container build
- Environments documented: Dev / Staging / Prod / Hardware lab (§13.1)

### Exit criteria

- [ ] User can register, verify, log in, and call a protected `/me` endpoint
- [ ] Tenant A cannot read Tenant B data in API tests
- [ ] Compose stack starts with one command; migrations apply cleanly
- [ ] Audit log records login and failed auth attempts

### SRS coverage

FR-01 (base), FR-02, FR-03 (base), FR-04 (profile fields), NFR-12/14/15/16/19 (scaffolding), §7.1 entities

---

## Phase 1 — Edge device + cloud ingestion

**Objective:** Close the physical-to-cloud loop: sensors → MQTT → validated storage.

### Hardware / firmware

- ESP32 / ESP32-S3 board bring-up (HW-01)
- Sensors: internal temperature probe (FR-09), door reed (FR-11), voltage/power (FR-12), status LED (HW-08)
- Configurable sample interval (default 60s; 10s–15min)
- Local clock + timestamps; basic sensor plausibility checks (FR-15 start)
- MQTT over TLS publish to topics (§8.1):
  - `.../telemetry`, `.../events`, `.../status`
- Device credentials (token or cert) unique per device (NFR-18)
- Minimal local buffer (even if not yet 30 days) for short disconnects

### Cloud

- MQTT broker with TLS and per-device auth
- Ingestion worker: validate payload → write time-series + device last-seen
- Quality flags: Valid / Suspicious / Missing / Delayed (§7.3)
- Device registry API: create device, issue credentials, record firmware version

### Exit criteria

- [ ] Lab device reports temperature, door, power, battery/signal at least once per minute
- [ ] Telemetry visible in DB within 500ms under lab load (NFR-03 target)
- [ ] Invalid or out-of-range readings flagged, not silently stored as Valid
- [ ] Device shows online / last-seen after first connect (FR-18 partial)

### SRS coverage

FR-07 (provisioning start), FR-09, FR-11, FR-12, FR-15 (partial), FR-18 (partial), HW-01–05/08, §8.1, NFR-03/13/18

---

## Phase 2 — Registry, dashboard, live monitoring

**Objective:** Operators can manage sites/assets/devices and see live + historical status.

### Backend / API

- Site CRUD + user–site assignment (FR-05)
- Asset registration with thresholds and status lifecycle (FR-06); archive instead of hard delete
- Device provisioning: QR / pairing code, activate on first successful pair (FR-07)
- Telemetry query APIs: latest, range, aggregates (min/max/avg)
- Connectivity status: online / offline / degraded; offline alert rule stub (FR-18)

### Frontend

- Login + MFA entry point (TOTP) (FR-01)
- Executive / site / asset dashboards (§8.2)
- Live reading + 24h / 7d / 90d charts (FR-09)
- Device management: pair, reassign, health
- Mobile-responsive layout (NFR-27)

### Exit criteria

- [ ] Admin creates site → asset → pairs device via QR/code
- [ ] Dashboard shows current temp and historical chart within NFR targets in staging
- [ ] Filter by site and asset status works
- [ ] Device offline after missed interval is visible on UI

### SRS coverage

FR-05–07, FR-09 (display), FR-18, NFR-01/05/27/28/30, §8.2 primary screens (partial)

---

## Phase 3 — Alerts, incidents, notifications (MVP core)

**Objective:** Meet the core “excursion → respond → document” product promise.

### Rules engine

- Warning / critical high-low thresholds with duration before fire (FR-19)
- Validation of threshold configs
- Maintenance mode with expiry; critical alerts policy (FR-22)
- Automatic incident creation with unique reference (FR-24)
- Dedup: related alerts link to one incident

### Notifications

- In-app + email (FR-20)
- SMS + WhatsApp via Africa’s Talking / Twilio / WhatsApp Business (FR-20, FR-40)
- Delivery status logging
- Escalation ladder (default 10 min) until ack/resolve (FR-21)
- Quiet hours with critical bypass (FR-04)

### Incident workflow

- Acknowledge (dashboard / deep link) stops escalation (FR-25)
- Guided response copy by issue type (FR-26)
- Resolve with category, notes, optional photos (FR-27)
- Searchable history + CSV/Excel export (FR-28 partial)
- Excursion PDF report with immutable incident ID (FR-35)

### Exit criteria (aligns with §11.1)

- [ ] Sustained temp excursion creates incident and notifies assigned users
- [ ] Unacked critical alert escalates on schedule
- [ ] Ack → guided action → resolve → PDF report downloadable
- [ ] Maintenance mode suppresses non-critical noise
- [ ] Every notification attempt logged

### SRS coverage

FR-19–22, FR-24–28, FR-35, FR-40, NFR-04/11/28/30, §10.2 excursion workflow

---

## Phase 4 — Offline resilience, GSM, OTA, security hardening

**Objective:** Pass remaining §11.1 hardware/ops acceptance and security bar (§11.3).

### Firmware / hardware

- Local storage ≥ 30 days at 1-min interval; chronological replay on reconnect (FR-16)
- Delayed readings keep original timestamps; quality flag Delayed
- GSM module: critical SMS when internet down; rate limits with critical override (FR-17)
- Battery / supercapacitor path: detect power loss & restore; ≥8h monitoring target (§6.2)
- Distinguish device-offline vs facility power outage where possible (FR-12, FR-18)
- OTA updates with rollback (HW-09, NFR-32/33)
- Enclosure, mount, factory reset for authorized staff (HW-10–12)
- Post-install verification test flow (§6.3)

### Platform security & compliance

- HTTPS everywhere; encrypted MQTT end-to-end verified
- Device credentials not reusable across tenants
- RBAC on every endpoint; audit: login, config, ack, export (NFR-16, §11.3)
- Encryption at rest for sensitive fields (NFR-17)
- Data retention defaults (§7.2); tenant retention config (NFR-24)
- Privacy: lawful basis record, subject access/correct/delete hooks (NFR-21–23)
- REST API keys / OAuth for integrations (FR-38 base)

### Exit criteria

- [ ] Simulated internet outage: buffer fills, then replay preserves timestamps
- [ ] Simulated outage: SMS critical alert delivered with asset, temp, threshold, time
- [ ] Short power cut: device keeps monitoring on backup
- [ ] OTA success + forced-fail rollback in hardware lab
- [ ] Security acceptance checklist §11.3 green in staging

### SRS coverage

FR-16–18, FR-12 (full), FR-38 (base), HW-06–12, NFR-07–10/12–19/21–24/32–36, §11.1 offline items, §11.3

---

## Phase 5 — AI & analytics (MVP anomaly)

**Objective:** Explainable anomaly detection on top of solid threshold monitoring; AI optional per tenant/asset.

### Models (MVP priority M)

- Per-asset baseline after ≥7 days valid data (FR-29)
- Anomaly score + top contributing factors
- Distinguish normal door-open recovery vs sustained drift
- Threshold engine remains primary path; AI disable flag (ML-05)

### Product surface

- Anomaly indicators on asset dashboard
- Incident enrichment with “likely factors” (basic correlation: door / power / sensor)
- Clear “decision support” labelling (ML-06)
- Log model version + features with each prediction (ML-04 start)

### Exit criteria (§11.2)

- [ ] Baseline builds after 7 days in lab/staging
- [ ] Injected abnormal pattern raises anomaly score
- [ ] Door vs power distinction ≥80% on scripted test set
- [ ] Disabling AI leaves threshold alerts intact
- [ ] Predictions logged with version metadata

### SRS coverage

FR-29, ML-05/06, §9, §10.1 step 8, §11.2

**Deferred to Phase 6:** FR-30 forecasting, FR-31 failure-risk, FR-32 root-cause assistant (full), FR-33 energy, FR-34 benchmarking

---

## Phase 6 — Commercial release features (Should-haves)

**Objective:** First commercial release beyond MVP.

### Sensing & analytics

- Humidity monitoring + thresholds (FR-10)
- Compressor current: duty cycle, short-cycling, recovery after door (FR-13)
- Ambient temp correlation charts (FR-14)
- Product categories & criticality-aware escalation (FR-08)
- Alert fatigue: grouping, cooldown, brief-fluctuation filter, quality report (FR-23)

### AI (Should)

- 15/30/60-min excursion forecast with confidence (FR-30)
- Failure-risk score 0–100 (FR-31)
- Ranked root-cause with technician confirm/reject feedback loop (FR-32)
- Energy/performance insights (FR-33); fleet benchmarking (FR-34)

### Platform

- Webhooks with signed payloads + retry (FR-39)
- Compliance export + scheduled reports (FR-36)
- Maintenance reports / MTBF-MTTR where data allows (FR-37)
- Full REST surface for assets, telemetry, incidents, reports (FR-38)
- Horizontal scale soak test toward 10k devices / 1k concurrent users (NFR-02/06/38)
- Swahili i18n prep (NFR-29) if capacity allows

### Exit criteria

- [ ] Demo script covers pharmacy, lab, and food cold-room personas
- [ ] Webhook + compliance export verified with a test consumer
- [ ] Forecast/risk features off-switchable; explanations shown
- [ ] Performance soak meets agreed staging SLOs

### SRS coverage

FR-08, FR-10, FR-13–14, FR-23, FR-30–34, FR-36–39, NFR-02/06/29/38/40, §10.3–10.4

---

## Phase 7 — Production readiness, UAT, launch

**Objective:** Prove the system with real facilities and operable production.

### Testing (§12)

- Unit: thresholds, incident states, RBAC, retention
- Integration: MQTT, ingestion, SMS/email/WhatsApp, buffer replay, reports
- Hardware lab: ±0.5°C accuracy, door latency &lt;2s, power detect &lt;5s, GSM weak-signal, battery duration, enclosure, OTA rollback
- UAT in ≥3 facility types: pharmacy, diagnostic lab, food cold-room operator
  - Door left open; 10-min power cut; abnormal compressor; sensor disconnect; unacked critical; cross-tenant access denied; export report; offline then reconnect

### Deployment (§13)

- Containerized services + IaC
- Blue-green or rolling backend deploys; staged firmware: lab → pilot → fleet
- Backups: daily + PITR; RTO 4h / RPO 15m; restore drill
- Observability: uptime, ingestion latency, alert latency, device connectivity, errors (NFR-36)
- Runbooks for outage, mass offline, alert storm, credential rotation

### Exit criteria

- [ ] §11.1, §11.2, §11.3 acceptance signed off
- [ ] UAT defects for Must-haves closed or waived in writing
- [ ] Production backup restore tested
- [ ] Pilot customer devices live with monitoring + escalation

---

## Cross-cutting workstreams (all phases)

| Stream | Ongoing work |
| --- | --- |
| **Hardware** | Sensor placement guide, calibration records, install checklist, spare policy |
| **Security** | Threat model updates, dependency scanning, pen-test before launch |
| **Data protection** | Kenya DPA notices, DPAs with SMS/email vendors, retention jobs |
| **Alert quality** | Tune defaults; track false-positive rate (risk §14) |
| **Docs** | Installer guide, operator playbook, API docs, disclaimer that ColdGuard is decision support |

---

## MVP definition of done (ship gate)

Taken from SRS §11.1 — do not call MVP “done” until all are true:

1. Device provisioned and paired to an asset  
2. Reports temperature, door, power, device health  
3. Dashboard shows live + historical readings  
4. Excursion → alert + incident  
5. User can acknowledge and resolve  
6. Downloadable excursion report  
7. Buffers during simulated internet outage  
8. SMS when internet unavailable  
9. Operates through short power interruption  
10. Admins configure thresholds and recipients  

AI (§11.2) and full security (§11.3) should be complete by end of Phase 5 and Phase 4 respectively, before pilot expansion.

---

## Suggested team swimlanes

| Role | Primary phases |
| --- | --- |
| Firmware / hardware | 1, 4, 7 (lab) |
| Backend / data | 0–6 |
| Frontend | 2, 3, 5–6 |
| ML / analytics | 5–6 |
| DevOps / security | 0, 4, 7 |
| Product / QA / field | 3, 6, 7 |

---

## Risk checkpoints (from SRS §14)

| When | Check |
| --- | --- |
| End of Phase 3 | Alert volume in lab; add cooldowns early if noisy |
| End of Phase 4 | Offline/SMS cost model validated |
| End of Phase 5 | AI explanations reviewed by non-technical operators |
| Before Phase 7 pilot | Legal disclaimer + retention policies live |
| Ongoing | Installation quality audits to avoid bad sensor placement |

---

## Out of scope until after commercial release

- Custom roles (FR-03 later release)
- Multi-region deployment (NFR-39)
- Energy optimizer as a full product (FR-33/§9 Could)
- Swahili as launch-blocking (NFR-29 Should)
- Features listed under Future Enhancements if re-added to SRS

---

## Document control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 11 November 2026 | Initial phased plan derived from SRS v1.0 |
