---
name: hrm-anomaly-detection
description: Standard and engineering guidelines for attendance fraud radar, heuristic and statistical anomaly detection, device fingerprint collision analysis, geofence perimeter boundary abuse, and employee burnout risk index forecasting.
---

# HRM Attendance Anomaly Detection & Fraud Radar Standards

This skill governs the identification of fraudulent attendance patterns, location spoofing proxies, device sharing, and workforce fatigue indicators.

## Core Detection Vectors

### 1. Device Fingerprint Collision (Titip Absen Proxy Detection)
- If $N \ge 2$ distinct employee accounts clock in from the exact same hardware fingerprint within an overlapping 4-hour window, flag as `DEVICE_COLLISION_HIGH_RISK`.
- Severity Score: +40 points.

### 2. Geofence Boundary Abuse (Perimeter Clustering)
- If an employee repeatedly clocks in at $D \ge 0.90 \times R_{\text{allowed}}$ (within the outermost 10% edge of the permitted radius) for 3 consecutive days, flag as `GEOFENCE_EDGE_SUSPICIOUS`.
- Severity Score: +25 points.

### 3. Cut-off Timing Clustering (Last-Second Attendance)
- Clocking in consistently within 60 seconds before shift cut-off time indicates potential automated macro or proxy rush.
- Severity Score: +15 points.

### 4. Biometric Confidence Degradation
- If an employee's 1:1 match confidence drops from their historical baseline (>95%) to the borderline acceptance band (75% - 80%), flag as `BIOMETRIC_VARIANCE_WARNING`.

### 5. Employee Burnout Risk Index (Fatigue Forecasting)
- $\text{Burnout Index} = f(\text{Overtime Hours}, \text{Consecutive Days Worked}, \text{Late Trends})$.
- Weekly Overtime $> 14$ hours or working $\ge 12$ consecutive days triggers `BURNOUT_ELEVATED_RISK`.
