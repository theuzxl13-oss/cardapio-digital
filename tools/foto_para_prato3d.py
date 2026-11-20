#!/usr/bin/env python3
"""
Cria um modelo 3D PROVISÓRIO de um prato servido em panela/prato redondo a partir de UMA foto.

Como funciona:
  1. A área da comida (uma elipse na foto, por causa da perspectiva) é "desentortada" para uma vista de cima.
  2. Essa imagem vira a textura da superfície da comida, com um relevo leve estimado pelas cores
     (partes claras, como camarões, ficam um pouco mais altas que o molho).
  3. A superfície é encaixada dentro de uma panela 3D em tamanho real.

Limitações (por isso o modelo continua marcado como provisório): a foto mostra só um lado,
então o volume é aproximado e as laterais da comida não existem. Para um 3D fiel use
fotogrametria (Polycam, RealityScan, Luma) e substitua o .glb.

Uso:
  python3 tools/foto_para_prato3d.py FOTO.jpg ID --cx 168 --topo 245 --base 482 --a 175 \
      [--raio 0.14] [--altura-relevo 0.009]
  --cx       centro horizontal da comida na foto (px)
  --topo     borda de trás da comida na foto (px, y)
  --base     borda da frente da comida na foto (px, y)
  --a        meia-largura da comida na foto (px)
"""
import argparse
import io
import math
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from generate_placeholder_models import GLB, Mesh, lathe, superellipsoid, tube  # noqa: E402

ROOT = os.path.join(os.path.dirname(__file__), "..")


def rectify(img, cx, top, bottom, a, size):
    """Converte a elipse da comida (vista inclinada) em um disco visto de cima."""
    src = np.asarray(img.convert("RGB"), dtype=np.float32)
    H, W = src.shape[:2]
    cy = (top + bottom) / 2
    b_top, b_bot = cy - top, bottom - cy  # o lado de trás aparece mais "curto" pela perspectiva
    v, u = np.mgrid[0:size, 0:size].astype(np.float32)
    u = u / (size - 1) * 2 - 1
    v = v / (size - 1) * 2 - 1
    x = cx + a * u
    y = cy + np.where(v < 0, b_top, b_bot) * v
    x = np.clip(x, 0, W - 1.001)   # fora da foto: estende a cor da borda (molho)
    y = np.clip(y, 0, H - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    out = (src[y0, x0] * (1 - fx) * (1 - fy) + src[y0, x0 + 1] * fx * (1 - fy)
           + src[y0 + 1, x0] * (1 - fx) * fy + src[y0 + 1, x0 + 1] * fx * fy)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def height_map(tex):
    """Relevo aproximado: partes claras e pouco saturadas (camarão, queijo) sobem; molho fica embaixo."""
    arr = np.asarray(tex, dtype=np.float32) / 255
    whiteness = arr.min(axis=2)  # baixo no laranja/verde, alto no camarão
    h = Image.fromarray((whiteness * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))
    h = np.asarray(h, dtype=np.float32) / 255
    lo, hi = np.percentile(h, 35), np.percentile(h, 97)
    return np.clip((h - lo) / max(hi - lo, 1e-3), 0, 1) ** 1.2


def food_surface(hmap, radius, y0, relief, rings=56, seg=128):
    pos, uv = [], []
    S = hmap.shape[0]
    for i in range(rings + 1):
        r = radius * i / rings
        for j in range(seg):
            t = 2 * math.pi * j / seg
            x, z = r * math.cos(t), r * math.sin(t)
            uu, vv = (x / radius + 1) / 2, (z / radius + 1) / 2
            hh = hmap[min(S - 1, int(vv * (S - 1))), min(S - 1, int(uu * (S - 1)))]
            edge = 1 - (r / radius) ** 8          # encosta suavemente na parede da panela
            pos.append((x, y0 + relief * hh * edge + 0.002 * edge, z))
            uv.append((uu, vv))
    idx = []
    for i in range(rings):
        for j in range(seg):
            j2 = (j + 1) % seg
            a, b = i * seg + j, i * seg + j2
            c, d = (i + 1) * seg + j, (i + 1) * seg + j2
            idx += [a, b, c, b, d, c]  # normais para cima
    return Mesh(pos, idx, uv)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("foto")
    ap.add_argument("id")
    ap.add_argument("--cx", type=float, required=True)
    ap.add_argument("--topo", type=float, required=True)
    ap.add_argument("--base", type=float, required=True)
    ap.add_argument("--a", type=float, required=True)
    ap.add_argument("--raio", type=float, default=0.14, help="raio interno da panela em metros")
    ap.add_argument("--altura-relevo", type=float, default=0.009)
    ap.add_argument("--textura", type=int, default=512)
    o = ap.parse_args()

    img = Image.open(o.foto)
    tex = rectify(img, o.cx, o.topo, o.base, o.a, o.textura)
    buf = io.BytesIO()
    tex.save(buf, "JPEG", quality=88)

    R, H = o.raio, 0.058
    food_y = 0.03
    g = GLB(o.id)
    g.extras = {"placeholder": True, "fonte": "foto unica",
                "note": "Modelo provisório criado a partir de uma foto. Volume aproximado; substituir por fotogrametria."}
    # Panela de inox (paredes, fundo e borda) — escala real
    g.add(g.mat("inox", "#D4D6D8", 0.28, 0.9),
          lathe([(0, 0), (R * 0.92, 0), (R + 0.004, 0.012), (R + 0.006, H), (R + 0.009, H + 0.002),
                 (R + 0.003, H + 0.003), (R, H - 0.002), (R - 0.002, 0.014), (R * 0.9, 0.006), (0, 0.006)], seg=96))
    # Alças pretas laterais (como na foto)
    k = g.mat("alca", "#1C1C1E", 0.5)
    for side in (-1, 1):
        pts = [(side * (R + 0.004), H - 0.006, -0.03), (side * (R + 0.04), H - 0.004, -0.025),
               (side * (R + 0.045), H - 0.004, 0.025), (side * (R + 0.004), H - 0.006, 0.03)]
        g.add(k, tube(pts, 0.006, seg=10))
    # Superfície da comida com a foto
    g.mat_texture("comida", buf.getvalue(), rough=0.45)
    g.add("comida", food_surface(height_map(tex), R - 0.002, food_y, o.altura_relevo))

    out = os.path.join(ROOT, "assets", "models", f"{o.id}.glb")
    size = g.write(out)
    tex.save(os.path.join(ROOT, "tools", f"_{o.id}-textura.jpg"), "JPEG", quality=85) if os.environ.get("DEBUG") else None
    print(f"{out}  {size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
