---
name: attendance-face-gps-bug-hunter
description: Expert software diagnostics, deep bug hunting, forensic code audit, and runtime invariant analysis specialized in Biometric Face Recognition (1:1 & Liveness) and GPS Geofencing/Multi-Point Location Attendance systems (React/TypeScript, Node.js/Express, PostgreSQL).
version: 1.0.0
---

# Master Attendance Face & GPS Geofence Bug Hunter & Auditor

An authoritative diagnostic skill and forensic engineering standard for identifying, isolating, debugging, and eradicating critical bugs, memory leaks, sensor race conditions, biometric drift, and location spoofing vulnerabilities in modern workforce attendance systems.

---

## 1. Biometric Face Recognition Bug Vectors & Diagnostics

### A. WebGL Context Loss, Memory Leaks & Video Stream Deadlocks
- **Symptoms:**
  - Camera freezes after multiple verifications or tab switches.
  - Mobile browser tab crashes with `Out of Memory` or WebGL context lost errors.
  - Video element shows a black screen or spins infinitely on subsequent modal openings.
- **Audit Checklist:**
  1. **Camera Track Disposal:** Always stop all media tracks when component unmounts or modal closes:
     ```typescript
     streamRef.current?.getTracks().forEach((track) => {
       track.stop();
       track.enabled = false;
     });
     videoRef.current.srcObject = null;
     ```
  2. **Mobile HTML5 Video Attributes:** Ensure mobile Safari & Chrome compatibility:
     `<video playsInline webkit-playsinline autoPlay muted />`
     *(Without `playsInline` and `muted`, iOS Safari blocks auto-play or opens native fullscreen player).*
  3. **Canvas Cleanup:** Destroy off-screen 2D/WebGL canvas contexts:
     Set canvas dimensions `width = 0; height = 0;` and explicitly release references.
  4. **Model Initialization Race Condition:** Guard model loading with a singleton promise to avoid loading weights multiple times in parallel:
     ```typescript
     let loadPromise: Promise<void> | null = null;
     export const loadFaceModels = () => {
       if (!loadPromise) loadPromise = Promise.all([/* models */]);
       return loadPromise;
     };
     ```

### B. Biometric Descriptor Serialization & Math Rounding Drift
- **Symptoms:**
  - Valid user enrolled previously is rejected 100% of the time during clock-in.
  - Match confidence evaluates to `0%` or `NaN%`.
- **Audit Checklist:**
  1. **Float32Array vs JSON Object Serialization:**
     `JSON.stringify(new Float32Array(...))` serializes to `{ "0": 0.12, "1": -0.05, ... }` instead of an array.
     When saving to PostgreSQL or client state, always convert:
     `Array.from(float32Array)` on write, and `new Float32Array(storedArray)` on read.
  2. **Cosine Similarity vs Euclidean Distance Calibration:**
     Ensure vectors are normalized before calculating dot product:
     $$\text{Cosine Similarity} = \sum_{i=1}^{128} u_i \cdot v_i \quad \text{where } \|u\|_2 = 1, \|v\|_2 = 1$$
     Verify that the database column or API payload does not truncate 128-dimensional floats to low precision.
  3. **Empty / Centroid Zero-Vector Guard:**
     Check if face detection failed mid-enrollment resulting in an array of zeroes. Division by zero L2-norm produces `NaN`.

### C. Forensic Watermark & Canvas Aspect Ratio Distortion
- **Symptoms:**
  - Watermark text stretched, blurry, or misaligned on high-DPI (Retina) screens.
  - Watermarked image payload causes HTTP 413 (Payload Too Large) on Express API.
- **Audit Checklist:**
  1. **Video Ready State Guard:** Never draw image from `<video>` before `video.videoWidth > 0 && video.readyState >= 2`. Drawing prematurely produces an empty black frame.
  2. **Device Pixel Ratio (DPR) Scaling:** Match canvas buffer dimensions to intrinsic video resolution, not CSS client dimensions:
     `canvas.width = video.videoWidth; canvas.height = video.videoHeight;`
  3. **JPEG Compression:** Compress captured frame using JPEG format with quality 0.82–0.85 instead of uncompressed PNG:
     `canvas.toDataURL('image/jpeg', 0.85)` (Reduces payload from ~4MB to ~250KB).

---

## 2. GPS Geolocation & Multi-Post Geofencing Bug Vectors

### A. Geolocation Watcher Leaks & iOS Safari Background Throttling
- **Symptoms:**
  - Battery drains rapidly; location icon stays active even after closing attendance screen.
  - GPS coordinates freeze or don't update when moving between posts.
- **Audit Checklist:**
  1. **Watch ID Cleanup:**
     Store `watchId` in a ref and clean up in `useEffect` return block:
     ```typescript
     const watchId = navigator.geolocation.watchPosition(success, error, options);
     return () => navigator.geolocation.clearWatch(watchId);
     ```
  2. **Timeout & High Accuracy Options:**
     ```typescript
     { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
     ```
     Never set `maximumAge: Infinity` as it returns cached coordinates from hours ago.
  3. **Error Handling Specificity:**
     Handle error codes explicitly:
     - `1 (PERMISSION_DENIED)`: Instruct user to enable browser/OS location permissions.
     - `2 (POSITION_UNAVAILABLE)`: Weak GPS signal or indoor dead zone.
     - `3 (TIMEOUT)`: Retry with `enableHighAccuracy: false` fallback if outdoor fix fails.

### B. Geodesic Math & Multi-Point Assigned Posts (Bank Pos) Invariants
- **Symptoms:**
  - Employee at Pos B is flagged as "Outside Perimeter" because the system only checked Pos A.
  - Coordinate inverted error (employee placed in the middle of the ocean).
- **Audit Checklist:**
  1. **Coordinate Ordering Invariant:**
     - Leaflet / Google Maps API: `[latitude, longitude]`
     - GeoJSON standard: `[longitude, latitude]`
     - Indonesian GPS coordinates: Latitude is negative in southern hemisphere (e.g. Jakarta ~-6.2, Makassar ~-5.14, Kendari ~-3.99). Never drop the minus sign!
  2. **Multi-Titik Evaluation (Bank Pos Rule):**
     When evaluating an employee assigned to multiple posts (`hrm_field_assigned_posts`), compute Haversine distance against **all active posts** and find the closest match:
     ```typescript
     const evaluations = posts.map(post => ({
       post,
       distance: calculateHaversineDistance(userLat, userLng, post.latitude, post.longitude),
       isInside: distance <= post.radius_meters
     }));
     const activePost = evaluations.find(e => e.isInside);
     // User is INSIDE if ANY assigned post isInside === true
     ```
  3. **Boundary Jitter & Hysteresis Buffer:**
     Prevent rapid flipping between "In Area" and "Perimeter Breach" when GPS accuracy oscillates around the boundary:
     Apply a 5-meter hysteresis threshold or require 2 consecutive out-of-bounds readings before triggering emergency breach alarms.

### C. Leaflet / Mapbox Map Container Lifecycle Bugs
- **Symptoms:**
  - `Error: Map container is already initialized.`
  - Map appears as gray tiles or broken tiles when opening inside a modal or switching tabs.
- **Audit Checklist:**
  1. **Container Cleanup:**
     ```typescript
     if (mapInstanceRef.current) {
       mapInstanceRef.current.remove();
       mapInstanceRef.current = null;
     }
     ```
  2. **Invalidate Size on Show:**
     Call `map.invalidateSize()` after modal animation finishes (e.g. inside `setTimeout(() => map.invalidateSize(), 200)`).

---

## 3. Attendance Transaction State Machine & Anti-Fraud Invariants

### A. Client Clock Tampering vs Server Time of Truth
- **Vulnerability:** Employee changes phone system clock back to 07:59 AM to evade late penalty.
- **Rule:**
  - Client clock is **UNTRUSTED**.
  - Attendance check-in timestamp MUST be generated by PostgreSQL server: `NOW()` / `CURRENT_TIMESTAMP`.
  - Client timestamp is used solely for drift anomaly detection:
    $$|\text{client\_timestamp} - \text{server\_timestamp}| > 120 \text{ seconds} \implies \text{Flag ANOMALY\_TIME\_TAMPERING}$$

### B. Concurrency Double-Tap & Idempotency
- **Vulnerability:** Unstable network causes user to tap "Clock In" 3 times, generating 3 duplicate rows or race condition errors.
- **Audit Checklist:**
  1. Client-side button disabling (`isSubmitting` flag or throttle hook).
  2. Database-level unique constraint on `(user_id, attendance_date)`:
     ```sql
     ALTER TABLE hrm_attendances ADD CONSTRAINT unique_user_daily_attendance UNIQUE (user_id, attendance_date);
     ```
  3. API idempotency: Handle `ON CONFLICT (user_id, attendance_date) DO UPDATE` or reject with clear 409 Conflict.

### C. Multi-Channel Notification & WhatsApp Gateway Resilience
- **Vulnerability:** WhatsApp gateway timeout blocks attendance HTTP response, causing user-visible 500 error even though DB insert succeeded.
- **Audit Checklist:**
  1. **Async Fire-and-Forget:** Dispatch WhatsApp notifications asynchronously (or via background queue) without awaiting inside the critical attendance transaction path.
  2. **Phone Number Sanitization:**
     Normalize Indonesian phone numbers:
     Strip non-digits, replace leading `0` or `+62` with standard format `628...`:
     ```typescript
     const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '62').replace(/^\+/, '');
     ```
  3. **Gateway Error Isolation:** Wrap WhatsApp API call in a `try/catch` block that logs errors to `hrm_audit_logs` without failing the attendance response.

---

## 4. Systematic Diagnostic & Bug Hunting Workflow

When inspecting or debugging an attendance face or GPS feature:
1. **Trace from Physical Sensor to Database:**
   Camera/GPS Hardware $\to$ Browser API Permissions $\to$ React Hook State $\to$ Canvas / Math Transform $\to$ Network Request Payload $\to$ Express Route & Middleware $\to$ PostgreSQL DDL / Constraints.
2. **Inspect Network Payloads:**
   Verify `latitude`, `longitude`, `biometric_score`, `assigned_post_id`, and base64 image dimensions in devtools.
3. **Check Defensive Callbacks:**
   Ensure modal callback props (`onSaved`, `onSuccess`, `onClose`) check `typeof fn === 'function'` before invoking to prevent production Vite minification crashes.
4. **Enforce Database Schema Integrity:**
   Ensure production PostgreSQL container (`hrm-database`) has all expected columns:
   `last_known_latitude`, `last_known_longitude`, `current_active_post_id`, `current_active_post_name`, `is_out_of_bounds`.
