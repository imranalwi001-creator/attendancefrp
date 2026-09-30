FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and InsightFace on CPU
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download insightface buffalo_s model weights during docker build so runtime is instant
RUN python -c "import insightface; from insightface.app import FaceAnalysis; app = FaceAnalysis(name='buffalo_s', providers=['CPUExecutionProvider']); app.prepare(ctx_id=0, det_size=(640,640))"

COPY . .

EXPOSE 5001

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5001"]
