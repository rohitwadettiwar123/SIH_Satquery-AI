import sys
from pathlib import Path
from PIL import Image
import numpy as np

output_dir = Path("backend/data/uploads")
output_dir.mkdir(parents=True, exist_ok=True)

WIDTH, HEIGHT = 512, 512

rng = np.random.default_rng(42)
t0_r = rng.integers(80, 140, (HEIGHT, WIDTH), dtype=np.uint8)
t0_g = rng.integers(100, 160, (HEIGHT, WIDTH), dtype=np.uint8)
t0_b = rng.integers(50, 100, (HEIGHT, WIDTH), dtype=np.uint8)

t0_r[:, 200:220] = 30
t0_g[:, 200:220] = 60
t0_b[:, 200:220] = 130

t0_img = np.dstack((t0_r, t0_g, t0_b))
Image.fromarray(t0_img).save(output_dir / "demo_flood_t0.jpg")
Image.fromarray(t0_img).save(output_dir / "demo_flood_t0.tif")

t1_r = t0_r.copy()
t1_g = t0_g.copy()
t1_b = t0_b.copy()

flood_r0, flood_r1 = 100, 380
flood_c0, flood_c1 = 150, 400
t1_r[flood_r0:flood_r1, flood_c0:flood_c1] = rng.integers(20, 60, (flood_r1-flood_r0, flood_c1-flood_c0), dtype=np.uint8)
t1_g[flood_r0:flood_r1, flood_c0:flood_c1] = rng.integers(40, 90, (flood_r1-flood_r0, flood_c1-flood_c0), dtype=np.uint8)
t1_b[flood_r0:flood_r1, flood_c0:flood_c1] = rng.integers(140, 210, (flood_r1-flood_r0, flood_c1-flood_c0), dtype=np.uint8)

t1_img = np.dstack((t1_r, t1_g, t1_b))
Image.fromarray(t1_img).save(output_dir / "demo_flood_t1.jpg")
Image.fromarray(t1_img).save(output_dir / "demo_flood_t1.tif")

print("Created .jpg and .tif files in backend/data/uploads")
