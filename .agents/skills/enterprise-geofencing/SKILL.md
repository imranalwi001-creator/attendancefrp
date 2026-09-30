---
name: enterprise-geofencing
description: Standard and engineering guidelines for enterprise-grade high-precision geofencing, GPS spoofing & mock location attack detection, Haversine spherical distance metrics, arbitrary polygon ray-casting containment, multi-branch office perimeter enforcement, and Leaflet/Mapbox interactive visual mapping.
---

# Enterprise Geofencing & Anti-Spoofing Location Engine

This skill governs high-precision geographic perimeter enforcement, mathematical geodesic distance calculations, anti-GPS spoofing defense, and interactive spatial mapping in workforce management, field service, and attendance systems.

---

## 1. Mathematical Geodesic Distance Standards

### A. Haversine Formula (Spherical Geodesic)
For standard spherical Earth approximations ($R = 6,371,000 \text{ m}$), compute the great-circle distance between coordinates $(\phi_1, \lambda_1)$ and $(\phi_2, \lambda_2)$:

$$\Delta \phi = \frac{(\phi_2 - \phi_1) \cdot \pi}{180}, \quad \Delta \lambda = \frac{(\lambda_2 - \lambda_1) \cdot \pi}{180}$$

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos\left(\frac{\phi_1 \cdot \pi}{180}\right) \cdot \cos\left(\frac{\phi_2 \cdot \pi}{180}\right) \cdot \sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right), \quad d = R \cdot c$$

- **Precision Rule**: Output distance in meters, rounded to 1 decimal place.
- **Computation Constraint**: Calculation time must be $< 1 \text{ ms}$ per evaluation.

### B. Arbitrary Polygon Geofence (Ray-Casting Algorithm)
For non-circular corporate complexes, construction yards, or multi-wing office parks:
- Implement the **Jordan Curve Theorem (Ray-Casting / Even-Odd rule)**:
- Cast an infinite horizontal ray from the test point $(x, y)$ along $+X$. Count intersections with each polygon segment $(x_i, y_i) \to (x_{i+1}, y_{i+1})$.
- If intersection count is odd, point is **INSIDE**; if even, point is **OUTSIDE**.

---

## 2. Anti-GPS Spoofing & Fraud Detection Guardrails

### A. Mock Provider Flag Detection
- Inspect `GeolocationCoordinates` and platform indicators:
  - Check `coords.isMock` (available in modern Android WebView / Chromium).
  - Verify timestamp monotonicity against `performance.now()`. Reject if timestamp is forged or in the past.

### B. Impossible Travel Velocity (Teleportation Radar)
- Track consecutive location pings for the same user:
  $$v = \frac{\text{distance}(P_1, P_2)}{\Delta t}$$
- If $v > 120 \text{ km/h}$ (urban commute) or $v > 900 \text{ km/h}$ (aviation), immediately flag as `LOCATION_TELEPORTATION_FRAUD`.

### C. Artificial Zero-Variance Heuristic (Fake GPS Static Jitter Check)
- Real hardware GPS sensors experience atmospheric multipath reflection resulting in micro-jitter ($\sigma \approx 0.5 - 2.5 \text{ m}$).
- If 3 consecutive high-accuracy pings have **0.000000° latitude and longitude variance** down to the 7th decimal place with zero speed, flag as `SUSPECTED_EMULATOR_INJECTION`.

### D. Hardware Accuracy Threshold Guard
- Enforce strict accuracy ceiling:
  - $\text{accuracy} \le 50 \text{ meters}$: Acceptable for mobile attendance.
  - $\text{accuracy} > 100 \text{ meters}$: Reject and prompt user to turn on GPS High Accuracy (Wi-Fi & Bluetooth scanning).
  - Check for missing `altitude` or unnatural altitude $= 0$ in elevated geographical regions.

---

## 3. Geofence Perimeter Calibration & UX Architecture

### A. Geofence Zones & Status Tiers
1. **Zone Green (Inside Perimeter)**:
   - $d \le R_{\text{allowed}}$: Permitted for immediate clock-in/out.
2. **Zone Amber (Perimeter Boundary Warning)**:
   - $R_{\text{allowed}} < d \le R_{\text{allowed}} + 15\text{m}$: Warn user: *"Anda berada di tepi batas area kantor (selisih X meter). Dekati pintu masuk utama."*
3. **Zone Red (Out of Bounds)**:
   - $d > R_{\text{allowed}} + 15\text{m}$: Deny clock-in/out. Display exact excess distance and branch office direction vector.

### B. Client-Side Geolocation API Standards
```typescript
const geolocationOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0, // Never use cached locations for attendance integrity
};
```

### C. Multi-Branch & Multi-Office Support
- Automatically resolve the closest active company branch/division for employees with roving or multi-site permissions:
  $$\text{Branch}_{\text{active}} = \arg\min_{b \in \text{Branches}} \text{distance}(\text{UserLoc}, \text{BranchLoc}_b)$$

---

## 4. Visual Mapping & Map UX Ergonomics

- **Interactive Maps**: Use Leaflet (`react-leaflet`) or Mapbox GL with anti-AI-slop design.
- **Visual Boundaries**:
  - Office Center: Crisp pin icon with branch title.
  - Perimeter Circle: Translucent primary fill (`rgba(13, 148, 136, 0.15)`) with dashed border.
  - User Marker: Glowing pulse ring showing GPS accuracy circle (`radius = accuracy`).
- **Ergonomics**:
  - Touch target size $\ge 48\text{px}$ for map action controls (Recenter, Zoom In/Out).
  - Auto-fit map viewport to bound both office perimeter and user location simultaneously (`fitBounds`).
