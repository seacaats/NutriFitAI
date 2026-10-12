# NutriFitAI food detection

YOLOv8n food detector (exported to ONNX) behind FastAPI. Called only by the
NutriFitAI backend.

- `GET /health`: class and food counts, plus model classes with no nutrition entry (`unmatched`)
- `POST /detect`: multipart `image`, header `x-api-key`. Returns the detected foods with nutrition per serving, and the totals

Run locally: `pip install -r requirements.txt`, then `python -m uvicorn main:app --port 8000`

Settings (environment variables):
- `AI_API_KEY`: shared with the backend's `AI_DETECT_API_KEY`
- `ENV=production`: refuses to start without `AI_API_KEY`
- `CONF_THRESHOLD` (optional): detection confidence, default 0.40

After retraining, re-export the model:
`yolo export model=yolov8n_new_nutrifit_167/weights/best.pt format=onnx imgsz=640`
