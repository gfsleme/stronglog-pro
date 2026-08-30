#!/usr/bin/env python3
"""
scripts/generate_human_body_glb.py
Gera o modelo 3D ultraleve (<250KB) src/assets/models/human_body_sci_fi.glb
com 19 sub-meshes nomeados estritamente pela ontologia oficial do StrongLog Pro:
chest, lats, upper_back, traps, lower_back, shoulders_front, shoulders_side,
shoulders_rear, biceps, triceps, forearms, abs, cardio, glutes, quads,
hamstrings, calves, adductors, abductors.
"""

import json
import math
import os
import struct
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_GLB = ROOT_DIR / "src" / "assets" / "models" / "human_body_sci_fi.glb"

def create_ellipsoid(cx, cy, cz, rx, ry, rz, rings=8, segments=12):
    vertices = []
    normals = []
    indices = []

    for i in range(rings + 1):
        v = i / rings
        phi = v * math.pi
        sin_phi = math.sin(phi)
        cos_phi = math.cos(phi)

        for j in range(segments + 1):
            u = j / segments
            theta = u * 2.0 * math.pi
            sin_theta = math.sin(theta)
            cos_theta = math.cos(theta)

            nx = sin_phi * cos_theta
            ny = cos_phi
            nz = sin_phi * sin_theta

            px = cx + rx * nx
            py = cy + ry * ny
            pz = cz + rz * nz

            # Normal analítica para elipsoide
            anx = nx / rx if rx != 0 else 0
            any = ny / ry if ry != 0 else 0
            anz = nz / rz if rz != 0 else 0
            len_an = math.hypot(anx, any, anz)
            if len_an > 0:
                anx /= len_an
                any /= len_an
                anz /= len_an
            else:
                anx, any, anz = 0, 1, 0

            vertices.append((px, py, pz))
            normals.append((anx, any, anz))

    for i in range(rings):
        for j in range(segments):
            first = i * (segments + 1) + j
            second = first + segments + 1

            indices.append(first)
            indices.append(second)
            indices.append(first + 1)

            indices.append(second)
            indices.append(second + 1)
            indices.append(first + 1)

    return vertices, normals, indices

def merge_geometries(geom_list):
    all_verts = []
    all_norms = []
    all_indices = []

    for verts, norms, inds in geom_list:
        offset = len(all_verts)
        all_verts.extend(verts)
        all_norms.extend(norms)
        all_indices.extend([idx + offset for idx in inds])

    return all_verts, all_norms, all_indices

def build_muscle_definitions():
    # Definição dos 19 grupos com anatomia humana estilizada
    defs = {
        'traps': [
            (0.06, 1.46, -0.02, 0.065, 0.085, 0.055),
            (-0.06, 1.46, -0.02, 0.065, 0.085, 0.055),
            (0.0, 1.40, -0.06, 0.085, 0.095, 0.045)
        ],
        'chest': [
            (0.09, 1.27, 0.08, 0.08, 0.075, 0.06),
            (-0.09, 1.27, 0.08, 0.08, 0.075, 0.06)
        ],
        'cardio': [
            (0.0, 1.26, 0.09, 0.035, 0.045, 0.035)
        ],
        'shoulders_front': [
            (0.20, 1.35, 0.04, 0.055, 0.06, 0.05),
            (-0.20, 1.35, 0.04, 0.055, 0.06, 0.05)
        ],
        'shoulders_side': [
            (0.23, 1.34, 0.00, 0.055, 0.065, 0.055),
            (-0.23, 1.34, 0.00, 0.055, 0.065, 0.055)
        ],
        'shoulders_rear': [
            (0.19, 1.34, -0.05, 0.055, 0.06, 0.05),
            (-0.19, 1.34, -0.05, 0.055, 0.06, 0.05)
        ],
        'biceps': [
            (0.22, 1.17, 0.02, 0.048, 0.09, 0.048),
            (-0.22, 1.17, 0.02, 0.048, 0.09, 0.048)
        ],
        'triceps': [
            (0.22, 1.17, -0.03, 0.048, 0.09, 0.048),
            (-0.22, 1.17, -0.03, 0.048, 0.09, 0.048)
        ],
        'forearms': [
            (0.25, 0.94, 0.00, 0.042, 0.12, 0.042),
            (-0.25, 0.94, 0.00, 0.042, 0.12, 0.042)
        ],
        'abs': [
            (0.0, 1.12, 0.07, 0.075, 0.055, 0.045),
            (0.0, 1.01, 0.06, 0.07, 0.055, 0.045),
            (0.11, 1.06, 0.03, 0.038, 0.075, 0.045),
            (-0.11, 1.06, 0.03, 0.038, 0.075, 0.045)
        ],
        'upper_back': [
            (0.08, 1.28, -0.08, 0.065, 0.075, 0.045),
            (-0.08, 1.28, -0.08, 0.065, 0.075, 0.045)
        ],
        'lats': [
            (0.13, 1.14, -0.06, 0.055, 0.11, 0.055),
            (-0.13, 1.14, -0.06, 0.055, 0.11, 0.055)
        ],
        'lower_back': [
            (0.05, 0.96, -0.06, 0.042, 0.07, 0.045),
            (-0.05, 0.96, -0.06, 0.042, 0.07, 0.045)
        ],
        'glutes': [
            (0.095, 0.82, -0.08, 0.085, 0.085, 0.085),
            (-0.095, 0.82, -0.08, 0.085, 0.085, 0.085)
        ],
        'abductors': [
            (0.16, 0.86, -0.01, 0.048, 0.065, 0.055),
            (-0.16, 0.86, -0.01, 0.048, 0.065, 0.055)
        ],
        'adductors': [
            (0.045, 0.70, 0.01, 0.038, 0.10, 0.042),
            (-0.045, 0.70, 0.01, 0.038, 0.10, 0.042)
        ],
        'quads': [
            (0.11, 0.62, 0.04, 0.068, 0.15, 0.068),
            (-0.11, 0.62, 0.04, 0.068, 0.15, 0.068)
        ],
        'hamstrings': [
            (0.11, 0.62, -0.04, 0.062, 0.14, 0.062),
            (-0.11, 0.62, -0.04, 0.062, 0.14, 0.062)
        ],
        'calves': [
            (0.09, 0.28, -0.02, 0.052, 0.13, 0.052),
            (-0.09, 0.28, -0.02, 0.052, 0.13, 0.052)
        ]
    }
    return defs

def generate_glb():
    OUTPUT_GLB.parent.mkdir(parents=True, exist_ok=True)
    defs = build_muscle_definitions()

    bin_data = bytearray()
    buffer_views = []
    accessors = []
    meshes = []
    nodes = []

    groups = list(defs.keys())
    mesh_idx = 0

    for group_name in groups:
        shapes = defs[group_name]
        geom_list = [create_ellipsoid(*shape, rings=8, segments=12) for shape in shapes]
        verts, norms, inds = merge_geometries(geom_list)

        # 1. POSITIONS
        pos_offset = len(bin_data)
        min_x = min(v[0] for v in verts)
        max_x = max(v[0] for v in verts)
        min_y = min(v[1] for v in verts)
        max_y = max(v[1] for v in verts)
        min_z = min(v[2] for v in verts)
        max_z = max(v[2] for v in verts)

        for v in verts:
            bin_data.extend(struct.pack('<fff', v[0], v[1], v[2]))
        pos_length = len(bin_data) - pos_offset

        # Align to 4 bytes
        while len(bin_data) % 4 != 0:
            bin_data.append(0)

        # 2. NORMALS
        norm_offset = len(bin_data)
        for n in norms:
            bin_data.extend(struct.pack('<fff', n[0], n[1], n[2]))
        norm_length = len(bin_data) - norm_offset

        while len(bin_data) % 4 != 0:
            bin_data.append(0)

        # 3. INDICES
        idx_offset = len(bin_data)
        for idx in inds:
            bin_data.extend(struct.pack('<H', idx))
        idx_length = len(bin_data) - idx_offset

        while len(bin_data) % 4 != 0:
            bin_data.append(0)

        # bufferViews
        bv_pos_idx = len(buffer_views)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": pos_offset,
            "byteLength": pos_length,
            "target": 34962  # ARRAY_BUFFER
        })

        bv_norm_idx = len(buffer_views)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": norm_offset,
            "byteLength": norm_length,
            "target": 34962  # ARRAY_BUFFER
        })

        bv_idx_idx = len(buffer_views)
        buffer_views.append({
            "buffer": 0,
            "byteOffset": idx_offset,
            "byteLength": idx_length,
            "target": 34963  # ELEMENT_ARRAY_BUFFER
        })

        # accessors
        acc_pos_idx = len(accessors)
        accessors.append({
            "bufferView": bv_pos_idx,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(verts),
            "type": "VEC3",
            "min": [round(min_x, 4), round(min_y, 4), round(min_z, 4)],
            "max": [round(max_x, 4), round(max_y, 4), round(max_z, 4)]
        })

        acc_norm_idx = len(accessors)
        accessors.append({
            "bufferView": bv_norm_idx,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(norms),
            "type": "VEC3"
        })

        acc_idx_idx = len(accessors)
        accessors.append({
            "bufferView": bv_idx_idx,
            "byteOffset": 0,
            "componentType": 5123,  # UNSIGNED_SHORT
            "count": len(inds),
            "type": "SCALAR"
        })

        # mesh
        meshes.append({
            "name": group_name,
            "primitives": [
                {
                    "attributes": {
                        "POSITION": acc_pos_idx,
                        "NORMAL": acc_norm_idx
                    },
                    "indices": acc_idx_idx,
                    "material": 0
                }
            ]
        })

        # node
        nodes.append({
            "name": group_name,
            "mesh": mesh_idx
        })

        mesh_idx += 1

    gltf_json = {
        "asset": {
            "version": "2.0",
            "generator": "StrongLog-SciFi-Generator-v6.0"
        },
        "scene": 0,
        "scenes": [
            {
                "name": "HumanBodySciFi",
                "nodes": list(range(len(nodes)))
            }
        ],
        "nodes": nodes,
        "meshes": meshes,
        "materials": [
            {
                "name": "SciFiHologramBase",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.0, 1.0, 0.616, 0.6],
                    "metallicFactor": 0.1,
                    "roughnessFactor": 0.4
                },
                "alphaMode": "BLEND",
                "doubleSided": True
            }
        ],
        "accessors": accessors,
        "bufferViews": buffer_views,
        "buffers": [
            {
                "byteLength": len(bin_data)
            }
        ]
    }

    json_str = json.dumps(gltf_json, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    # Pad JSON to 4-byte boundary with spaces (0x20)
    while len(json_bytes) % 4 != 0:
        json_bytes += b' '

    # Header (12 bytes)
    magic = b'glTF'
    version = 2
    json_chunk_type = 0x4E4F534A  # JSON
    bin_chunk_type = 0x004E4942   # BIN\0

    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_data)

    glb_bytes = bytearray()
    # 1. Header
    glb_bytes.extend(magic)
    glb_bytes.extend(struct.pack('<II', version, total_len))

    # 2. JSON chunk
    glb_bytes.extend(struct.pack('<II', len(json_bytes), json_chunk_type))
    glb_bytes.extend(json_bytes)

    # 3. BIN chunk
    glb_bytes.extend(struct.pack('<II', len(bin_data), bin_chunk_type))
    glb_bytes.extend(bin_data)

    with open(OUTPUT_GLB, 'wb') as f:
        f.write(glb_bytes)

    size_kb = len(glb_bytes) / 1024
    print(f"[OK] GLB gerado com sucesso: {OUTPUT_GLB}")
    print(f"   Tamanho: {size_kb:.2f} KB (< 250 KB)")
    print(f"   Sub-meshes ({len(meshes)}): {', '.join(groups)}")
    assert size_kb < 250, "O tamanho do GLB excedeu 250KB!"

if __name__ == '__main__':
    generate_glb()
