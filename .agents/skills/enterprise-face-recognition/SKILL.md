---
name: enterprise-face-recognition
description: Standard and engineering guidelines for enterprise-grade 1:1 Biometric Face Recognition, Multi-Frame Master Face Enrollment, Active Liveness Presentation Attack Detection (ISO/IEC 30107), and PostgreSQL Database Synchronous Biometric Verification in Attendance Systems.
---

# Enterprise Face Recognition & Biometric Attendance System

This skill enforces enterprise standards for facial biometric authentication and master template enrollment in workforce management and attendance tracking applications.

## Core Architectural Pillars

### 1. Master Face Enrollment (Multi-Frame Centroid Averaging)
- Single-frame captures are susceptible to momentary lighting shifts, squinting, or micro-yaw angles.
- **Rule**: Collect 3 sequential valid frames (center neutral, micro-tilt, confirmation) during enrollment.
- Compute the normalized centroid feature vector:
  $$\vec{v}_{\text{master}} = \frac{\sum_{i=1}^{k} \vec{v}_i}{\left\|\sum_{i=1}^{k} \vec{v}_i\right\|_2}$$
- Store the resulting 128-dimensional unit vector in the database (`hrm_profiles.face_descriptor`).
- Enforce quality guardrails:
  - Minimum bounding box ratio: face must cover between 25% and 75% of the viewport.
  - Image sharpness check: Laplacian variance above threshold ($\sigma^2 \ge 40$).
  - Mean luminance verification: avoid underexposure ($< 40$) and blown-out highlights ($> 225$).

### 2. 1:1 Biometric Verification (Cosine Similarity Metric)
- For identity verification, compare live camera descriptor $\vec{u}$ with master template $\vec{v}$:
  $$\text{Cosine Similarity} = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\|_2 \|\vec{v}\|_2} = \sum_{j=1}^{128} u_j v_j$$
- Calibration to Confidence Percentage ($0 - 100\%$):
  - Threshold: $\tau = 0.75$ (75% similarity).
  - Matches $\ge \tau$: Valid employee attendance.
  - Mismatch $< \tau$: Deny clock-in/out and trigger anti-fraud proxy warning.

### 3. Active Liveness Defense (ISO/IEC 30107 PAD Level 1 & 2)
- Always couple biometric matching with active liveness challenge:
  - Dynamic distance expansion/contraction (moving camera away).
  - Chromatic reflection verification against skin surface.
  - Reject static print photos, screen replays, and video loops.

### 4. Zero-Trust Database Integration & Audit Trails
- Never rely exclusively on client local storage for biometric state.
- Biometric templates (`face_descriptor`, `face_enrolled_photo`, `face_enrolled_at`) must be persisted in PostgreSQL.
- Attendance records must store `biometric_score` and `biometric_match` along with server-verified timestamps.
