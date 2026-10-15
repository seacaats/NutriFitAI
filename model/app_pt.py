"""NutriFit food detection with ultralytics + best.pt (no server).

Usage:  python app_pt.py            (opens a file picker, then shows the result)
        python app_pt.py photo.jpg  (skip the picker)
        add --save to also write photo_out.jpg with the boxes drawn

Needs:  pip install ultralytics
"""
import json, os, re, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.getenv(
    "MODEL_PATH", os.path.join(HERE, "yolov8n_new_nutrifit_167", "weights", "best.pt"))
NUTRITION_PATH = os.path.join(HERE, "nutrition_data.json")
CONF, IOU = 0.25, 0.7

if not os.path.exists(MODEL_PATH):
    sys.exit(f"Model not found at: {MODEL_PATH}")

from ultralytics import YOLO

model = YOLO(MODEL_PATH)
print(f"Loaded {MODEL_PATH} ({'ONNX Runtime' if MODEL_PATH.lower().endswith('.onnx') else 'PyTorch'} via ultralytics)")


def norm(name):
    return re.sub(r"[\s_-]+", " ", name.strip().lower())


with open(NUTRITION_PATH, encoding="utf-8") as f:
    NUTRITION = {norm(r["name"]): r for r in json.load(f)}


def detect(path, save=False):
    lines = []

    def out(t):
        print(t)
        lines.append(t)

    r = model.predict(path, conf=CONF, iou=IOU, verbose=False)[0]
    confs = r.boxes.conf.tolist()
    clss = r.boxes.cls.tolist()
    order = sorted(range(len(confs)), key=lambda i: -confs[i])

    totals = dict(kcal=0.0, protein=0.0, carbs=0.0, fat=0.0)
    out(f"== {os.path.basename(path)}")
    if not order:
        out("  nothing detected")
    for i in order:
        name, conf = model.names[int(clss[i])], confs[i]
        n = NUTRITION.get(norm(name))
        label = (n or {}).get("display_name") or norm(name).title()
        if n:
            out(f"  {label}  {conf:.0%}  |  {n['serving']}  |  "
                f"{n['calories_kcal']} kcal  P{n['protein_g']}g C{n['carbs_g']}g F{n['fats_g']}g")
            totals["kcal"] += n["calories_kcal"]
            totals["protein"] += n["protein_g"]
            totals["carbs"] += n["carbs_g"]
            totals["fat"] += n["fats_g"]
        else:
            out(f"  {label}  {conf:.0%}  (no nutrition entry)")
    out(f"  TOTAL: {totals['kcal']:.0f} kcal  P{totals['protein']:.1f}g  "
        f"C{totals['carbs']:.1f}g  F{totals['fat']:.1f}g")

    # r.plot() gives a BGR array with the boxes drawn, flip it to RGB for PIL
    annotated = Image.fromarray(r.plot()[..., ::-1])
    if save:
        out_path = os.path.splitext(path)[0] + "_out.jpg"
        annotated.save(out_path)
        print("  saved", out_path)
    return annotated, "\n".join(lines)


def pick_files():
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    paths = filedialog.askopenfilenames(
        title="Select food photo(s)",
        filetypes=[("Images", "*.jpg *.jpeg *.png *.webp *.bmp"), ("All files", "*.*")])
    root.destroy()
    return list(paths)


def show_result(img, text, title):
    import tkinter as tk
    from PIL import ImageTk
    win = tk.Tk()
    win.title(title)
    view = img.copy()
    view.thumbnail((700, 600))
    photo = ImageTk.PhotoImage(view)
    tk.Label(win, image=photo).pack()
    tk.Label(win, text=text, justify="left", font=("Consolas", 10),
             anchor="w").pack(padx=10, pady=8, fill="x")
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