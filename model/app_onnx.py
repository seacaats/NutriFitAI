"""NutriFit food detection with onnxruntime + best.onnx (no server, no PyTorch).

Usage:  python app_onnx.py            (opens a file picker, then shows the result)
        python app_onnx.py photo.jpg  (skip the picker)
        add --save to also write photo_out.jpg with the boxes drawn
"""
import ast, json, os, re, sys
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(HERE, "yolov8n_new_nutrifit_167", "weights", "best.onnx")
NUTRITION_PATH = os.path.join(HERE, "nutrition_data.json")
CONF, IOU = 0.25, 0.7

def norm(name):
    return re.sub(r"[\s_-]+", " ", name.strip().lower())

opts = ort.SessionOptions()
opts.intra_op_num_threads = os.cpu_count() or 4   # use every core
opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
session = ort.InferenceSession(MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"])
print(f"Loaded {MODEL_PATH} (ONNX Runtime, no PyTorch)")
INPUT = session.get_inputs()[0]
SIZE = INPUT.shape[2] if isinstance(INPUT.shape[2], int) else 640
NAMES = ast.literal_eval(session.get_modelmeta().custom_metadata_map["names"])
with open(NUTRITION_PATH, encoding="utf-8") as f:
    NUTRITION = {norm(r["name"]): r for r in json.load(f)}

def letterbox(img):
    w, h = img.size
    gain = min(SIZE / w, SIZE / h)
    nw, nh = round(w * gain), round(h * gain)
    canvas = Image.new("RGB", (SIZE, SIZE), (114, 114, 114))
    px, py = (SIZE - nw) // 2, (SIZE - nh) // 2
    canvas.paste(img.resize((nw, nh), Image.BILINEAR), (px, py))
    x = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
    return x, gain, px, py

def nms(boxes, scores, iou):
    order = scores.argsort()[::-1]
    keep = []
    area = lambda b: (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    while order.size:
        i = order[0]; keep.append(i)
        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0])
        yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2])
        yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])
        inter = np.clip(xx2 - xx1, 0, None) * np.clip(yy2 - yy1, 0, None)
        union = area(boxes[[i]]) + area(boxes[order[1:]]) - inter
        order = order[1:][inter / union <= iou]
    return keep

def predict(img):
    x, gain, px, py = letterbox(img)
    out = session.run(None, {INPUT.name: x})[0][0].T
    scores = out[:, 4:]
    cls = scores.argmax(1)
    conf = scores[np.arange(len(cls)), cls]
    mask = conf >= CONF
    if not mask.any():
        return []
    cx, cy, bw, bh = out[mask, :4].T
    boxes = np.stack([cx - bw/2, cy - bh/2, cx + bw/2, cy + bh/2], 1)
    cls, conf = cls[mask], conf[mask]
    found = []
    for c in np.unique(cls):
        idx = np.where(cls == c)[0]
        found += [idx[k] for k in nms(boxes[idx], conf[idx], IOU)]
    found.sort(key=lambda i: -conf[i])
    w, h = img.size
    res = []
    for i in found:
        x1, y1, x2, y2 = (float(v) for v in boxes[i])
        box = [min(max((x1-px)/gain, 0), w), min(max((y1-py)/gain, 0), h),
               min(max((x2-px)/gain, 0), w), min(max((y2-py)/gain, 0), h)]
        res.append((int(cls[i]), float(conf[i]), box))
    return res

def detect(path, save=False):
    lines = []
    def out(t):
        print(t); lines.append(t)
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    totals = dict(kcal=0.0, protein=0.0, carbs=0.0, fat=0.0)
    draw_img = img.copy(); d = ImageDraw.Draw(draw_img)
    out(f"== {os.path.basename(path)}")
    dets = predict(img)
    if not dets:
        out("  nothing detected")
    for cls, conf, box in dets:
        name = NAMES[cls]
        n = NUTRITION.get(norm(name))
        label = (n or {}).get("display_name") or norm(name).title()
        if n:
            out(f"  {label}  {conf:.0%}  |  {n['serving']}  |  "
                f"{n['calories_kcal']} kcal  P{n['protein_g']}g C{n['carbs_g']}g F{n['fats_g']}g")
            totals["kcal"] += n["calories_kcal"]; totals["protein"] += n["protein_g"]
            totals["carbs"] += n["carbs_g"]; totals["fat"] += n["fats_g"]
        else:
            out(f"  {label}  {conf:.0%}  (no nutrition entry)")
        d.rectangle(box, outline="red", width=3); d.text((box[0]+4, box[1]+4), f"{label} {conf:.0%}", fill="red")
    out(f"  TOTAL: {totals['kcal']:.0f} kcal  P{totals['protein']:.1f}g  C{totals['carbs']:.1f}g  F{totals['fat']:.1f}g")
    if save:
        out_path = os.path.splitext(path)[0] + "_out.jpg"
        draw_img.save(out_path); print("  saved", out_path)
    return draw_img, "\n".join(lines)

def pick_files():
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk(); root.withdraw(); root.attributes("-topmost", True)
    paths = filedialog.askopenfilenames(
        title="Select food photo(s)",
        filetypes=[("Images", "*.jpg *.jpeg *.png *.webp *.bmp"), ("All files", "*.*")])
    root.destroy()
    return list(paths)

def show_result(img, text, title):
    import tkinter as tk
    from PIL import ImageTk
    win = tk.Tk(); win.title(title)
    view = img.copy(); view.thumbnail((700, 600))
    photo = ImageTk.PhotoImage(view)
    tk.Label(win, image=photo).pack()
    tk.Label(win, text=text, justify="left", font=("Consolas", 10), anchor="w").pack(padx=10, pady=8, fill="x")
    win.mainloop()

if __name__ == "__main__":
    save = "--save" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--save"]
    gui = not args
    paths = args or pick_files()
    if not paths:
        sys.exit("No photo selected.")
    for p in paths:
        img, text = detect(p, save=save)
        if gui:
            show_result(img, text, os.path.basename(p))