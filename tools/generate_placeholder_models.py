#!/usr/bin/env python3
"""
Gera os modelos 3D PLACEHOLDER (.glb) de cada prato do cardápio Athina.

IMPORTANTE: estes modelos são representações estilizadas e ILUSTRATIVAS,
montadas proceduralmente com formas geométricas simples (prato, proteínas,
guarnições, molhos, copos). Cada prato tem a sua própria composição, mas
NENHUM deles é um escaneamento fiel do prato real. Devem ser substituídos
por modelos fotogramétricos reais (mesmo nome de arquivo em assets/models/).

Escala: metros reais (um prato raso tem ~27 cm de diâmetro), eixo Y para cima,
para que a Realidade Aumentada posicione o prato em tamanho natural na mesa.

Uso:
    python3 tools/generate_placeholder_models.py
Requer apenas Python 3 + numpy.
"""
import json
import math
import os
import struct

import numpy as np

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "models")


# ----------------------------------------------------------------------------
# Utilidades geométricas
# ----------------------------------------------------------------------------
def hex_rgb(h, a=1.0):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    # glTF baseColorFactor é linear
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return lin + [a]


def rot_matrix(rx=0.0, ry=0.0, rz=0.0):
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    Rx = np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]])
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    Rz = np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]])
    return Rz @ Ry @ Rx


class Mesh:
    def __init__(self, pos, idx, uv=None):
        self.pos = np.asarray(pos, dtype=np.float64)
        self.idx = np.asarray(idx, dtype=np.uint32).reshape(-1, 3)
        self.uv = None if uv is None else np.asarray(uv, dtype=np.float64)  # coordenadas de textura (opcional)

    def transform(self, t=(0, 0, 0), r=(0, 0, 0), s=(1, 1, 1)):
        R = rot_matrix(*r)
        self.pos = (self.pos * np.array(s)) @ R.T + np.array(t)
        return self

    def jitter(self, amount, rng):
        if amount:
            n = vertex_normals(self.pos, self.idx)
            self.pos = self.pos + n * rng.uniform(-amount, amount, (len(self.pos), 1))
        return self


def vertex_normals(pos, idx):
    n = np.zeros_like(pos)
    a, b, c = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(n, idx[:, k], fn)
    ln = np.linalg.norm(n, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return n / ln


def grid_indices(rows, cols, wrap_cols=True):
    """Índices para uma grade rows x cols (cols com wrap opcional)."""
    idx = []
    cmax = cols if wrap_cols else cols - 1
    for i in range(rows - 1):
        for j in range(cmax):
            j2 = (j + 1) % cols
            a, b = i * cols + j, i * cols + j2
            c, d = (i + 1) * cols + j, (i + 1) * cols + j2
            idx += [a, c, b, b, c, d]
    return idx


def lathe(profile, seg=64):
    """Superfície de revolução. profile = [(raio, y), ...] de baixo/centro para cima/centro."""
    pos = []
    for r, y in profile:
        for j in range(seg):
            t = 2 * math.pi * j / seg
            pos.append((r * math.cos(t), y, r * math.sin(t)))
    return Mesh(pos, grid_indices(len(profile), seg))


def superellipsoid(rx, ry, rz, e1=1.0, e2=1.0, seg=None, rings=None):
    """Superquádrica: e1/e2 < 1 -> formas mais 'quadradas' (carnes, bolos, peixes)."""
    def f(w, m):
        return math.copysign(abs(w) ** m, w)
    # resolução proporcional ao tamanho: peças pequenas usam menos polígonos
    if seg is None:
        size = max(rx, ry, rz)
        seg = 10 if size < 0.008 else 14 if size < 0.02 else 24 if size < 0.05 else 36
    if rings is None:
        rings = max(6, seg // 2)
    pos = []
    for i in range(rings + 1):
        v = -math.pi / 2 + math.pi * i / rings
        for j in range(seg):
            u = -math.pi + 2 * math.pi * j / seg
            x = rx * f(math.cos(v), e1) * f(math.cos(u), e2)
            y = ry * f(math.sin(v), e1)
            z = rz * f(math.cos(v), e1) * f(math.sin(u), e2)
            pos.append((x, y, z))
    return Mesh(pos, grid_indices(rings + 1, seg))


def sphere(r, seg=None, rings=None):
    return superellipsoid(r, r, r, 1, 1, seg, rings)


def tube(points, radius, seg=8):
    """Tubo ao longo de uma polilinha (massas, aspargos, ervas)."""
    pts = np.asarray(points, dtype=np.float64)
    n = len(pts)
    pos = []
    prev_normal = None
    for i in range(n):
        tng = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        tng /= (np.linalg.norm(tng) or 1)
        if prev_normal is None:
            ref = np.array([0, 1, 0]) if abs(tng[1]) < 0.9 else np.array([1, 0, 0])
            nor = np.cross(tng, ref)
        else:
            nor = prev_normal - tng * np.dot(prev_normal, tng)
        nor /= (np.linalg.norm(nor) or 1)
        prev_normal = nor
        bin_ = np.cross(tng, nor)
        rr = radius(i / (n - 1)) if callable(radius) else radius
        for j in range(seg):
            t = 2 * math.pi * j / seg
            pos.append(pts[i] + rr * (math.cos(t) * nor + math.sin(t) * bin_))
    idx = grid_indices(n, seg)
    # tampas
    c0 = len(pos); pos.append(pts[0])
    c1 = len(pos); pos.append(pts[-1])
    for j in range(seg):
        j2 = (j + 1) % seg
        idx += [c0, j2, j]
        base = (n - 1) * seg
        idx += [c1, base + j, base + j2]
    return Mesh(pos, idx)


def wedge(radius, height, angle, seg=24):
    """Fatia (bolo, torta): setor cilíndrico fechado."""
    pos, idx = [], []
    for y in (0.0, height):
        pos.append((0, y, 0))
        for j in range(seg + 1):
            t = -angle / 2 + angle * j / seg
            pos.append((radius * math.cos(t), y, radius * math.sin(t)))
    m = seg + 2
    for j in range(1, seg + 1):
        idx += [0, j, j + 1]               # base
        idx += [m, m + j + 1, m + j]       # topo
        idx += [j, m + j, j + 1, j + 1, m + j, m + j + 1]  # lateral curva
    # laterais retas
    idx += [0, m, 1, 1, m, m + 1]
    idx += [0, seg + 1, m, seg + 1, m + seg + 1, m]
    return Mesh(pos, idx)


# ----------------------------------------------------------------------------
# Peças de louça / base
# ----------------------------------------------------------------------------
def plate(r=0.135, rim=0.22):
    inner = r * (1 - rim)
    return lathe([(0, 0.0), (r * 0.55, 0.0), (r * 0.6, 0.005), (inner, 0.009), (r, 0.022),
                  (r * 0.995, 0.026), (inner * 0.98, 0.014), (0, 0.013)], seg=72)


def bowl(r=0.11, h=0.06):
    return lathe([(0, 0), (r * 0.45, 0), (r * 0.5, 0.006), (r * 0.85, h * 0.45), (r, h),
                  (r * 0.96, h * 1.02), (r * 0.8, h * 0.5), (r * 0.42, h * 0.16), (0, h * 0.15)], seg=72)


def pasta_plate(r=0.14):
    """Prato fundo de aba larga (massas e risotos)."""
    return lathe([(0, 0), (r * 0.35, 0), (r * 0.38, 0.006), (r * 0.42, 0.038), (r * 0.55, 0.042),
                  (r, 0.05), (r * 0.99, 0.054), (r * 0.52, 0.046), (r * 0.4, 0.044), (r * 0.36, 0.014),
                  (0, 0.013)], seg=72)


def pan(r=0.13, h=0.045):
    body = lathe([(0, 0), (r * 0.9, 0), (r, h), (r * 0.94, h), (r * 0.86, 0.008), (0, 0.008)], seg=64)
    handle = superellipsoid(0.11, 0.009, 0.016, 0.4, 0.4).transform(t=(r + 0.1, h * 0.85, 0))
    return body, handle


def board(w=0.42, d=0.24, h=0.022):
    return superellipsoid(w / 2, h / 2, d / 2, 0.15, 0.25, seg=48, rings=16).transform(t=(0, h / 2, 0))


def glass(r_top=0.045, r_bot=0.038, h=0.13, wall=0.003):
    return lathe([(0, 0), (r_bot, 0), (r_top, h), (r_top - wall, h), (r_bot - wall, 0.008), (0, 0.008)], seg=48)


def liquid(r_top, r_bot, h, base=0.008):
    return lathe([(0, base), (r_bot, base), (r_top, h), (0, h)], seg=48)


def wine_glass():
    g = lathe([(0, 0), (0.038, 0), (0.038, 0.003), (0.006, 0.005), (0.004, 0.012), (0.004, 0.085),
               (0.02, 0.095), (0.042, 0.13), (0.044, 0.17), (0.043, 0.205), (0.041, 0.205),
               (0.042, 0.17), (0.04, 0.132), (0.019, 0.099), (0.0, 0.094)], seg=56)
    wine = lathe([(0, 0.096), (0.019, 0.1), (0.038, 0.13), (0.0405, 0.15), (0, 0.15)], seg=56)
    return g, wine


def leaf(rng, size=0.03):
    return superellipsoid(size, 0.0025, size * 0.5, 1.0, 0.9, seg=12, rings=6)


# ----------------------------------------------------------------------------
# Escritor GLB (glTF 2.0 binário)
# ----------------------------------------------------------------------------
class GLB:
    def __init__(self, name):
        self.name = name
        self.parts = {}   # material -> list[Mesh]
        self.materials = {}
        self.textures = {}  # material -> (bytes, mimeType)
        self.extras = {"placeholder": True,
                       "note": "Modelo ilustrativo gerado proceduralmente. Substituir pelo modelo real."}

    def mat(self, key, color, rough=0.7, metal=0.0, alpha=None):
        m = {"name": key, "pbrMetallicRoughness": {
            "baseColorFactor": hex_rgb(color, alpha if alpha is not None else 1.0),
            "metallicFactor": metal, "roughnessFactor": rough}}
        if alpha is not None and alpha < 1:
            m["alphaMode"] = "BLEND"
            m["doubleSided"] = True
        self.materials[key] = m
        self.parts.setdefault(key, [])
        return key

    def mat_texture(self, key, image_bytes, mime="image/jpeg", rough=0.55, metal=0.0):
        """Material com foto aplicada (baseColorTexture)."""
        self.mat(key, "#FFFFFF", rough, metal)
        self.textures[key] = (image_bytes, mime)
        return key

    def add(self, key, *meshes):
        for m in meshes:
            self.parts[key].append(m)

    def write(self, path):
        bin_ = bytearray()
        views, accessors, prims, mats = [], [], [], []
        images, textures = [], []
        mat_index = {}

        def push(data, target):
            while len(bin_) % 4:
                bin_.append(0)
            off = len(bin_)
            bin_.extend(data)
            views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data), "target": target})
            return len(views) - 1

        for key, meshes in self.parts.items():
            if not meshes:
                continue
            pos_all, idx_all, base = [], [], 0
            for m in meshes:
                pos_all.append(m.pos)
                idx_all.append(m.idx + base)
                base += len(m.pos)
            pos = np.vstack(pos_all).astype(np.float32)
            idx = np.vstack(idx_all).astype(np.uint32)
            nor = np.vstack([vertex_normals(m.pos, m.idx) for m in meshes]).astype(np.float32)
            vp = push(pos.tobytes(), 34962)
            accessors.append({"bufferView": vp, "componentType": 5126, "count": len(pos), "type": "VEC3",
                              "min": pos.min(0).tolist(), "max": pos.max(0).tolist()})
            ap = len(accessors) - 1
            vn = push(nor.tobytes(), 34962)
            accessors.append({"bufferView": vn, "componentType": 5126, "count": len(nor), "type": "VEC3"})
            an = len(accessors) - 1
            vi = push(idx.flatten().tobytes(), 34963)
            accessors.append({"bufferView": vi, "componentType": 5125, "count": idx.size, "type": "SCALAR"})
            ai = len(accessors) - 1
            attributes = {"POSITION": ap, "NORMAL": an}
            if all(m.uv is not None for m in meshes):
                uv = np.vstack([m.uv for m in meshes]).astype(np.float32)
                vu = push(uv.tobytes(), 34962)
                accessors.append({"bufferView": vu, "componentType": 5126, "count": len(uv), "type": "VEC2"})
                attributes["TEXCOORD_0"] = len(accessors) - 1
            if key not in mat_index:
                mat_index[key] = len(mats)
                m = json.loads(json.dumps(self.materials[key]))
                if key in self.textures:
                    data, mime = self.textures[key]
                    while len(bin_) % 4:
                        bin_.append(0)
                    off = len(bin_); bin_.extend(data)
                    views.append({"buffer": 0, "byteOffset": off, "byteLength": len(data)})
                    images.append({"bufferView": len(views) - 1, "mimeType": mime})
                    textures.append({"sampler": 0, "source": len(images) - 1})
                    m["pbrMetallicRoughness"]["baseColorTexture"] = {"index": len(textures) - 1}
                mats.append(m)
            prims.append({"attributes": attributes, "indices": ai, "material": mat_index[key]})
        while len(bin_) % 4:
            bin_.append(0)
        gltf = {
            "asset": {"version": "2.0", "generator": "Athina placeholder generator", "extras": self.extras},
            "scene": 0, "scenes": [{"nodes": [0]}],
            "nodes": [{"mesh": 0, "name": self.name}],
            "meshes": [{"name": self.name, "primitives": prims}],
            "materials": mats, "accessors": accessors, "bufferViews": views,
            "buffers": [{"byteLength": len(bin_)}],
        }
        if images:
            gltf.update(images=images, textures=textures,
                        samplers=[{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}])
        js = json.dumps(gltf, separators=(",", ":")).encode()
        while len(js) % 4:
            js += b" "
        total = 12 + 8 + len(js) + 8 + len(bin_)
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, total))
            f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
            f.write(struct.pack("<II", len(bin_), 0x004E4942)); f.write(bin_)
        return total


# ----------------------------------------------------------------------------
# Composições (uma por prato)
# ----------------------------------------------------------------------------
WHITE, CREAM_PLATE, SLATE, WOOD, IRON = "#F4F1EA", "#EDE6D8", "#2B2B2E", "#8A5A35", "#1E1E20"


def greens(g, rng, n, cx=0, cz=0, spread=0.05, y=0.016, size=0.028, colors=("#4E7A2E", "#6B9A3A", "#3E6B2A")):
    for i in range(n):
        k = g.mat(f"verde{i % len(colors)}", colors[i % len(colors)], 0.6)
        a = rng.uniform(0, 2 * math.pi); d = rng.uniform(0, spread)
        m = leaf(rng, size * rng.uniform(0.7, 1.2)).transform(
            t=(cx + d * math.cos(a), y + rng.uniform(0, 0.02), cz + d * math.sin(a)),
            r=(rng.uniform(-0.6, 0.6), rng.uniform(0, 6.28), rng.uniform(-0.6, 0.6)))
        g.add(k, m)


def pasta_strands(g, key, rng, count, cx, cz, radius, y0, thickness, height=0.035):
    for s in range(count):
        pts = []
        r0 = rng.uniform(0.2, 1.0) * radius
        phase = rng.uniform(0, 2 * math.pi)
        turns = rng.uniform(1.2, 2.2)
        for i in range(48):
            t = i / 47
            ang = phase + turns * 2 * math.pi * t
            rr = r0 * (1 - 0.55 * t) + 0.004 * math.sin(9 * t + s)
            pts.append((cx + rr * math.cos(ang), y0 + height * t * (1 - 0.3 * rr / radius) + 0.004 * math.sin(5 * t + s),
                        cz + rr * math.sin(ang)))
        g.add(key, tube(pts[::2], thickness, seg=5))


def build(slug):
    rng = np.random.default_rng(sum(map(ord, slug)) * 7919)  # determinístico
    g = GLB(slug)

    if slug == "almondegas-da-casa":
        g.add(g.mat("louca", WHITE, 0.25), plate(0.12))
        g.add(g.mat("sugo", "#A3261B", 0.45), superellipsoid(0.07, 0.006, 0.07).transform(t=(0, 0.016, 0)))
        k = g.mat("carne", "#5A3220", 0.8)
        for i in range(7):
            a = i * 2 * math.pi / 6; d = 0 if i == 6 else 0.045
            g.add(k, sphere(0.019).jitter(0.0015, rng).transform(t=(d * math.cos(a), 0.034 if i < 6 else 0.05, d * math.sin(a))))
        greens(g, rng, 6, spread=0.06, y=0.04, size=0.012, colors=("#3E7A2E",))
        g.add(g.mat("queijo", "#F2E6C2", 0.6), *[superellipsoid(0.006, 0.002, 0.004).transform(
            t=(rng.uniform(-0.04, 0.04), 0.055, rng.uniform(-0.04, 0.04)), r=(0, rng.uniform(0, 3), 0)) for _ in range(10)])

    elif slug == "salada-tropical":
        g.add(g.mat("louca", "#D9CBB4", 0.5), bowl(0.12, 0.065))
        g.add(g.mat("folhas", "#4F8A2B", 0.6), superellipsoid(0.09, 0.02, 0.09).jitter(0.006, rng).transform(t=(0, 0.03, 0)))
        g.add(g.mat("abacate", "#9DBA4A", 0.5), *[superellipsoid(0.045, 0.01, 0.016, 0.8, 0.8).transform(
            t=(0.03 + 0.012 * i, 0.055, -0.01 + 0.012 * i), r=(0, 0.8, 0)) for i in range(3)])
        g.add(g.mat("tomate", "#D63A2A", 0.35), *[sphere(0.012).transform(t=(-0.04 + rng.uniform(-0.02, 0.02), 0.058, 0.035 + rng.uniform(-0.02, 0.02))) for _ in range(5)])
        g.add(g.mat("grao", "#E2B66B", 0.7), *[sphere(0.006).transform(t=(rng.uniform(-0.055, -0.01), 0.056, rng.uniform(-0.06, -0.02))) for _ in range(14)])
        g.add(g.mat("repolho", "#7A2E6B", 0.6), *[tube([(x, 0.054, z), (x + 0.02, 0.058, z + 0.01)], 0.002) for x, z in rng.uniform(-0.05, 0.05, (12, 2))])
        g.add(g.mat("abobora", "#E07A2A", 0.6), *[superellipsoid(0.008, 0.008, 0.008, 0.3, 0.3).transform(t=(rng.uniform(0.0, 0.05), 0.057, rng.uniform(0.02, 0.06))) for _ in range(6)])

    elif slug == "salada-morna-frutas-vermelhas":
        g.add(g.mat("louca", SLATE, 0.5), plate(0.13))
        greens(g, rng, 18, spread=0.08, y=0.02, size=0.024)
        g.add(g.mat("frango", "#B27A3C", 0.7), *[superellipsoid(0.025, 0.009, 0.014, 0.6, 0.6).jitter(0.001, rng).transform(
            t=(0.04 * math.cos(a), 0.045, 0.04 * math.sin(a)), r=(0.2, a, 0.1)) for a in np.linspace(0, 5.5, 5)])
        g.add(g.mat("framboesa", "#C2213F", 0.5), *[sphere(0.008).jitter(0.0012, rng).transform(t=(rng.uniform(-0.07, 0.07), 0.05, rng.uniform(-0.07, 0.07))) for _ in range(8)])
        g.add(g.mat("pera", "#E4D9A0", 0.5), *[wedge(0.03, 0.006, 0.5).transform(t=(rng.uniform(-0.05, 0.05), 0.05, rng.uniform(-0.05, 0.05)), r=(0, rng.uniform(0, 6), 0)) for _ in range(4)])

    elif slug == "file-mignon-ao-vinho":
        g.add(g.mat("louca", WHITE, 0.25), superellipsoid(0.13, 0.012, 0.13, 1, 0.25, 48, 12).transform(t=(0, 0.012, 0)))
        g.add(g.mat("molho", "#4A0F14", 0.25), superellipsoid(0.07, 0.003, 0.06).transform(t=(-0.01, 0.025, 0.01)))
        g.add(g.mat("carne", "#4B2618", 0.85), superellipsoid(0.05, 0.022, 0.045, 0.5, 0.9).jitter(0.0015, rng).transform(t=(-0.015, 0.05, 0.01)))
        k = g.mat("aspargo", "#5C8A2E", 0.55)
        for i in range(5):
            z = -0.035 + i * 0.017
            g.add(k, tube([(0.0, 0.03 + 0.005 * i, z), (0.07, 0.04 + 0.004 * i, z + 0.03), (0.11, 0.045 + 0.003 * i, z + 0.045)], 0.0045))
        g.add(g.mat("pure", "#EBD9A4", 0.7), superellipsoid(0.03, 0.018, 0.03).jitter(0.002, rng).transform(t=(-0.06, 0.035, -0.06)))

    elif slug == "bisteca-com-maca":
        g.add(g.mat("louca", WHITE, 0.25), plate(0.135))
        g.add(g.mat("carne", "#8E5A34", 0.75), superellipsoid(0.07, 0.016, 0.055, 0.5, 0.8).jitter(0.001, rng).transform(t=(0.0, 0.04, 0.01), r=(0, 0.3, 0)))
        g.add(g.mat("osso", "#E6D8BE", 0.6), superellipsoid(0.03, 0.01, 0.009, 0.6, 0.6).transform(t=(0.07, 0.035, 0.03), r=(0, 0.6, 0)))
        g.add(g.mat("maca", "#D6A240", 0.45), *[superellipsoid(0.008, 0.008, 0.008, 0.25, 0.25).transform(
            t=(rng.uniform(-0.04, 0.04), 0.063, rng.uniform(-0.02, 0.04)), r=(0, rng.uniform(0, 3), 0)) for _ in range(12)])
        greens(g, rng, 10, cx=0.03, cz=-0.06, spread=0.03, y=0.03, size=0.018, colors=("#2F6B2A", "#3C7A30"))
        g.add(g.mat("batata", "#D9A85A", 0.6), superellipsoid(0.03, 0.012, 0.025, 0.5, 0.5).transform(t=(-0.06, 0.03, -0.05)))

    elif slug == "salmao-em-crosta-de-ervas":
        g.add(g.mat("louca", SLATE, 0.45), superellipsoid(0.14, 0.01, 0.12, 1, 0.6, 48, 12).transform(t=(0, 0.01, 0)))
        g.add(g.mat("legumes", "#C46A2A", 0.6), *[tube([(x, 0.025, z), (x + 0.05, 0.03, z + 0.01)], 0.003) for x, z in rng.uniform(-0.07, 0.0, (18, 2))])
        g.add(g.mat("vagem", "#4F8A2B", 0.6), *[tube([(x, 0.027, z), (x + 0.06, 0.032, z - 0.015)], 0.0035) for x, z in rng.uniform(-0.06, 0.0, (10, 2))])
        g.add(g.mat("salmao", "#E8743F", 0.55), superellipsoid(0.07, 0.018, 0.03, 0.55, 0.6).transform(t=(0.0, 0.05, 0.0), r=(0, 0.35, 0.05)))
        g.add(g.mat("crosta", "#7B4A22", 0.8), superellipsoid(0.07, 0.004, 0.03, 0.6, 0.6).jitter(0.0012, rng).transform(t=(0.0, 0.067, 0.0), r=(0, 0.35, 0.05)))
        g.add(g.mat("limao", "#E9D44A", 0.4), wedge(0.025, 0.012, 1.2).transform(t=(0.07, 0.03, 0.05)))

    elif slug == "moqueca-athina":
        body, handle = pan(0.13, 0.05)
        g.add(g.mat("panela", IRON, 0.6, 0.3), body, handle)
        g.add(g.mat("caldo", "#D9772A", 0.3), liquid(0.12, 0.11, 0.04, 0.008))
        g.add(g.mat("peixe", "#F0DFC4", 0.6), *[superellipsoid(0.03, 0.01, 0.02, 0.6, 0.6).transform(
            t=(0.06 * math.cos(a), 0.044, 0.06 * math.sin(a)), r=(0, a, 0)) for a in np.linspace(0, 5.2, 5)])
        g.add(g.mat("limao", "#E9D44A", 0.4), *[lathe([(0, 0), (0.02, 0), (0.02, 0.004), (0, 0.004)], 24).transform(t=(rng.uniform(-0.05, 0.05), 0.045, rng.uniform(-0.05, 0.05))) for _ in range(3)])
        greens(g, rng, 14, spread=0.09, y=0.045, size=0.008, colors=("#2F7A2A",))
        g.add(g.mat("pimentao", "#B91C1C", 0.5), *[superellipsoid(0.012, 0.003, 0.004).transform(t=(rng.uniform(-0.07, 0.07), 0.046, rng.uniform(-0.07, 0.07)), r=(0, rng.uniform(0, 3), 0)) for _ in range(8)])

    elif slug == "costela-barbecue":
        g.add(g.mat("tabua", WOOD, 0.8), board(0.44, 0.26))
        g.add(g.mat("costela", "#3B1C10", 0.6), superellipsoid(0.13, 0.022, 0.055, 0.45, 0.4).jitter(0.002, rng).transform(t=(0.02, 0.045, 0.0)))
        g.add(g.mat("osso", "#E6D8BE", 0.6), *[tube([(x, 0.035, -0.06), (x, 0.035, -0.07)], 0.005) for x in np.linspace(-0.09, 0.13, 7)])
        g.add(g.mat("tomate", "#D63A2A", 0.4), *[lathe([(0, 0), (0.025, 0), (0.025, 0.006), (0, 0.006)], 32).transform(t=(-0.15 + 0.012 * i, 0.024 + 0.002 * i, 0.06 - 0.01 * i), r=(0.2, 0, 0)) for i in range(4)])
        g.add(g.mat("ramekin", WHITE, 0.3), lathe([(0, 0), (0.028, 0), (0.03, 0.03), (0.027, 0.03), (0.025, 0.004), (0, 0.004)]).transform(t=(-0.15, 0.022, -0.06)))
        g.add(g.mat("molho", "#5A1A0E", 0.3), liquid(0.026, 0.025, 0.026, 0.004).transform(t=(-0.15, 0.022, -0.06)))
        g.add(g.mat("picles", "#9AAA3A", 0.5), *[sphere(0.008).transform(t=(0.15 + rng.uniform(-0.02, 0.02), 0.03, 0.07 + rng.uniform(-0.02, 0.02))) for _ in range(6)])

    elif slug == "executivo-contrafile-fritas":
        g.add(g.mat("louca", WHITE, 0.25), plate(0.14))
        g.add(g.mat("carne", "#5B2A1C", 0.8), superellipsoid(0.065, 0.012, 0.035, 0.5, 0.6).jitter(0.001, rng).transform(t=(0.035, 0.035, 0.0), r=(0, -0.5, 0)))
        g.add(g.mat("ponto", "#A8443A", 0.6), *[superellipsoid(0.002, 0.011, 0.03, 0.5, 0.5).transform(t=(0.01 + 0.02 * i, 0.035, 0.0), r=(0, -0.5, 0)) for i in range(3)])
        g.add(g.mat("fritas", "#E2A84A", 0.6), *[superellipsoid(0.03, 0.005, 0.005, 0.4, 0.4).transform(
            t=(-0.05 + rng.uniform(-0.03, 0.03), 0.028 + rng.uniform(0, 0.02), rng.uniform(-0.05, 0.05)),
            r=(rng.uniform(-0.3, 0.3), rng.uniform(0, 6.28), rng.uniform(-0.3, 0.3))) for _ in range(22)])
        greens(g, rng, 6, cx=-0.05, spread=0.04, y=0.055, size=0.006, colors=("#2F6B2A",))

    elif slug == "executivo-camarao-curry":
        g.add(g.mat("louca", WHITE, 0.25), pasta_plate(0.13))
        g.add(g.mat("curry", "#C9741F", 0.35), liquid(0.075, 0.05, 0.047, 0.014))
        g.add(g.mat("arroz", "#F4F0E4", 0.8), superellipsoid(0.035, 0.03, 0.035).jitter(0.003, rng).transform(t=(-0.012, 0.055, -0.01)))
        k = g.mat("camarao", "#E8763A", 0.45)
        for a in np.linspace(0, 2 * math.pi, 6, endpoint=False):
            cx, cz = 0.05 * math.cos(a), 0.05 * math.sin(a)
            pts = [(cx + 0.014 * math.cos(t + a), 0.053 + 0.004 * math.sin(t), cz + 0.014 * math.sin(t + a)) for t in np.linspace(0, 4.2, 14)]
            g.add(k, tube(pts, lambda u: 0.007 * (1 - 0.6 * u), seg=8))
        greens(g, rng, 8, spread=0.04, y=0.085, size=0.009)

    elif slug == "risoto-de-parmesao":
        g.add(g.mat("louca", WHITE, 0.25), pasta_plate(0.14))
        g.add(g.mat("risoto", "#E6C98A", 0.55), superellipsoid(0.055, 0.016, 0.055).transform(t=(0, 0.044, 0)))
        g.add(g.mat("graos", "#EAD7A2", 0.6), *[superellipsoid(0.0045, 0.0022, 0.0022).transform(
            t=(rng.uniform(-0.045, 0.045), 0.058 + rng.uniform(0, 0.003), rng.uniform(-0.045, 0.045)), r=(0, rng.uniform(0, 6), 0)) for _ in range(90)])
        g.add(g.mat("parmesao", "#F8EFD2", 0.5), *[superellipsoid(0.01, 0.0012, 0.006).transform(t=(rng.uniform(-0.02, 0.02), 0.064, rng.uniform(-0.02, 0.02)), r=(rng.uniform(-0.5, 0.5), rng.uniform(0, 6), 0)) for _ in range(6)])
        greens(g, rng, 5, spread=0.025, y=0.066, size=0.008)
        g.add(g.mat("raspas", "#E8D23C", 0.4), *[tube([(x, 0.063, z), (x + 0.008, 0.064, z + 0.003)], 0.0012) for x, z in rng.uniform(-0.03, 0.03, (10, 2))])

    elif slug == "spaghetti-ao-camarao":
        body, handle = pan(0.12, 0.04)
        g.add(g.mat("frigideira", IRON, 0.55, 0.4), body, handle)
        pasta_strands(g, g.mat("massa", "#E8C46E", 0.5), rng, 26, 0, 0, 0.09, 0.012, 0.0022, 0.03)
        g.add(g.mat("tomate", "#D0331F", 0.35), *[sphere(0.01).transform(t=(rng.uniform(-0.07, 0.07), 0.045, rng.uniform(-0.07, 0.07))) for _ in range(8)])
        k = g.mat("camarao", "#EE7B45", 0.45)
        for a in np.linspace(0, 2 * math.pi, 7, endpoint=False):
            cx, cz = 0.055 * math.cos(a), 0.055 * math.sin(a)
            pts = [(cx + 0.013 * math.cos(t + a), 0.05 + 0.003 * math.sin(t), cz + 0.013 * math.sin(t + a)) for t in np.linspace(0, 4.2, 14)]
            g.add(k, tube(pts, lambda u: 0.0065 * (1 - 0.6 * u), seg=8))
        greens(g, rng, 10, spread=0.07, y=0.05, size=0.006, colors=("#2F7A2A",))

    elif slug == "fettuccine-funghi-mignon":
        g.add(g.mat("louca", CREAM_PLATE, 0.3), pasta_plate(0.14))
        k = g.mat("massa", "#EED7A0", 0.5)
        for s in range(14):
            pts = []
            ph = rng.uniform(0, 6.28); r0 = rng.uniform(0.015, 0.05)
            for i in range(40):
                t = i / 39; ang = ph + 3.6 * t
                rr = r0 * (1 - 0.5 * t)
                pts.append((rr * math.cos(ang), 0.045 + 0.03 * t, rr * math.sin(ang)))
            g.add(k, tube(pts, 0.0028, seg=6).transform(s=(1, 1, 1)))
        g.add(g.mat("mignon", "#5A3020", 0.8), *[superellipsoid(0.01, 0.007, 0.008, 0.4, 0.4).jitter(0.0008, rng).transform(t=(rng.uniform(-0.05, 0.05), 0.07, rng.uniform(-0.05, 0.05))) for _ in range(10)])
        g.add(g.mat("cogumelo", "#9C7A55", 0.7), *[superellipsoid(0.012, 0.005, 0.012).transform(t=(rng.uniform(-0.05, 0.05), 0.075, rng.uniform(-0.05, 0.05)), r=(rng.uniform(-0.4, 0.4), 0, 0)) for _ in range(7)])
        greens(g, rng, 6, spread=0.03, y=0.085, size=0.008)

    elif slug == "penne-a-bolonhesa":
        g.add(g.mat("louca", WHITE, 0.25), pasta_plate(0.14))
        k = g.mat("penne", "#E3913E", 0.5)
        for _ in range(45):
            a = rng.uniform(0, 6.28); d = rng.uniform(0, 0.05)
            h = 0.05 + 0.025 * (1 - d / 0.05) + rng.uniform(0, 0.008)
            g.add(k, lathe([(0.006, -0.016), (0.006, 0.016), (0.0045, 0.016), (0.0045, -0.016), (0.006, -0.016)], 12).transform(
                t=(d * math.cos(a), h, d * math.sin(a)), r=(rng.uniform(0, 3), rng.uniform(0, 3), rng.uniform(0, 3))))
        g.add(g.mat("ragu", "#7A2A18", 0.6), *[sphere(0.005).jitter(0.001, rng).transform(t=(rng.uniform(-0.04, 0.04), 0.07 + rng.uniform(0, 0.012), rng.uniform(-0.04, 0.04))) for _ in range(30)])
        g.add(g.mat("parmesao", "#F5EBCB", 0.6), *[superellipsoid(0.003, 0.001, 0.002).transform(t=(rng.uniform(-0.03, 0.03), 0.086, rng.uniform(-0.03, 0.03))) for _ in range(25)])

    elif slug == "tiramisu-da-casa":
        g.add(g.mat("louca", WHITE, 0.25), plate(0.1))
        layers = [("#EFE3C8", 0.012), ("#6B3F22", 0.008), ("#EFE3C8", 0.012), ("#6B3F22", 0.008), ("#F3EAD6", 0.012)]
        y = 0.014
        for i, (c, h) in enumerate(layers):
            g.add(g.mat(f"camada{i}", c, 0.6), superellipsoid(0.04, h / 2, 0.035, 0.15, 0.2).transform(t=(0, y + h / 2, 0)))
            y += h
        g.add(g.mat("cacau", "#4A2A16", 0.95), superellipsoid(0.04, 0.0015, 0.035, 0.15, 0.2).jitter(0.0006, rng).transform(t=(0, y + 0.001, 0)))
        g.add(g.mat("po", "#5A3520", 0.95), *[superellipsoid(0.006, 0.0006, 0.006).transform(t=(0.055 + rng.uniform(-0.01, 0.01), 0.015, rng.uniform(-0.04, 0.04))) for _ in range(6)])

    elif slug == "bolo-trufado-de-chocolate":
        g.add(g.mat("louca", WHITE, 0.25), plate(0.1))
        g.add(g.mat("massa", "#3A1E12", 0.7), wedge(0.085, 0.07, 0.75).transform(t=(-0.035, 0.014, 0)))
        g.add(g.mat("ganache", "#24120A", 0.25), wedge(0.087, 0.006, 0.76).transform(t=(-0.036, 0.084, 0)))
        g.add(g.mat("recheio", "#7A4A2A", 0.5), *[wedge(0.0855, 0.006, 0.752).transform(t=(-0.0352, 0.03 + 0.02 * i, 0)) for i in range(2)])
        g.add(g.mat("rosetas", "#4B2A18", 0.6), *[superellipsoid(0.009, 0.009, 0.009).jitter(0.001, rng).transform(t=(-0.035 + 0.075 * math.cos(a), 0.095, 0.075 * math.sin(a))) for a in (-0.25, 0.0, 0.25)])

    elif slug == "panna-cotta-de-morango":
        g.add(g.mat("louca", SLATE, 0.5), board(0.24, 0.12, 0.012))
        gk = g.mat("vidro", "#FFFFFF", 0.05, 0.0, alpha=0.25)
        for i, x in enumerate((-0.06, 0.0, 0.06)):
            g.add(gk, glass(0.024, 0.02, 0.07, 0.002).transform(t=(x, 0.012, 0)))
            g.add(g.mat("creme", "#F6EEDC", 0.4), liquid(0.021, 0.0175, 0.048, 0.008).transform(t=(x, 0.012, 0)))
            g.add(g.mat("calda", "#B5162E", 0.25), liquid(0.022, 0.021, 0.06, 0.048).transform(t=(x, 0.012, 0)))
            g.add(g.mat("morango", "#D1202F", 0.4), superellipsoid(0.009, 0.011, 0.009).transform(t=(x + 0.004, 0.084, 0.003), r=(0.4, 0, 0.3)))
            g.add(g.mat("folha", "#3E7A2E", 0.6), leaf(rng, 0.007).transform(t=(x - 0.006, 0.086, -0.004), r=(0.3, i, 0)))

    elif slug == "taca-vinho-tinto":
        gl, wine = wine_glass()
        g.add(g.mat("vidro", "#FFFFFF", 0.05, 0.0, alpha=0.22), gl)
        g.add(g.mat("vinho", "#5E0B1A", 0.1, 0.0, alpha=0.92), wine)
        g.add(g.mat("base", "#2B2B2E", 0.7), lathe([(0, 0), (0.06, 0), (0.06, 0.002), (0, 0.002)]).transform(t=(0, -0.002, 0)))

    elif slug == "gin-laranja-alecrim":
        g.add(g.mat("vidro", "#FFFFFF", 0.05, 0.0, alpha=0.22), glass(0.042, 0.036, 0.12))
        g.add(g.mat("drink", "#E89A3A", 0.1, 0.0, alpha=0.8), liquid(0.039, 0.033, 0.095))
        g.add(g.mat("gelo", "#EAF4F8", 0.05, 0.0, alpha=0.55), *[superellipsoid(0.013, 0.013, 0.013, 0.4, 0.4).transform(
            t=(rng.uniform(-0.015, 0.015), 0.03 + 0.025 * i, rng.uniform(-0.015, 0.015)), r=tuple(rng.uniform(0, 1, 3))) for i in range(3)])
        g.add(g.mat("laranja", "#F08A24", 0.4), lathe([(0, 0), (0.03, 0), (0.03, 0.005), (0, 0.005)], 32).transform(t=(0.025, 0.12, 0), r=(0, 0, 1.2)))
        g.add(g.mat("alecrim", "#2F5A2A", 0.6), tube([(0.0, 0.06, 0.0), (0.005, 0.12, 0.004), (0.01, 0.17, 0.008)], 0.0018))
        g.add(g.mat("folhinhas", "#3F7A35", 0.6), *[superellipsoid(0.006, 0.001, 0.0015).transform(t=(0.006 + 0.002 * (i % 2), 0.13 + 0.004 * i, 0.005), r=(0, i, 0.6 if i % 2 else -0.6)) for i in range(8)])

    elif slug == "cha-gelado-de-limao":
        g.add(g.mat("tabua", WOOD, 0.8), board(0.16, 0.12, 0.018))
        g.add(g.mat("vidro", "#FFFFFF", 0.05, 0.0, alpha=0.22), glass(0.038, 0.032, 0.14).transform(t=(0, 0.018, 0)))
        g.add(g.mat("cha", "#8A4A12", 0.1, 0.0, alpha=0.85), liquid(0.035, 0.029, 0.115).transform(t=(0, 0.018, 0)))
        g.add(g.mat("gelo", "#EAF4F8", 0.05, 0.0, alpha=0.55), *[superellipsoid(0.012, 0.012, 0.012, 0.4, 0.4).transform(t=(rng.uniform(-0.01, 0.01), 0.07 + 0.024 * i, rng.uniform(-0.01, 0.01)), r=tuple(rng.uniform(0, 1, 3))) for i in range(3)])
        g.add(g.mat("limao", "#9CC23A", 0.4), lathe([(0, 0), (0.024, 0), (0.024, 0.005), (0, 0.005)], 32).transform(t=(0.03, 0.15, 0), r=(0, 0, 1.2)))
        g.add(g.mat("limaoinv", "#6FA52A", 0.4), wedge(0.022, 0.012, 1.4).transform(t=(0.05, 0.018, 0.035)))
    else:
        raise ValueError(slug)
    return g


SLUGS = [
    "almondegas-da-casa", "salada-tropical", "salada-morna-frutas-vermelhas",
    "file-mignon-ao-vinho", "bisteca-com-maca", "salmao-em-crosta-de-ervas", "moqueca-athina", "costela-barbecue",
    "executivo-contrafile-fritas", "executivo-camarao-curry",
    "risoto-de-parmesao", "spaghetti-ao-camarao", "fettuccine-funghi-mignon", "penne-a-bolonhesa",
    "tiramisu-da-casa", "bolo-trufado-de-chocolate", "panna-cotta-de-morango",
    "taca-vinho-tinto", "gin-laranja-alecrim", "cha-gelado-de-limao",
]

if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    for slug in SLUGS:
        size = build(slug).write(os.path.join(OUT_DIR, f"{slug}.glb"))
        print(f"{slug}.glb  {size / 1024:.0f} KB")
