# POST /detect (multipart 'image') -> items + totals
# Called only by the Express backend (AI_DETECT_URL), never by the app
#
# PyTorch version: runs best.pt through ultralytics, so resizing, box decoding
# and duplicate removal are ultralytics' own. Same request limits and JSON
# output as main_onnx.py. Needs far more memory than the ONNX server (plan on
# 2 GB or more), so it is meant for a local machine or a bigger instance.
# Run:  python -m uvicorn main_pt:app --port 8000
import io, json, os, re, threading
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from PIL import Image, ImageOps
from ultralytics import YOLO

MODEL_PATH = os.getenv("MODEL_PATH", "yolov8n_new_nutrifit_167/weights/best.pt")
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


# Weight of one serving in grams: the table's portion_g (stated in the label,
# or an estimate when portion_estimated is true). Nutrition is scaled from it
# to per 100 g, so every food shares one unit
def portion_grams(n):
    return n and n.get("portion_g")


# One serving's value -> per 100 g
def per100(value, grams):
    return round(value / grams * 100, 1)


# What users see: the table's display_name ("Adobong Manok (Chicken Adobo)").
# Classes the table lacks fall back to a readable form of the class name
def display_name(name, n):
    return (n and n.get("display_name")) or norm(name).title()


model = YOLO(MODEL_PATH)
print(f"Loaded {MODEL_PATH} ({'ONNX Runtime' if MODEL_PATH.lower().endswith('.onnx') else 'PyTorch'} via ultralytics)", flush=True)
NAMES = model.names  # {0: 'apple', 1: 'banana', ...}
_lock = threading.Lock()  # one inference at a time on the shared model

app = FastAPI(title="NutriFit AI (PyTorch)")
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
        # Decoded at most ~1280 px across, same as main_onnx.py, so the boxes
        # mean the same thing in both servers
        img.draft("RGB", (1280, 1280))
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((1280, 1280))
    except Exception:
        raise HTTPException(400, "invalid image")

    with _lock:
        r = model.predict(img, conf=CONF, iou=IOU, verbose=False)[0]
    confs = r.boxes.conf.tolist()
    clss = r.boxes.cls.tolist()
    boxes = r.boxes.xyxy.tolist()  # pixels of the image passed in
    order = sorted(range(len(confs)), key=lambda i: -confs[i])

    items, totals = [], {"caloriesKcal": 0.0, "proteinG": 0.0, "carbsG": 0.0, "fatG": 0.0}
    for i in order:
        name = NAMES[int(clss[i])]
        n = NUTRITION.get(norm(name))
        # The flat values are per ONE serving of the table's household measure.
        # per100g is what the app scales by the grams the user sets
        grams = portion_grams(n)
        item = {
            "foodName": display_name(name, n),
            "confidence": round(float(confs[i]), 3),
            "serving": n and n.get("serving"),
            "defaultGrams": grams,
            "per100g": n and grams and {
                "caloriesKcal": per100(n["calories_kcal"], grams),
                "proteinG": per100(n["protein_g"], grams),
                "carbsG": per100(n["carbs_g"], grams),
                "fatG": per100(n["fats_g"], grams),
            },
            "caloriesKcal": n and n["calories_kcal"],
            "proteinG": n and n["protein_g"],
            "carbsG": n and n["carbs_g"],
            "fatG": n and n["fats_g"],
            "box": [round(v, 1) for v in boxes[i]],
        }
        items.append(item)
        if n:
            for k in totals:
                totals[k] += item[k]
    # Boxes are in the pixel space of width x height (the processed photo)
    return {"width": img.width, "height": img.height, "items": items,
            "totals": {k: round(v, 1) for k, v in totals.items()},
            "missing": sorted({i["foodName"] for i in items if i["caloriesKcal"] is None})}