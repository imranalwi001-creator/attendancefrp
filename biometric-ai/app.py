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
        # Normalize master vector
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

        # Select highest-confidence face
        faces.sort(key=lambda x: x.det_score, reverse=True)
        live_face = faces[0]
        live_vec = live_face.normed_embedding

        # Cosine Similarity between two normalized unit vectors = dot product
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
