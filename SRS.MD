# Software Requirements Specification

**ColdGuard** — Intelligent Cold-Storage Monitoring and Reliability Platform

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Date | 11 November 2026 |
| Status | Draft for development |
| Product owner | [Company / Founder name] |
| Prepared for | Engineering, product, QA, hardware, and business teams |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Overview](#3-system-overview)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Hardware Requirements](#6-hardware-requirements)
7. [Data Requirements](#7-data-requirements)
8. [External Interfaces](#8-external-interfaces)
9. [AI and ML Requirements](#9-ai-and-ml-requirements)
10. [Workflow Requirements](#10-workflow-requirements)
11. [Acceptance Criteria](#11-acceptance-criteria)
12. [Testing Requirements](#12-testing-requirements)
13. [Deployment Requirements](#13-deployment-requirements)
14. [Risks and Mitigations](#14-risks-and-mitigations)
15. [Future Enhancements](#15-future-enhancements)
16. [References](#16-references)

---

## 1. Introduction

### 1.1 Purpose

This document defines the functional, non-functional, hardware, data, security, integration, and acceptance requirements for ColdGuard.

ColdGuard continuously monitors temperature-controlled storage assets, detects abnormal conditions, predicts likely failures or excursions, explains probable causes, and guides staff through a rapid response workflow.

The system is intended for:

- Pharmacies and medical stores
- Hospitals, clinics, laboratories, and blood banks
- Vaccine distribution centers and county health facilities
- Food processors, exporters, distributors, retailers, and cold-room operators
- Logistics providers operating refrigerated storage or transport

### 1.2 Product Vision

ColdGuard will help organizations prevent inventory loss by transforming refrigeration assets from passive equipment into monitored, diagnosable, and predictable systems.

The product will not merely report that a cold room is warm. It will identify what is happening, estimate why it is happening, assess the business risk, and recommend the next action.

### 1.3 Scope

#### In Scope for MVP

- ESP32-based IoT monitoring devices
- Temperature, humidity, door, power, compressor-current, and ambient-temperature monitoring
- Local data buffering during internet or power interruptions
- Cloud ingestion through MQTT
- Real-time dashboard and historical analytics
- Configurable alarms and escalation
- SMS, email, and WhatsApp alerts
- Basic anomaly detection and root-cause suggestions
- Incident logging, acknowledgement, resolution, and reporting
- Multi-site administration
- Role-based access control
- Audit trails and exportable compliance reports



### 1.4 Intended Users

| User role | Primary needs |
| --- | --- |
| Facility attendant | See current status, receive alerts, acknowledge incidents, follow response instructions |
| Pharmacy manager | Monitor multiple fridges, review incidents, configure thresholds, export reports |
| Technician | View fault history, diagnose likely causes, update maintenance status |
| Operations manager | Monitor all sites, identify high-risk assets, review performance |
| Administrator | Manage users, sites, devices, alert rules, integrations, and billing |
| Auditor / quality officer | Access immutable incident records and export reports |
| System administrator | Manage tenants, devices, integrations, security, and platform configuration |

### 1.5 Definitions

| Term | Definition |
| --- | --- |
| Asset | A monitored refrigerator, freezer, cold room, cold box, or storage unit |
| Site | A physical location containing one or more assets |
| Device | An ESP32-based edge monitoring unit installed on an asset |
| Sensor | A hardware component measuring temperature, humidity, door state, current, etc. |
| Telemetry | Time-stamped readings transmitted from a device |
| Excursion | A temperature reading outside the configured acceptable range |
| Incident | A detected or reported abnormal event requiring review or action |
| Alert | A notification generated when a rule or AI model identifies a risk |
| Acknowledgement | A user’s confirmation that an alert has been seen and is being handled |
| Resolution | Closure of an incident after corrective action is recorded |
| Tenant | A customer organization using the platform |
| Edge device | Local hardware that senses, buffers, and transmits data |

---

## 2. Overall Description

### 2.1 Product Perspective

ColdGuard is a new, standalone cloud-based IoT platform. It can operate independently or integrate with existing facility-management, maintenance, pharmacy, and enterprise systems through APIs and webhooks.

The system consists of:

- Edge hardware installed at each monitored asset
- Connectivity layer using Wi-Fi, Ethernet, or GSM/LTE
- Cloud backend for ingestion, storage, analytics, alerts, and reporting
- Web application for monitoring, configuration, incident management, and reporting
- Notification services for SMS, email, WhatsApp, and web push
- AI/ML services for anomaly detection, forecasting, risk scoring, and root-cause classification

### 2.2 Product Positioning

ColdGuard is positioned as a cold-storage reliability and incident-response platform, not simply a temperature logger.

Its differentiation is:

- Monitoring plus prediction
- Monitoring plus root-cause assistance
- Monitoring plus guided response
- Offline resilience
- Multi-site visibility
- Low-cost deployment for small and mid-sized businesses
- Audit-ready incident documentation

### 2.3 User Needs

| User need | Product response |
| --- | --- |
| “I need to know immediately if my fridge is failing.” | Real-time monitoring, configurable thresholds, and multi-channel alerts |
| “I need to know whether stock is at risk.” | Excursion duration, severity, product-risk classification, and recommended action |
| “I need to know why the temperature changed.” | Correlation of door, power, compressor, and ambient-temperature events |
| “I need to prevent repeat failures.” | Trend analysis, predictive risk scoring, and maintenance recommendations |
| “I need evidence for audits and insurance.” | Immutable event logs, excursion reports, and exportable documentation |
| “I need the system to work during outages.” | Local buffering, GSM fallback, and offline alerting |
| “I manage many sites.” | Central dashboard, asset inventory, site-level analytics, and role-based access |

### 2.4 Assumptions and Dependencies

The system assumes:

- Customers have physical access to install sensors in or near monitored assets.
- Facilities have access to mains power or an alternative power source.
- Devices have at least intermittent Wi-Fi, Ethernet, or GSM connectivity.
- Customers provide accurate product-storage requirements and acceptable temperature ranges.
- Customers are responsible for physical security of devices and facilities.
- The platform provides decision support; it does not replace professional maintenance, quality assurance, or regulatory compliance procedures.

---

## 3. System Overview

### 3.1 High-Level Architecture

```text
+---------------------------+
| Cold Room / Refrigerator/storage facility  |
| Temperature-controlled asset |
+------------+--------------+
             |
             v
+---------------------------+
| ESP32 Edge Device          |
| Sensors + local buffer     |
| GSM/Wi-Fi connectivity     |
+------------+--------------+
             |
             | MQTT over TLS
             v
+---------------------------+
| Cloud Ingestion Service   |
| MQTT broker + API gateway |
+------------+--------------+
             |
             v
+---------------------------+
| Core Backend Services      |
| Asset registry, rules,     |
| incidents, users, reports  |
+------------+--------------+
             |
             v
+---------------------------+
| AI / Analytics Service     |
| Anomaly detection,         |
| forecasting, risk scoring  |
+------------+--------------+
             |
             v
+---------------------------+
| Web Dashboard / Alerts     |
| SMS, email, WhatsApp, push |
+---------------------------+
```

### 3.2 Hardware Components

| Component | Purpose | MVP requirement |
| --- | --- | --- |
| ESP32 / ESP32-S3 | Main edge controller | Required |
| Temperature probe | Measures internal storage temperature | Required |
| Humidity sensor | Measures relative humidity | Optional but recommended |
| Door sensor | Detects door-open and door-close events | Required for cold rooms; optional for small fridges |
| Current sensor | Monitors compressor or refrigerator power draw | Required for predictive maintenance |
| Voltage sensor | Detects power availability and voltage instability | Required |
| Ambient temperature sensor | Measures external room temperature | Recommended |
| GSM module | Provides SMS and cellular data fallback | Required for priority deployments |
| Battery / supercapacitor | Maintains operation during short power interruptions | Required |
| Local storage | Buffers readings during connectivity loss | Required |
| Buzzer or external siren | Local audible alarm | Optional |
| Status LED | Shows device health and connectivity | Required |
| QR code / device label | Links physical device to cloud asset record | Required |

### 3.3 Software Components

| Component            | Technology options                                    | Responsibility                                                |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| Edge firmware        | ESP-IDF, Arduino, PlatformIO                          | Sensor reading, local buffering, MQTT publishing, OTA updates |
| MQTT broker          | EMQX, Mosquitto, AWS IoT Core                         | Secure device messaging                                       |
| Backend API          | Python FastAPI                                        | Business logic, authentication, configuration, reporting      |
| Time-series database | TimescaleDB, InfluxDB,                                | Sensor telemetry storage and querying                         |
| Relational database  | PostgreSQL                                            | Users, tenants, assets, incidents, configuration              |
| Cache / queue        | Redis, RabbitMQ                                       | Alerting, rate limiting, background jobs                      |
| AI service           | Python, FastAPI, scikit-learn, Prophet/statsmodels    | Anomaly detection, forecasting, risk scoring                  |
| Frontend             | React                                                 | Dashboard, configuration, incident management                 |
| Notifications        | Africa’s Talking, Twilio, SMTP, WhatsApp Business API | Multi-channel alert delivery                                  |
| Reporting            | PDF generation service                                | Audit-ready excursion and maintenance reports                 |

---

## 4. Functional Requirements

Requirements use the following priority definitions:

| Priority | Meaning |
| --- | --- |
| **M** | Must have for MVP |
| **S** | Should have in the first commercial release |
| **C** | Could have in a later release |

### 4.1 User and Tenant Management

#### FR-01: User Registration and Login — M

The system shall allow users to register, log in, and authenticate using email address and password.

**Acceptance criteria**

- A user can create an account using a valid email address and password.
- Passwords must meet minimum complexity requirements.
- The system must send a verification email before account activation.
- A user must be able to reset a forgotten password through a secure, time-limited link.
- The system must lock or rate-limit repeated failed login attempts.
- The system must support multi-factor authentication using a time-based one-time password.

#### FR-02: Tenant Management — M

The system shall support multiple customer organizations, known as tenants.

**Acceptance criteria**

- Each tenant must have isolated users, assets, configurations, incidents, and reports.
- A user may belong to one or more tenants.
- Tenant administrators can invite users by email.
- Tenant administrators can assign roles to users.
- Tenant administrators can deactivate users.
- Tenant data must not be accessible to users from another tenant.

#### FR-03: Role-Based Access Control — M

The system shall support role-based permissions.

| Role | Permissions |
| --- | --- |
| Super administrator | Manage platform tenants, global settings, and support functions |
| Tenant administrator | Manage users, sites, assets, devices, alert rules, integrations, and billing |
| Operations manager | View all sites and assets, configure thresholds, manage incidents, export reports |
| Facility attendant | View assigned assets, receive alerts, acknowledge incidents, record actions |
| Technician | View assigned assets, incident history, diagnostics, and update maintenance records |
| Auditor | View incidents and reports without configuration permissions |
| Read-only user | View dashboards and reports only |

**Acceptance criteria**

- The system must enforce permissions on both the API and frontend.
- A user must not be able to access assets outside their assigned scope.
- All privileged actions must be recorded in the audit log.
- Administrators must be able to create custom roles in a later release.

#### FR-04: User Profile Management — M

The system shall allow users to update their name, phone number, notification preferences, language, and password.

**Acceptance criteria**

- Users can update their profile information.
- Users can choose alert channels: email, SMS, WhatsApp, and push notification.
- Users can set quiet hours for non-critical alerts.
- Critical safety alerts must bypass quiet hours.
- Users can view their active sessions and sign out remotely.

### 4.2 Site and Asset Management

#### FR-05: Site Creation — M

The system shall allow administrators to create and manage physical sites.

**Acceptance criteria**

- Administrators can create a site with a name, physical address, GPS coordinates, timezone, contact person, and operational hours.
- Administrators can assign users to one or more sites.
- Administrators can archive a site without deleting historical data.
- The dashboard must support filtering by site, region, asset type, and status.

#### FR-06: Asset Registration — M

The system shall allow administrators to register refrigerators, freezers, cold rooms, and other temperature-controlled assets.

**Required asset fields**

- Asset name
- Asset type: refrigerator, freezer, cold room, blast freezer, incubator, warehouse zone
- Site
- Physical location within site
- Manufacturer and model
- Serial number
- Installation date
- Capacity
- Intended storage category
- Normal operating temperature range
- Critical temperature thresholds
- Assigned device
- Assigned users and technicians
- Maintenance schedule
- Status: active, inactive, under maintenance, decommissioned

**Acceptance criteria**

- Administrators can create, edit, archive, and decommission assets.
- Each asset must have a unique internal identifier.
- An asset may have one or more attached devices.
- An asset must have configurable minimum and maximum temperature limits.
- The system must prevent deletion of an asset with historical telemetry; it must support archival instead.

#### FR-07: Device Provisioning — M

The system shall allow administrators to provision an ESP32 device and associate it with an asset.

**Acceptance criteria**

- Each device must have a unique device ID and cryptographic credentials.
- Administrators can generate a QR code or pairing code for physical installation.
- A device must be activated only after successful pairing.
- A device can be reassigned to another asset only by an authorized user.
- The system must record device firmware version, last-seen time, battery or power status, and connectivity status.
- A device must be able to report its own health status.

#### FR-08: Product and Inventory-Risk Configuration — S

The system shall allow customers to define product categories and storage requirements.

**Acceptance criteria**

- Administrators can define product categories such as vaccines, insulin, blood products, dairy, meat, frozen food, flowers, and laboratory samples.
- Each category can have a recommended temperature range.
- Each category can have a criticality level: low, medium, high, critical.
- The system can assign products or storage zones to an asset.
- Alerts must consider product criticality when determining escalation priority.

### 4.3 Sensor and Telemetry Management

#### FR-09: Temperature Monitoring — M

The system shall continuously monitor the internal temperature of each asset.

**Acceptance criteria**

- The device shall read temperature at a configurable interval, defaulting to once every 60 seconds.
- The device shall support configurable intervals from 10 seconds to 15 minutes.
- The device shall timestamp each reading using a reliable local clock.
- The device shall transmit readings to the cloud through MQTT.
- The device shall buffer readings locally when connectivity is unavailable.
- The system shall display current temperature, 24-hour trend, 7-day trend, and 90-day trend.
- The system shall display minimum, maximum, and average temperature for selected periods.

#### FR-10: Humidity Monitoring — S

The system shall monitor relative humidity where a compatible sensor is installed.

**Acceptance criteria**

- The device shall read humidity at the same configurable interval as temperature.
- The system shall display live humidity and historical trends.
- Administrators can configure humidity thresholds.
- The system shall generate alerts when humidity remains outside configured limits.

#### FR-11: Door Monitoring — M

The system shall monitor door-open and door-close events using a magnetic reed sensor.

**Acceptance criteria**

- The device shall detect door-open and door-close events.
- The system shall record the duration of each door-open event.
- The system shall correlate door events with temperature changes.
- The system shall generate an alert when a door remains open beyond a configurable period.
- The system shall display door-open frequency by hour, day, and week.

#### FR-12: Power Monitoring — M

The system shall monitor mains power availability and detect power interruptions.

**Acceptance criteria**

- The device shall detect power loss and restoration.
- The device shall continue operating on battery or supercapacitor power during an outage.
- The device shall buffer telemetry during outages.
- The system shall send an immediate power-failure alert.
- The system shall display outage duration, frequency, and historical patterns.
- The system shall distinguish between a device offline event and a facility power outage where possible.

#### FR-13: Compressor and Equipment Monitoring — S

The system shall monitor electrical current or vibration associated with compressor operation.

**Acceptance criteria**

- The device shall sample compressor current at a configurable interval.
- The system shall calculate compressor duty cycle, run duration, and cycling frequency.
- The system shall detect abnormal patterns such as excessively frequent cycling or continuous running.
- The system shall flag deteriorating recovery performance after door openings.
- The system shall display compressor-health indicators on the asset dashboard.

#### FR-14: Ambient-Condition Monitoring — S

The system shall monitor ambient room temperature and humidity.

**Acceptance criteria**

- The device shall measure ambient conditions using an external sensor.
- The system shall correlate ambient conditions with internal temperature trends.
- The system shall identify cases where high ambient temperature contributes to storage risk.
- The system shall display ambient versus internal temperature comparison charts.

#### FR-15: Sensor Health Monitoring — M

The system shall monitor the health and reliability of connected sensors.

**Acceptance criteria**

- The device shall detect disconnected, out-of-range, or implausible sensor readings.
- The system shall generate a sensor-fault alert.
- The system shall distinguish a sensor fault from a genuine temperature excursion where possible.
- The system shall record sensor calibration date and next calibration due date.
- The system shall prevent critical alerts from being suppressed solely because a secondary sensor fails.

### 4.4 Connectivity and Offline Resilience

#### FR-16: Local Buffering — M

The device shall store telemetry locally when cloud connectivity is unavailable.

**Acceptance criteria**

- The device shall store at least 30 days of readings at the default one-minute interval.
- The device shall prioritize recent and critical events when storage is limited.
- Once connectivity is restored, the device shall upload buffered data in chronological order.
- The system shall mark delayed readings with their original timestamps.
- The device shall prevent data loss during short network interruptions.

#### FR-17: GSM Fallback — M

The device shall support GSM-based communication where Wi-Fi is unavailable or unreliable.

**Acceptance criteria**

- The device shall send critical alerts through SMS when internet connectivity is unavailable.
- The device shall support configurable SMS recipients.
- The device shall send a concise alert containing asset name, current temperature, threshold, and event time.
- The device shall avoid excessive SMS costs through configurable rate limits.
- Critical alerts must not be suppressed by SMS rate limits unless explicitly configured by an administrator.

#### FR-18: Device Connectivity Status — M

The system shall display the connectivity status of every device.

**Acceptance criteria**

- The system shall show whether a device is online, offline, degraded, or updating.
- The system shall show the last successful communication time.
- The system shall generate an alert when a device has not communicated within its expected interval.
- The system shall distinguish between device offline, site power outage, and internet outage where possible.

### 4.5 Alerts and Escalation

#### FR-19: Configurable Threshold Alerts — M

The system shall allow administrators to configure temperature and humidity thresholds.

**Acceptance criteria**

- Administrators can define warning and critical thresholds.
- Administrators can define separate thresholds for high and low temperature.
- Administrators can configure duration before an alert is triggered.
- Administrators can configure different thresholds by asset type and product category.
- The system shall support time-based rules, such as stricter thresholds during business hours.
- The system shall prevent invalid configurations, such as a minimum threshold higher than the maximum threshold.

#### FR-20: Multi-Channel Notifications — M

The system shall deliver alerts through multiple channels.

**Acceptance criteria**

- The system shall support in-app notifications.
- The system shall support email notifications.
- The system shall support SMS notifications.
- The system shall support WhatsApp notifications.
- The system shall support web push notifications.
- Administrators can configure recipients by role, site, asset, severity, and time of day.
- The system shall log delivery status for every notification.

#### FR-21: Alert Escalation — M

The system shall escalate unacknowledged critical alerts.

**Acceptance criteria**

- Administrators can configure escalation delay, defaulting to 10 minutes.
- If an alert is not acknowledged, the system shall notify the next recipient or group.
- Escalation levels must be configurable.
- Critical alerts must escalate until acknowledged, resolved, or manually closed by an authorized user.
- The system shall record every escalation attempt and delivery result.

#### FR-22: Alert Suppression and Maintenance Mode — M

The system shall allow authorized users to place an asset in maintenance mode.

**Acceptance criteria**

- Users can schedule planned maintenance windows.
- During maintenance, non-critical alerts can be suppressed.
- Critical safety alerts must remain configurable and cannot be permanently disabled without approval.
- The system shall record who activated maintenance mode, when, and why.
- Maintenance mode must expire automatically or require explicit extension.

#### FR-23: Alert Fatigue Prevention — S

The system shall reduce unnecessary alerts.

**Acceptance criteria**

- The system shall group repeated alerts for the same asset and cause.
- The system shall suppress duplicate alerts within a configurable cooldown period.
- The system shall distinguish brief, self-correcting fluctuations from sustained excursions.
- The system shall provide an alert-quality report showing false-positive and acknowledged-alert rates.
- Administrators can tune alert sensitivity by asset.

### 4.6 Incident Management

#### FR-24: Automatic Incident Creation — M

The system shall create an incident when a threshold, anomaly, or predictive-risk rule is triggered.

**Acceptance criteria**

- Each incident must include asset, site, severity, start time, detected cause, affected product category, and recommended action.
- Incidents must have a unique reference number.
- Incidents must remain open until acknowledged and resolved.
- Related alerts must be linked to the same incident.
- The system shall prevent duplicate incidents for the same underlying event where appropriate.

#### FR-25: Incident Acknowledgement — M

The system shall allow authorized users to acknowledge incidents.

**Acceptance criteria**

- A user can acknowledge an incident from the dashboard, mobile web interface, SMS link, or notification.
- The system must record the acknowledging user, timestamp, and channel.
- An incident cannot be acknowledged by the user who triggered a test alert.
- Acknowledgement must stop escalation for that incident.
- Acknowledgement does not automatically resolve the incident.

#### FR-26: Guided Response Workflow — M

The system shall provide recommended actions based on incident type.

| Detected issue | Recommended action |
| --- | --- |
| Door left open | Close the door, verify seal, check temperature recovery |
| Power interruption | Check backup power, move critical stock if outage persists |
| Rising temperature with normal power | Inspect compressor, condenser, airflow, and door seal |
| Repeated short cycling | Schedule technician inspection |
| High ambient temperature | Improve ventilation, reduce heat load, inspect insulation |
| Sensor fault | Inspect or replace sensor, verify with calibrated reference thermometer |

**Acceptance criteria**

- The system shall display a clear, non-technical recommended action.
- The system shall allow users to select the action taken.
- The system shall allow users to add notes, photos, and follow-up tasks.
- The system shall record the full response timeline.

#### FR-27: Incident Resolution — M

The system shall allow users to resolve incidents after corrective action.

**Acceptance criteria**

- Users must select a resolution category.
- Users may add notes, photos, and root-cause details.
- The system must record resolver identity and resolution timestamp.
- Resolved incidents remain searchable and exportable.
- The system shall calculate incident duration from detection to resolution.

#### FR-28: Incident History — M

The system shall maintain a complete incident history.

**Acceptance criteria**

- Users can search incidents by site, asset, date, severity, status, and cause.
- Users can filter incidents by product category and affected inventory.
- Users can export incidents to CSV, Excel, and PDF.
- Historical incident data must remain accessible according to the customer’s retention policy.

### 4.7 AI and Analytics

#### FR-29: Anomaly Detection — M

The system shall detect abnormal temperature and equipment behavior.

**Acceptance criteria**

- The system shall establish a baseline for each asset using at least 7 days of data.
- The system shall detect deviations from the asset’s normal operating pattern.
- The system shall distinguish normal door-opening recovery from abnormal sustained drift.
- The system shall assign an anomaly score.
- The system shall explain the main factors contributing to the anomaly.

#### FR-30: Excursion Forecasting — S

The system shall forecast the likelihood that an asset will exceed a critical threshold.

**Acceptance criteria**

- The system shall generate a forecast for 15, 30, and 60 minutes ahead.
- The system shall display forecast confidence or uncertainty.
- The system shall trigger an early-warning alert when the predicted risk exceeds a configured threshold.
- The system shall clearly label forecasts as predictions, not guarantees.
- The system shall allow administrators to disable forecasting for individual assets.

#### FR-31: Failure-Risk Prediction — S

The system shall estimate the likelihood of refrigeration equipment failure or degradation.

**Acceptance criteria**

- The system shall analyze compressor cycling, temperature recovery time, power interruptions, and historical incidents.
- The system shall assign a failure-risk score from 0 to 100.
- The system shall classify risk as low, medium, high, or critical.
- The system shall identify the leading contributing factors.
- The system shall recommend inspection or maintenance actions.

#### FR-32: Root-Cause Assistant — S

The system shall suggest likely causes for temperature excursions.

**Acceptance criteria**

- The system shall correlate door events, power events, compressor activity, and ambient conditions.
- The system shall rank likely causes by confidence.
- The system shall display supporting evidence for each cause.
- The system shall allow technicians to confirm or reject a suggested cause.
- User feedback shall be stored to improve future classification.

#### FR-33: Energy and Performance Analytics — S

The system shall provide energy and performance insights.

**Acceptance criteria**

- The system shall calculate estimated energy consumption where power monitoring is available.
- The system shall identify assets with abnormal energy use.
- The system shall compare performance across similar assets.
- The system shall identify opportunities to reduce door-open duration and compressor runtime.
- The system shall display cost-saving estimates where electricity tariffs are configured.

#### FR-34: Fleet Benchmarking — S

The system shall compare assets across sites.

**Acceptance criteria**

- Users can compare assets by uptime, excursion frequency, average temperature stability, and maintenance events.
- Users can identify worst-performing assets.
- Users can filter by site, asset type, manufacturer, and age.
- The system shall support downloadable benchmark reports.

### 4.8 Reporting and Compliance

#### FR-35: Excursion Report — M

The system shall generate an excursion report for each temperature excursion.

**Report contents**

- Asset name, location, and device ID
- Excursion start and end time
- Duration
- Minimum, maximum, and average temperature
- Configured threshold
- Severity classification
- Door and power events during the excursion
- Likely cause
- Actions taken
- Users involved
- Sensor evidence and charts
- Report generation timestamp

**Acceptance criteria**

- Users can generate a report for any historical excursion.
- Reports must be downloadable as PDF.
- Reports must include an immutable incident ID.
- Reports must be exportable in CSV format.
- Reports must support customer branding where permitted.

#### FR-36: Compliance Export — S

The system shall support exportable compliance records.

**Acceptance criteria**

- Users can export telemetry for a selected asset and date range.
- Exports must include raw readings, alarms, acknowledgements, resolutions, and device metadata.
- Exports must be digitally signed or hash-verified where feasible.
- The system must preserve audit logs for a configurable retention period.
- The system shall support scheduled weekly or monthly reports.

#### FR-37: Maintenance Report — S

The system shall generate maintenance and asset-health reports.

**Acceptance criteria**

- Users can view upcoming and overdue maintenance tasks.
- Users can export maintenance history by asset, technician, site, and date.
- The system shall track parts replaced, costs, downtime, and technician notes.
- The system shall calculate mean time between failures and mean time to repair where sufficient data exists.

### 4.9 Integrations

#### FR-38: REST API — M

The system shall expose a secure REST API for approved integrations.

**Acceptance criteria**

- The API must support authentication using OAuth 2.0 or API keys.
- The API must support retrieval of assets, current status, telemetry, incidents, and reports.
- The API must support webhook subscriptions for alert events.
- The API must enforce rate limits.
- The API must return standardized error responses.

#### FR-39: Webhook Notifications — S

The system shall send webhook notifications for selected events.

**Acceptance criteria**

- Customers can register webhook endpoints.
- Customers can select event types: alert created, alert acknowledged, incident resolved, device offline, excursion detected.
- The system shall retry failed webhook deliveries using exponential backoff.
- The system shall sign webhook payloads.
- The system shall log delivery attempts and failures.

#### FR-40: SMS and WhatsApp Integration — M

The system shall integrate with SMS and WhatsApp providers.

**Acceptance criteria**

- Administrators can configure SMS and WhatsApp providers.
- The system shall support delivery-status tracking.
- The system shall support fallback from WhatsApp to SMS.
- The system shall log message content, recipient, status, and cost where available.

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-01 | The dashboard shall load asset status within 2 seconds for up to 500 assets under normal network conditions. | M |
| NFR-02 | The backend shall ingest telemetry from at least 10,000 devices. | S |
| NFR-03 | The system shall process a normal telemetry message within 500 milliseconds. | M |
| NFR-04 | Critical alerts shall be generated within 10 seconds of threshold violation. | M |
| NFR-05 | Historical charts for 30 days shall load within 3 seconds. | M |
| NFR-06 | The system shall support at least 1,000 concurrent dashboard users in the target deployment. | S |

### 5.2 Availability and Reliability

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-07 | The cloud platform shall target 99.5% monthly availability during business hours. | M |
| NFR-08 | The edge device shall continue monitoring and buffering during internet outages. | M |
| NFR-09 | The edge device shall continue operating during short power interruptions. | M |
| NFR-10 | The system shall support automatic recovery after connectivity restoration. | M |
| NFR-11 | Critical alerts shall have a delivery success target of 99% where the communication provider is available. | S |

### 5.3 Security

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-12 | All web traffic shall use HTTPS/TLS 1.2 or higher. | M |
| NFR-13 | All device-to-cloud communication shall use TLS-encrypted MQTT. | M |
| NFR-14 | Passwords shall be stored using a modern salted password-hashing algorithm. | M |
| NFR-15 | The system shall enforce role-based authorization on every API endpoint. | M |
| NFR-16 | The system shall maintain immutable audit logs for security-relevant actions. | M |
| NFR-17 | The system shall encrypt sensitive data at rest. | M |
| NFR-18 | The system shall support device certificate or token-based authentication. | M |
| NFR-19 | The system shall protect against common vulnerabilities including SQL injection, XSS, CSRF, and insecure direct object references. | M |
| NFR-20 | The system shall support regular security patching and vulnerability scanning. | S |

> Kenya’s Data Protection Act requires controllers and processors to implement appropriate technical and organizational security measures, restrict access to authorized personnel, secure transfers and storage, maintain backups and logs, and use audit trails and event monitoring.

### 5.4 Privacy and Data Protection

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-21 | The system shall collect only personal data necessary for operating the service. | M |
| NFR-22 | The system shall obtain and record lawful basis for processing personal data. | M |
| NFR-23 | Users must be able to access, correct, and request deletion of their personal data where legally applicable. | M |
| NFR-24 | The system shall support data-retention policies configurable by tenant. | M |
| NFR-25 | The system shall support data export for a tenant upon authorized request. | S |
| NFR-26 | The system shall log all access to personal data. | M |

> Kenya’s Data Protection Act requires data controllers to inform data subjects about the purpose of collection, third parties, security measures, and consequences of not providing data; processing requires consent or another lawful basis.

### 5.5 Usability

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-27 | The dashboard shall be usable on desktop, tablet, and mobile browsers. | M |
| NFR-28 | The alert screen shall show asset, severity, current reading, threshold, and recommended action within one screen. | M |
| NFR-29 | The interface shall support English at launch; Swahili localization is a future requirement. | S |
| NFR-30 | Critical alerts shall use clear visual and textual severity indicators. | M |
| NFR-31 | The system shall provide accessible color contrast and keyboard navigation. | S |

### 5.6 Maintainability

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-32 | The system shall support remote firmware updates for edge devices. | M |
| NFR-33 | Firmware updates must support rollback if an update fails. | M |
| NFR-34 | The backend shall use modular services with clear API boundaries. | M |
| NFR-35 | The system shall support configuration changes without redeploying firmware where possible. | M |
| NFR-36 | All services shall emit structured logs, metrics, and traces. | M |

### 5.7 Scalability

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-37 | The architecture shall scale horizontally for backend services. | M |
| NFR-38 | The time-series database shall support at least 10,000 devices writing once per minute. | S |
| NFR-39 | The system shall support multi-region deployment in future releases. | C |
| NFR-40 | The system shall support data partitioning and archival for long-term telemetry. | S |

---

## 6. Hardware Requirements

### 6.1 Edge Device Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| HW-01 | The device shall use an ESP32 or ESP32-S3 microcontroller. | M |
| HW-02 | The device shall support Wi-Fi and GSM/LTE connectivity. | M |
| HW-03 | The device shall support at least one external temperature probe. | M |
| HW-04 | The device shall support a magnetic door sensor. | M |
| HW-05 | The device shall support voltage and current sensing. | M |
| HW-06 | The device shall support local storage for at least 30 days of readings. | M |
| HW-07 | The device shall operate from mains power with battery or supercapacitor backup. | M |
| HW-08 | The device shall provide visual status indicators for power, connectivity, and fault state. | M |
| HW-09 | The device shall support over-the-air firmware updates. | M |
| HW-10 | The device shall be mountable inside or adjacent to a cold room without interfering with operations. | M |
| HW-11 | The device enclosure shall be suitable for the intended environment, including moisture protection where required. | M |
| HW-12 | The device shall support a factory-reset mechanism accessible only to authorized personnel. | M |

### 6.2 Sensor Accuracy

Temperature accuracy should follow recognized cold-chain monitoring expectations. WHO performance specifications for temperature-monitoring devices require accuracy of ±0.5°C or better within the range -30°C to +20°C.

| Measurement | MVP target |
| --- | --- |
| Temperature accuracy | ±0.5°C or better |
| Temperature range | At least -30°C to +50°C |
| Humidity accuracy | ±5% RH or better |
| Door-event detection latency | Less than 2 seconds |
| Power-failure detection latency | Less than 5 seconds |
| Telemetry interval | Configurable, 10 seconds to 15 minutes |
| Local buffering | Minimum 30 days |
| Battery backup | Minimum 8 hours for monitoring and alerting |

### 6.3 Installation Requirements

- The temperature probe must be placed according to the asset’s intended use and customer’s storage policy.
- The device must not obstruct airflow, doors, shelves, or emergency exits.
- Installers must record sensor placement, calibration certificate, installation photos, and device serial number.
- The system must support a post-installation verification test.

---

## 7. Data Requirements

### 7.1 Core Entities

| Entity | Key fields |
| --- | --- |
| Tenant | ID, name, billing plan, status, created_at |
| User | ID, tenant ID, name, email, phone, role, status |
| Site | ID, tenant ID, name, address, coordinates, timezone |
| Asset | ID, site ID, type, model, serial number, status, thresholds |
| Device | ID, asset ID, firmware version, connectivity status, last seen |
| Sensor | ID, device ID, type, calibration date, status |
| Telemetry reading | Asset ID, device ID, timestamp, metric, value, unit, quality flag |
| Event | Asset ID, type, timestamp, duration, metadata |
| Incident | ID, asset ID, type, severity, status, detected_at, resolved_at |
| Alert | ID, incident ID, channel, recipient, status, delivery timestamp |
| Maintenance record | ID, asset ID, technician, issue, action, parts, cost, completion date |
| Audit log | Actor, action, entity, timestamp, IP address, metadata |

### 7.2 Data Retention

| Data type | Default retention |
| --- | --- |
| Raw telemetry | 24 months |
| Aggregated telemetry | 5 years |
| Incidents and reports | 7 years or customer-defined policy |
| Audit logs | 3 years minimum |
| User account data | Duration of contract plus legal retention period |
| Deleted user data | Anonymized or deleted according to customer instruction and legal requirements |

### 7.3 Data Quality Rules

The system shall flag readings as:

| Flag | Meaning |
| --- | --- |
| Valid | Within expected range and successfully transmitted |
| Suspicious | Outside plausible physical range or inconsistent with neighboring sensors |
| Missing | No reading received within the expected interval |
| Delayed | Received after the expected time but with original timestamp preserved |
| Calibration due | Sensor has reached its calibration interval |

---

## 8. External Interfaces

### 8.1 Device-to-Cloud Interface

**Protocol:** MQTT over TLS

**Example topics**

```text
coldguard/{tenant_id}/device/{device_id}/telemetry
coldguard/{tenant_id}/device/{device_id}/events
coldguard/{tenant_id}/device/{device_id}/status
coldguard/{tenant_id}/device/{device_id}/commands
coldguard/{tenant_id}/device/{device_id}/ota
```

**Example telemetry payload**

```json
{
  "device_id": "CRQ-DEV-00123",
  "asset_id": "AST-00456",
  "timestamp": "2026-11-11T08:25:00Z",
  "temperature_c": 4.2,
  "humidity_percent": 61.5,
  "door_state": "closed",
  "power_status": "mains",
  "compressor_current_a": 1.8,
  "ambient_temperature_c": 27.4,
  "battery_percent": 96,
  "signal_quality": -67,
  "firmware_version": "1.2.0"
}
```

### 8.2 Web Application Interface

The web application shall communicate with the backend through a REST or GraphQL API using HTTPS.

**Primary screens**

- Login and multi-factor authentication
- Executive dashboard
- Site dashboard
- Asset dashboard
- Incident list and incident detail
- Alert configuration
- Device management
- Maintenance management
- Reports and exports
- User and role management
- Integrations and API keys

### 8.3 Notification Interfaces

| Channel | Provider examples | Use case |
| --- | --- | --- |
| SMS | Africa’s Talking, Twilio | Critical alerts and offline fallback |
| Email | SMTP, SendGrid, Postmark | Reports, summaries, non-urgent alerts |
| WhatsApp | WhatsApp Business API | Operational alerts and response instructions |
| Web push | Firebase Cloud Messaging or web push | Real-time dashboard alerts |
| Webhooks | Customer systems | ERP, maintenance, or monitoring integrations |

---

## 9. AI and ML Requirements

### 9.1 Model Requirements

| Model | Input | Output | MVP priority |
| --- | --- | --- | --- |
| Threshold engine | Temperature, humidity, duration, asset config | Warning, critical, excursion | M |
| Anomaly detector | Historical telemetry, door events, power events | Anomaly score and explanation | M |
| Excursion forecaster | Recent telemetry, ambient conditions, door events | Probability of threshold breach | S |
| Failure-risk model | Compressor cycles, recovery time, outage history | Failure-risk score | S |
| Root-cause classifier | Event sequence and correlated signals | Ranked likely causes | S |
| Energy optimizer | Power use, door events, ambient temperature | Savings recommendations | C |

### 9.2 Training Data

The system shall collect and label:

- Temperature and humidity readings
- Door-open and door-close events
- Power interruptions and restorations
- Compressor current and cycling patterns
- Ambient conditions
- Incident reports
- Technician-confirmed root causes
- Maintenance outcomes
- False-positive and false-negative feedback

### 9.3 Model Governance

| ID | Requirement | Priority |
| --- | --- | --- |
| ML-01 | Every prediction must include a confidence or uncertainty measure. | S |
| ML-02 | Users must be able to view the main factors behind a prediction. | S |
| ML-03 | Users must be able to provide feedback on prediction accuracy. | S |
| ML-04 | Models must be versioned and traceable to training data. | S |
| ML-05 | The system must allow a customer to disable AI recommendations and use threshold-only monitoring. | M |
| ML-06 | AI outputs must be clearly labelled as decision support, not automated safety decisions. | M |

---

## 10. Workflow Requirements

### 10.1 Normal Monitoring Workflow

1. Device reads sensors.
2. Device validates readings.
3. Device stores reading locally.
4. Device publishes telemetry to MQTT.
5. Backend validates and stores reading.
6. Rules engine evaluates thresholds.
7. Dashboard updates current status.
8. AI service updates anomaly and risk indicators.
9. Alerts are generated only when configured conditions are met.

### 10.2 Temperature Excursion Workflow

1. Temperature crosses warning threshold.
2. System starts a warning timer.
3. If condition persists, system creates an incident.
4. System notifies assigned users.
5. User acknowledges the incident.
6. System displays likely cause and recommended action.
7. User records corrective action.
8. If temperature returns to normal, system marks recovery time.
9. User resolves incident with notes and evidence.
10. System generates an excursion report.

### 10.3 Power-Failure Workflow

1. Device detects mains-power loss.
2. Device switches to backup power.
3. Device sends critical alert through available channel.
4. Device continues monitoring and buffering.
5. If power is restored, device sends restoration event.
6. System calculates outage duration and impact.
7. System recommends inspection if outage frequency or duration becomes abnormal.

### 10.4 Predictive-Maintenance Workflow

1. System detects deteriorating compressor recovery time.
2. System increases asset failure-risk score.
3. System notifies operations manager and technician.
4. Technician reviews diagnostic evidence.
5. Technician schedules inspection or repair.
6. Technician records resolution and parts replaced.
7. System updates asset reliability profile.

---

## 11. Acceptance Criteria

### 11.1 Core Monitoring Acceptance

The MVP is accepted when:

- A device can be provisioned and paired with an asset.
- The device reports temperature, door status, power status, and device health.
- The dashboard displays live and historical readings.
- A temperature excursion generates an alert and incident.
- A user can acknowledge and resolve the incident.
- The system generates a downloadable excursion report.
- A device continues buffering during a simulated internet outage.
- A device sends an SMS alert when internet connectivity is unavailable.
- A device continues operating during a simulated short power interruption.
- Administrators can configure thresholds and notification recipients.

### 11.2 AI Acceptance

The AI features are accepted when:

- The system establishes a baseline after at least 7 days of valid data.
- The system detects a simulated abnormal temperature pattern.
- The system distinguishes a door-related event from a power-related event in at least 80% of test cases.
- The system provides an explanation for each anomaly or prediction.
- Users can disable AI recommendations without affecting threshold monitoring.
- Model outputs are logged with model version and input features.

### 11.3 Security Acceptance

The system is accepted when:

- All traffic uses HTTPS and encrypted MQTT.
- Unauthorized users cannot access another tenant’s data.
- Users cannot perform actions outside their assigned permissions.
- Password reset links expire after a defined period.
- Audit logs capture login, configuration, alert acknowledgement, and data-export events.
- Device credentials cannot be reused across tenants.

---

## 12. Testing Requirements

### 12.1 Unit Testing

- Sensor-reading validation
- Threshold evaluation
- Alert-rule logic
- Incident state transitions
- Role-based authorization
- API validation and error handling
- Data-retention policies

### 12.2 Integration Testing

- ESP32-to-MQTT communication
- Backend ingestion and database persistence
- Alert delivery through SMS, email, and WhatsApp
- Offline buffering and replay
- Webhook delivery and retry behavior
- Report generation

### 12.3 Hardware Testing

- Temperature accuracy against a calibrated reference thermometer
- Door-sensor reliability across repeated open/close cycles
- Power-failure detection and recovery
- GSM signal performance in weak-network conditions
- Battery backup duration
- Enclosure durability and moisture resistance
- Firmware update and rollback

### 12.4 User Acceptance Testing

Test with real users in at least three facility types:

- Pharmacy
- Diagnostic laboratory
- Food distributor or cold-room operator

**Test scenarios**

- A door is left open.
- Power is interrupted for 10 minutes.
- A compressor begins cycling abnormally.
- A temperature sensor is disconnected.
- A critical alert is not acknowledged.
- A user tries to access another tenant’s asset.
- A user exports an incident report.
- A device loses internet connectivity and later reconnects.

---

## 13. Deployment Requirements

### 13.1 Environments

| Environment | Purpose |
| --- | --- |
| Development | Local development and unit testing |
| Staging | Integration testing and customer demonstrations |
| Production | Live customer deployments |
| Hardware lab | Device testing, calibration, and firmware validation |

### 13.2 Deployment Strategy

- Use containerized backend services.
- Use infrastructure-as-code for repeatable deployment.
- Use blue-green or rolling deployment for backend updates.
- Use staged firmware rollout: internal lab, pilot devices, then customer fleet.
- Maintain rollback capability for both backend and firmware releases.
- Monitor uptime, ingestion latency, alert latency, device connectivity, and error rates.

### 13.3 Backup and Disaster Recovery

- Daily database backups
- Point-in-time recovery for the relational database
- Separate backup storage with restricted access
- Documented recovery-time objective of 4 hours for critical services
- Documented recovery-point objective of 15 minutes for transactional data
- Regular restore testing

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| False alarms cause alert fatigue | Users ignore alerts | Severity levels, cooldown periods, anomaly context, and tunable thresholds |
| Poor sensor placement | Incorrect readings | Installation guide, placement validation, calibration checks |
| Internet outage | Missed alerts | Local buffering and GSM SMS fallback |
| Power outage | Device failure | Battery backup and low-power firmware mode |
| Hardware failure | Monitoring gap | Device-health monitoring, replacement workflow, and spare inventory |
| Customer distrust of AI | Low adoption | Explainable outputs, human confirmation, and ability to disable AI |
| Regulatory exposure | Legal or compliance risk | Clear disclaimer, audit logs, configurable retention, and legal review |
| High installation cost | Slow adoption | Simple installation kit, QR-code pairing, and partner-installer model |
| Data breach | Reputational and legal risk | Encryption, access control, audit logs, incident-response plan |

---



---

## 16. References

1. WHO, *Vaccine Management Handbook: How to monitor temperatures in the vaccine supply chain* — continuous monitoring and excursion documentation guidance.
2. WHO PQS specification E006 — temperature-monitoring devices, data loggers, equipment monitoring devices, and alarm systems.
3. WHO PQS performance specification E006/TR03.2 — programmable remote temperature and event monitoring systems.
4. WHO temperature-monitoring specification — ±0.5°C accuracy requirement within -30°C to +20°C.
5. Kenya Data Protection Act, 2019 — lawful processing, consent, security measures, audit trails, and data-subject rights.
6. Kenya cold-chain and warehousing evidence — vaccine-network scale, equipment gaps, and refrigerated-warehousing growth.
7. Predictive-maintenance market estimates — global market size and growth outlook.
