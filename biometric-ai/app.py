import io
import base64
import os
import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import insightface
from insightface.app import FaceAnalysis

app = FastAPI(
    title="HRM Biometric AI Engine",
    description="Zero-cost, production-grade 1:1 facial biometric extraction & verification microservice powered by InsightFace.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize InsightFace with lightweight CPU-optimized execution provider
print("[BiometricAI] Initializing InsightFace buffalo_s model on CPU...")
face_app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider'])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("[BiometricAI] InsightFace engine ready and loaded.")


class VerifyBase64Request(BaseModel):
    image_base64: str
    master_embedding: List[float]
    threshold: Optional[float] = 0.70


class ExtractBase64Request(BaseModel):
    image_base64: str


def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    """Converts image raw bytes into an OpenCV BGR numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Gagal membaca format gambar. Pastikan format JPEG atau PNG valid.")
    return img


def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decodes data URI or raw base64 string into OpenCV BGR numpy array."""
    if ',' in base64_str:
        base64_str = base64_str.split(',', 1)[1]
    image_bytes = base64.b64decode(base64_str)
    return decode_image_bytes(image_bytes)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "HRM Biometric Face AI",
        "engine": "InsightFace MobileFaceNet / buffalo_s",
        "providers": ["CPUExecutionProvider"],
        "embedding_dim": 512
    }


@app.post("/extract-embedding")
async def extract_embedding(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None)
):
    """
    Extracts 512-dimension normalized face embedding vector from a master enrollment photo.
    """
    try:
        if file is not None:
            content = await file.read()
            img = decode_image_bytes(content)
        elif image_base64 is not None:
            img = decode_base64_image(image_base64)
        else:
            raise HTTPException(status_code=400, detail="File foto atau image_base64 wajib dilampirkan")

        faces = face_app.get(img)

        if len(faces) == 0:
            return {
                "success": False,
                "error": "Wajah tidak terdeteksi dalam foto. Pastikan wajah menghadap kamera dengan pencahayaan cukup."
            }

        if len(faces) > 1:
            return {
                "success": False,
                "error": f"Terdeteksi {len(faces)} wajah dalam foto master. Pastikan foto hanya memuat satu wajah karyawan."
            }

        face = faces[0]
        embedding = face.normed_embedding.tolist()

        return {
            "success": True,
            "face_count": 1,
            "embedding": embedding,
            "dimension": len(embedding),
            "det_score": round(float(face.det_score), 4),
            "bbox": [int(x) for x in face.bbox],
            "gender": "M" if getattr(face, 'gender', 1) == 1 else "F",
            "age": int(getattr(face, 'age', 25))
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/extract-embedding-json")
async def extract_embedding_json(body: ExtractBase64Request):
    """
    JSON version of extract-embedding for Node.js / mobile client integration.
    """
    try:
        img = decode_base64_image(body.image_base64)
        faces = face_app.get(img)

        if len(faces) == 0:
            return {
                "success": False,
                "error": "Wajah tidak terdeteksi dalam foto. Pastikan wajah menghadap kamera dengan pencahayaan cukup."
            }

        if len(faces) > 1:
            return {
                "success": False,
                "error": f"Terdeteksi {len(faces)} wajah dalam foto master. Pastikan foto hanya memuat satu wajah karyawan."
            }

        face = faces[0]
        embedding = face.normed_embedding.tolist()

        return {
            "success": True,
            "face_count": 1,
            "embedding": embedding,
            "dimension": len(embedding),
            "det_score": round(float(face.det_score), 4),
            "bbox": [int(x) for x in face.bbox]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def check_presentation_attack(img: np.ndarray, bbox: List[int]) -> tuple:
    """
    ISO/IEC 30107 Presentation Attack Detection (PAD).
    Detects if the face is presented via secondary smartphone, tablet, screen replay, or video call.
    """
    try:
        h, w = img.shape[:2]
        x1, y1, x2, y2 = [int(v) for v in bbox]
        face_w = x2 - x1
        face_h = y2 - y1

        # 1. Scale ratio guard: A real selfie face takes at least 30% of image width
        ratio = float(face_w) / w if w > 0 else 0
        if ratio < 0.30:
            return True, "Wajah terlalu kecil / jauh dari kamera (Kecurangan Layar HP Sekunder Ditolak)"

        # 2. Smartphone bezel & rectangular display border detection
        pad_x = int(face_w * 0.55)
        pad_y = int(face_h * 0.55)
        rx1 = max(0, x1 - pad_x)
        ry1 = max(0, y1 - pad_y)
        rx2 = min(w, x2 + pad_x)
        ry2 = min(h, y2 + pad_y)

        crop = img[ry1:ry2, rx1:rx2]
        if crop.size > 0:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 35, 110)

            # Detect straight parallel chassis lines of a secondary smartphone
            lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=35, minLineLength=int(face_h * 0.45), maxLineGap=20)
            if lines is not None:
                vertical_edges = 0
                for line in lines:
                    lx1, ly1, lx2, ly2 = line[0]
                    dx = abs(lx2 - lx1)
                    dy = abs(ly2 - ly1)
                    if dx <= dy * 0.22 and dy >= face_h * 0.4:
                        vertical_edges += 1
                if vertical_edges >= 2:
                    return True, "Terdeteksi tepi lurus fisik casing / bingkai layar HP sekunder (Replay Attack Ditolak)"

            contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > (face_w * face_h * 0.75):
                    peri = cv2.arcLength(cnt, True)
                    approx = cv2.approxPolyDP(cnt, 0.03 * peri, True)
                    if len(approx) == 4 and cv2.isContourConvex(approx):
                        bx, by, bw, bh = cv2.boundingRect(approx)
                        aspect = float(bh) / bw if bw > 0 else 0
                        if (1.25 <= aspect <= 2.6 or 0.38 <= aspect <= 0.8) and bw > face_w * 0.80:
                            return True, "Terdeteksi bingkai / bezel layar HP sekunder (Replay Attack Ditolak)"

        # 3. Specular glare & screen wash out
        face_crop = img[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
        if face_crop.size > 0:
            fgray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
            glare_count = np.sum(fgray >= 253)
            if glare_count / fgray.size > 0.07:
                return True, "Terdeteksi pantulan kaca layar HP / silau layar digital (Screen Glare Ditolak)"

        return False, ""
    except Exception:
        return False, ""


@app.post("/verify-face")
async def verify_face(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    master_embedding: str = Form(...)  # Comma-separated or JSON list string
):
    """
    Verifies a live check-in selfie snapshot against the stored 512-dimension master vector.
    """
    try:
        import json
        if isinstance(master_embedding, str):
            try:
                master_vec = json.loads(master_embedding)
            except Exception:
                master_vec = [float(x.strip()) for x in master_embedding.split(',') if x.strip()]
        else:
            master_vec = master_embedding

        master_arr = np.array(master_vec, dtype=np.float32)
        norm_val = np.linalg.norm(master_arr)
        if norm_val > 0:
            master_arr = master_arr / norm_val

        if file is not None:
            content = await file.read()
            img = decode_image_bytes(content)
        elif image_base64 is not None:
            img = decode_base64_image(image_base64)
        else:
            raise HTTPException(status_code=400, detail="Foto presensi selfie wajib dilampirkan")

        faces = face_app.get(img)

        if len(faces) == 0:
            return {
                "success": False,
                "is_match": False,
                "confidence": 0.0,
                "error": "Wajah tidak terdeteksi pada kamera absensi. Dekatkan wajah ke kamera dengan cahaya yang baik."
            }

        faces.sort(key=lambda x: x.det_score, reverse=True)
        live_face = faces[0]

        # Check Presentation Attack / Screen Replay Detection
        is_spoof, spoof_reason = check_presentation_attack(img, live_face.bbox)
        if is_spoof:
            return {
                "success": False,
                "is_match": False,
                "is_spoof": True,
                "confidence": 0.0,
                "error": f"Kecurangan Terdeteksi: {spoof_reason}. Presensi wajib menggunakan wajah asli secara langsung di depan kamera."
            }

        live_vec = live_face.normed_embedding

        similarity = float(np.dot(live_vec, master_arr))
        threshold = 0.70
        is_match = similarity >= threshold
        confidence_pct = round(max(0.0, min(100.0, similarity * 100.0)), 2)

        return {
            "success": True,
            "is_match": is_match,
            "similarity": round(similarity, 4),
            "confidence": confidence_pct,
            "threshold": threshold,
            "message": "Wajah terverifikasi cocok resmi" if is_match else "Wajah tidak cocok dengan template biometrik master karyawan",
            "det_score": round(float(live_face.det_score), 4)
        }
    except Exception as e:
        return {"success": False, "is_match": False, "confidence": 0.0, "error": str(e)}


@app.post("/verify-face-json")
async def verify_face_json(body: VerifyBase64Request):
    """
    JSON version of verify-face for REST API proxying.
    """
    try:
        master_arr = np.array(body.master_embedding, dtype=np.float32)
        norm_val = np.linalg.norm(master_arr)
        if norm_val > 0:
            master_arr = master_arr / norm_val

        img = decode_base64_image(body.image_base64)
        faces = face_app.get(img)

        if len(faces) == 0:
            return {
                "success": False,
                "is_match": False,
                "confidence": 0.0,
                "error": "Wajah tidak terdeteksi pada kamera absensi. Dekatkan wajah ke kamera dengan cahaya yang baik."
            }

        faces.sort(key=lambda x: x.det_score, reverse=True)
        live_face = faces[0]

        # Check Presentation Attack / Screen Replay Detection
        is_spoof, spoof_reason = check_presentation_attack(img, live_face.bbox)
        if is_spoof:
            return {
                "success": False,
                "is_match": False,
                "is_spoof": True,
                "confidence": 0.0,
                "error": f"Kecurangan Terdeteksi: {spoof_reason}. Presensi wajib menggunakan wajah asli secara langsung di depan kamera."
            }

        live_vec = live_face.normed_embedding

        similarity = float(np.dot(live_vec, master_arr))
        threshold = body.threshold or 0.70
        is_match = similarity >= threshold
        confidence_pct = round(max(0.0, min(100.0, similarity * 100.0)), 2)

        return {
            "success": True,
            "is_match": is_match,
            "similarity": round(similarity, 4),
            "confidence": confidence_pct,
            "threshold": threshold,
            "message": "Wajah terverifikasi cocok resmi" if is_match else "Wajah tidak cocok dengan template biometrik master karyawan",
            "det_score": round(float(live_face.det_score), 4)
        }
    except Exception as e:
        return {"success": False, "is_match": False, "confidence": 0.0, "error": str(e)}
