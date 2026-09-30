---
name: hr-document-ocr-vision
description: Standard and engineering guidelines for client-side document computer vision, Indonesian national identity card (KTP) heuristic parsing, NIK 16-digit validation, and instant employee onboarding auto-fill.
---

# HR Document Vision OCR Standards

This skill defines the image preprocessing and heuristic parsing pipelines for Indonesian national identity documents (e-KTP) in web environments.

## Pipeline Architecture

1. **Pre-processing (Canvas Hardware Accelerated)**:
   - Grayscale conversion: $Y = 0.299R + 0.587G + 0.114B$.
   - Contrast stretching & adaptive thresholding to isolate embossed text from batik background patterns.
2. **Field Extraction Heuristics**:
   - **NIK (16-Digit)**:
     - Regex: `/\b(\d{2})(\d{2})(\d{2})(\d{6})(\d{4})\b/`
     - Validates province (digits 1-2), regency/city (digits 3-4), subdistrict (digits 5-6), and birth date (digits 7-12, female days offset by +40).
   - **Nama Lengkap**: Extracted immediately after keyword `Nama` or `NAMA`.
   - **Tempat/Tgl Lahir**: Extracted after `Tempat/Tgl Lahir`, parsed to birth place and YYYY-MM-DD date.
   - **Jenis Kelamin**: Matches `LAKI-LAKI` $\rightarrow$ `L`, `PEREMPUAN` $\rightarrow$ `P`.
   - **Alamat, Agama, Status Perkawinan**: Cleans OCR artifacts and assigns to standard HRM fields.
