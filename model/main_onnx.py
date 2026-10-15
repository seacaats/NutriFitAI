# POST /detect (multipart 'image') -> items + totals
# Called only by the Express backend (AI_DETECT_URL), never by the app
#
# Runs the YOLOv8 model exported to ONNX (best.onnx) with onnxruntime instead
# of ultralytics, so the server doesn't load PyTorch and fits in ~300 MB. The
# resizing, box decoding and duplicate removal ultralytics did are below
import ast, io, json, os, re
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image, ImageOps

MODEL_PATH = os.getenv("MODEL_PATH", "yolov8n_new_nutrifit_167/weights/best.onnx")
NUTRITION_PATH = os.getenv("NUTRITION_PATH", "nutrition_data.json")
CONF = float(os.getenv("CONF_THRESHOLD", "0.25"))
IOU = 0.7  # ultralytics' default for removing overlapping boxes of one class
API_KEY = os.getenv("AI_API_KEY")  # shared secret with Express (AI_DETECT_API_KEY)
MAX_BYTES = 8 * 1024 * 1024

# An open endpoint is fine on a dev machine, never on a deployed one
if os.getenv("ENV", "development") == "production" and not API_KEY:
    raise RuntimeError("AI_API_KEY must be set in production")


# Model classes and the nutrition table don't always spell names the same
# ("fried rice" vs "fried_rice"), so both sides are matched on one form
def norm(name):
    return re.sub(r"[\s_-]+", " ", name.strip().lower())


# Grams only when the serving label states them: "1 slice (100g)", "100g".
# "1 cup" has no weight, so it stays None rather than a guess
def serving_grams(serving):
    m = re.search(r"(\d+(?:\.\d+)?)\s*g\b", serving or "")
    return float(m.group(1)) if m else None


# What users see: the table's display_name ("Adobong Manok (Chicken Adobo)").
# Classes the table lacks fall back to a readable form of the class name
def display_name(name, n):
    return (n and n.get("display_name")) or norm(name).title()


# ---- Model -----------------------------------------------------------------

# Sized for a 512 MB instance: one thread, and no memory arena (the arena
# keeps its peak allocation reserved for good, which pushed scans over 512 MB)
_options = ort.SessionOptions()
_options.intra_op_num_threads = 1
_options.inter_op_num_threads = 1
_options.enable_cpu_mem_arena = False
session = ort.InferenceSession(MODEL_PATH, sess_options=_options, providers=["CPUExecutionProvider"])
print(f"Loaded {MODEL_PATH} (ONNX Runtime, no PyTorch)", flush=True)
INPUT = session.get_inputs()[0]
SIZE = INPUT.shape[2] if isinstance(INPUT.shape[2], int) else 640
# The export stores the class names in the file: "{0: 'apple', 1: 'banana'}"
NAMES = ast.literal_eval(session.get_modelmeta().custom_metadata_map["names"])


# Fits the photo into a SIZE x SIZE square without stretching it, padding the
# rest with gray, the way the model was trained. Returns what's needed to map
# boxes back onto the original photo
def letterbox(img):
    w, h = img.size
    gain = min(SIZE / w, SIZE / h)
    nw, nh = round(w * gain), round(h * gain)
    canvas = Image.new("RGB", (SIZE, SIZE), (114, 114, 114))
    pad_x, pad_y = (SIZE - nw) // 2, (SIZE - nh) // 2
    canvas.paste(img.resize((nw, nh), Image.BILINEAR), (pad_x, pad_y))
    x = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    return x, gain, pad_x, pad_y


# Of boxes that overlap a lot, keeps the most confident (one class at a time)
def nms(boxes, scores, iou):
    order = scores.argsort()[::-1]
    keep = []
    while order.size:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0])
        yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2])
        yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        area = lambda b: (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
        union = area(boxes[[i]]) + area(boxes[order[1:]]) - inter
        order = order[1:][inter / union <= iou]
    return keep


# [(class index, confidence, [x1, y1, x2, y2] on the original photo)], most
# confident first
def predict(img):
    x, gain, pad_x, pad_y = letterbox(img)
    out = session.run(None, {INPUT.name: x})[0][0].T  # (anchors, 4 + classes)
    cls_scores = out[:, 4:]
    cls = cls_scores.argmax(1)
    conf = cls_scores[np.arange(len(cls)), cls]
    mask = conf >= CONF
    if not mask.any():
        return []
    cx, cy, bw, bh = out[mask, :4].T
    boxes = np.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], 1)
    cls, conf = cls[mask], conf[mask]

    found = []
    for c in np.unique(cls):
        idx = np.where(cls == c)[0]
        for k in nms(boxes[idx], conf[idx], IOU):
            found.append(idx[k])
    found.sort(key=lambda i: -conf[i])

    w, h = img.size
    results = []
    for i in found[:300]:
        # Plain floats: numpy numbers aren't JSON, and FastAPI refuses them
        x1, y1, x2, y2 = (float(v) for v in boxes[i])
        box = [
            min(max((x1 - pad_x) / gain, 0), w), min(max((y1 - pad_y) / gain, 0), h),
            min(max((x2 - pad_x) / gain, 0), w), min(max((y2 - pad_y) / gain, 0), h),
        ]
        results.append((int(cls[i]), float(conf[i]), box))
    return results


# ---- API -------------------------------------------------------------------

app = FastAPI(title="NutriFit AI")
with open(NUTRITION_PATH, encoding="utf-8") as f:
    NUTRITION = {norm(r["name"]): r for r in json.load(f)}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    unmatched = sorted(n for n in NAMES.values() if norm(n) not in NUTRITION)
    return {"ok": True, "classes": len(NAMES), "foods": len(NUTRITION), "unmatched": unmatched}


# Plain def, not async: inference is blocking, and FastAPI runs sync
# endpoints in a threadpool so one inference doesn't stall other requests
@app.post("/detect")
def detect(image: UploadFile = File(...), x_api_key: str | None = Header(None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(401, "bad api key")
    data = image.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "image too large")
    try:
        # Phone and webcam photos carry their rotation in EXIF. Without this
        # the model sees a portrait photo sideways
        img = Image.open(io.BytesIO(data))
        # Decoded at most ~1280 px across: the model only sees 640 px anyway,
        # and a full-size phone photo decodes to ~50 MB. draft() lets JPEGs
        # decode straight at a smaller scale
        img.draft("RGB", (1280, 1280))
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((1280, 1280))
    except Exception:
        raise HTTPException(400, "invalid image")

    items, totals = [], {"caloriesKcal": 0.0, "proteinG": 0.0, "carbsG": 0.0, "fatG": 0.0}
    for cls, conf, box in predict(img):
        name = NAMES[cls]
        n = NUTRITION.get(norm(name))
        # Nutrition is per ONE serving of the table's household measure
        item = {
            "foodName": display_name(name, n),
            "confidence": round(conf, 3),
            "serving": n and n.get("serving"),
            "servingGrams": n and serving_grams(n.get("serving")),
            "caloriesKcal": n and n["calories_kcal"],
            "proteinG": n and n["protein_g"],
            "carbsG": n and n["carbs_g"],
            "fatG": n and n["fats_g"],
            "box": [round(v, 1) for v in box],
        }
        items.append(item)
        if n:
            for k in totals:
                totals[k] += item[k]
    # Boxes are in the pixel space of width x height (the processed photo)
    return {"width": img.width, "height": img.height, "items": items, "totals": {k: round(v, 1) for k, v in totals.items()},
            "missing": sorted({i["foodName"] for i in items if i["caloriesKcal"] is None})}