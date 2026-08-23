# -*- coding: utf-8 -*-
"""
Gerador de Ontologia Anatômica e Mapeamento Biomecânico do StrongLog Pro.
Mapeia 1.324 exercícios científicos do ExerciseDB para nós anatômicos bilaterais 3D/2D.
"""

import json
import os
import re

DATASET_FILE = os.path.join("src", "data", "exercises.min.json")
OUTPUT_ONTOLOGY_FILE = os.path.join("src", "data", "muscle_ontology.json")

# 1. Dicionário de Correção de Caracteres no Dataset
CORRECTIONS = {
    "Quadrceps": "Quadríceps",
    "Abdmen": "Abdômen",
    "Antebrao": "Antebraço",
    "Bceps": "Bíceps",
    "Trceps": "Tríceps",
    "Trapzio": "Trapézio",
    "Serrtil": "Serrátil",
    "Glteos": "Glúteos",
    "Elevador da Escpula": "Elevador da Escápula",
    "cho": "chão",
    "mos": "mãos",
    "atrs": "atrás",
    "cabea": "cabeça",
    "at": "até",
    "ngulo": "ângulo",
    "Faa": "Faça",
    "posio": "posição",
    "repeties": "repetições",
    "nmero": "número",
    "flexo": "flexão",
    "extenso": "extensão",
    "aduto": "adução",
    "abduo": "abdução",
    "inclinao": "inclinação",
    "elevao": "elevação",
    "rotao": "rotação",
    "direo": "direção",
    "contraio": "contração",
    "estmulo": "estímulo",
    "presso": "pressão"
}

# 2. Definição Canônica dos 24 Nós Anatômicos Principais (Agrupando os 32 nós bilaterais)
ANATOMICAL_GROUPS = {
    "chest": {
        "id": "chest",
        "name": "Peitoral",
        "category": "upper",
        "view": "anterior",
        "nodes": ["chest_upper_l", "chest_upper_r", "chest_lower_l", "chest_lower_r"],
        "targets": ["Peitoral"],
        "recovery_hours": 48
    },
    "lats": {
        "id": "lats",
        "name": "Dorsais",
        "category": "back",
        "view": "posterior",
        "nodes": ["lat_l", "lat_r"],
        "targets": ["Dorsal"],
        "recovery_hours": 48
    },
    "upper_back": {
        "id": "upper_back",
        "name": "Costas Superior & Romboides",
        "category": "back",
        "view": "posterior",
        "nodes": ["upper_back_l", "upper_back_r", "rhomboids"],
        "targets": ["Costas Superior", "Elevador da Escápula"],
        "recovery_hours": 48
    },
    "traps": {
        "id": "traps",
        "name": "Trapézio",
        "category": "back",
        "view": "posterior",
        "nodes": ["trap_l", "trap_r"],
        "targets": ["Trapézio"],
        "recovery_hours": 48
    },
    "shoulders_front": {
        "id": "shoulders_front",
        "name": "Deltoide Anterior",
        "category": "shoulders",
        "view": "anterior",
        "nodes": ["delt_ant_l", "delt_ant_r"],
        "targets": ["Deltoides"],
        "recovery_hours": 48
    },
    "shoulders_side": {
        "id": "shoulders_side",
        "name": "Deltoide Lateral",
        "category": "shoulders",
        "view": "anterior",
        "nodes": ["delt_lat_l", "delt_lat_r"],
        "targets": ["Deltoides"],
        "recovery_hours": 48
    },
    "shoulders_rear": {
        "id": "shoulders_rear",
        "name": "Deltoide Posterior",
        "category": "shoulders",
        "view": "posterior",
        "nodes": ["delt_post_l", "delt_post_r"],
        "targets": ["Deltoides"],
        "recovery_hours": 48
    },
    "biceps": {
        "id": "biceps",
        "name": "Bíceps",
        "category": "arms",
        "view": "anterior",
        "nodes": ["biceps_l", "biceps_r", "brachialis_l", "brachialis_r"],
        "targets": ["Bíceps"],
        "recovery_hours": 36
    },
    "triceps": {
        "id": "triceps",
        "name": "Tríceps",
        "category": "arms",
        "view": "posterior",
        "nodes": ["triceps_l", "triceps_r"],
        "targets": ["Tríceps"],
        "recovery_hours": 36
    },
    "forearms": {
        "id": "forearms",
        "name": "Antebraços",
        "category": "arms",
        "view": "anterior",
        "nodes": ["forearm_l", "forearm_r"],
        "targets": ["Antebraço"],
        "recovery_hours": 24
    },
    "abs": {
        "id": "abs",
        "name": "Abdômen",
        "category": "core",
        "view": "anterior",
        "nodes": ["rectus_abdominis", "obliques_l", "obliques_r"],
        "targets": ["Abdômen", "Serrátil"],
        "recovery_hours": 24
    },
    "lower_back": {
        "id": "lower_back",
        "name": "Lombar",
        "category": "core",
        "view": "posterior",
        "nodes": ["erector_spinae_l", "erector_spinae_r"],
        "targets": ["Lombar/Eretores da Espinha"],
        "recovery_hours": 72
    },
    "glutes": {
        "id": "glutes",
        "name": "Glúteos",
        "category": "legs",
        "view": "posterior",
        "nodes": ["glute_l", "glute_r"],
        "targets": ["Glúteos"],
        "recovery_hours": 48
    },
    "quads": {
        "id": "quads",
        "name": "Quadríceps",
        "category": "legs",
        "view": "anterior",
        "nodes": ["quad_l", "quad_r"],
        "targets": ["Quadríceps"],
        "recovery_hours": 72
    },
    "hamstrings": {
        "id": "hamstrings",
        "name": "Posterior de Coxa",
        "category": "legs",
        "view": "posterior",
        "nodes": ["hamstring_l", "hamstring_r"],
        "targets": ["Posterior de Coxa"],
        "recovery_hours": 72
    },
    "calves": {
        "id": "calves",
        "name": "Panturrilhas",
        "category": "legs",
        "view": "posterior",
        "nodes": ["calf_l", "calf_r"],
        "targets": ["Panturrilha"],
        "recovery_hours": 24
    },
    "adductors": {
        "id": "adductors",
        "name": "Adutores",
        "category": "legs",
        "view": "anterior",
        "nodes": ["adductor_l", "adductor_r"],
        "targets": ["Adutores"],
        "recovery_hours": 48
    },
    "abductors": {
        "id": "abductors",
        "name": "Abdutores",
        "category": "legs",
        "view": "posterior",
        "nodes": ["abductor_l", "abductor_r"],
        "targets": ["Abdutores"],
        "recovery_hours": 48
    },
    "cardio": {
        "id": "cardio",
        "name": "Cardiovascular",
        "category": "cardio",
        "view": "both",
        "nodes": ["heart_system"],
        "targets": ["Cardiovascular"],
        "recovery_hours": 24
    }
}

# 3. Mapeamento Secundário por Palavras-Chave e Targets do ExerciseDB
SECONDARY_MAPPING = {
    "triceps": "triceps",
    "biceps": "biceps",
    "shoulders": "shoulders_front",
    "delts": "shoulders_side",
    "chest": "chest",
    "lats": "lats",
    "upper back": "upper_back",
    "middle back": "upper_back",
    "lower back": "lower_back",
    "glutes": "glutes",
    "hamstrings": "hamstrings",
    "quads": "quads",
    "calves": "calves",
    "abs": "abs",
    "core": "abs",
    "obliques": "abs",
    "forearms": "forearms",
    "traps": "traps",
    "hip flexors": "abs",
    "adductors": "adductors",
    "abductors": "abductors"
}

def clean_text(text):
    if not isinstance(text, str):
        return text
    res = text
    for corrupted, fixed in CORRECTIONS.items():
        res = res.replace(corrupted, fixed)
    return res

def infer_muscle_group(ex):
    name = ex.get("name", "").lower()
    name_en = ex.get("name_en", "").lower()
    target = clean_text(ex.get("target", ""))
    
    # Detecção refinada para Ombros (Anterior vs Lateral vs Posterior)
    if "deltoide" in target.lower() or "deltoid" in name_en:
        if any(w in name for w in ["desenvolvimento", "press", "frontal", "arnold"]):
            return "shoulders_front"
        elif any(w in name for w in ["lateral", "remada alta"]):
            return "shoulders_side"
        elif any(w in name for w in ["posterior", "crucifixo invertido", "face pull", "reverse"]):
            return "shoulders_rear"
        return "shoulders_side"

    for group_id, conf in ANATOMICAL_GROUPS.items():
        if target in conf["targets"]:
            return group_id

    # Fallback por keywords
    if "supino" in name or "crucifixo" in name or "peck deck" in name:
        return "chest"
    if "puxada" in name or "pulley" in name or "barra fixa" in name or "pulldown" in name:
        return "lats"
    if "remada" in name:
        return "upper_back"
    if "agachamento" in name or "leg press" in name or "extensora" in name:
        return "quads"
    if "stiff" in name or "flexora" in name or "romeno" in name:
        return "hamstrings"
    if "rosca" in name:
        return "biceps"
    if "tríceps" in name or "testa" in name or "paralelas" in name:
        return "triceps"
    if "panturrilha" in name or "gêmeos" in name:
        return "calves"
    if "abdominal" in name or "prancha" in name:
        return "abs"
    if "elevação pélvica" in name or "hip thrust" in name or "glúteo" in name:
        return "glutes"

    return "upper_back"

def main():
    print("Carregando base de exercícios...")
    with open(DATASET_FILE, "r", encoding="utf-8") as f:
        exercises = json.load(f)

    sanitized_exercises = []
    exercise_muscle_map = {}

    for ex in exercises:
        # Sanitiza campos de texto
        ex["name"] = clean_text(ex.get("name", ""))
        ex["target"] = clean_text(ex.get("target", ""))
        ex["body_part"] = clean_text(ex.get("body_part", ""))
        ex["equipment"] = clean_text(ex.get("equipment", ""))
        if "instruction_steps" in ex:
            ex["instruction_steps"] = [clean_text(s) for s in ex["instruction_steps"]]

        primary_group = infer_muscle_group(ex)
        ex["primary_muscle_group"] = primary_group

        # Mapeia secundários
        sec_muscles_raw = ex.get("secondary_muscles", [])
        sec_groups = []
        for sec in sec_muscles_raw:
            sec_clean = sec.lower().strip()
            for key, mapped_group in SECONDARY_MAPPING.items():
                if key in sec_clean and mapped_group != primary_group and mapped_group not in sec_groups:
                    sec_groups.append(mapped_group)

        # Regras biomecânicas automáticas de sinergistas
        if primary_group == "chest" and "triceps" not in sec_groups:
            sec_groups.extend(["triceps", "shoulders_front"])
        elif primary_group in ["lats", "upper_back"] and "biceps" not in sec_groups:
            sec_groups.extend(["biceps", "forearms"])
        elif primary_group == "quads" and "glutes" not in sec_groups:
            sec_groups.extend(["glutes", "calves"])
        elif primary_group == "hamstrings" and "glutes" not in sec_groups:
            sec_groups.extend(["glutes", "lower_back"])

        # Remove duplicatas mantendo ordem
        cleaned_sec = []
        for g in sec_groups:
            if g not in cleaned_sec and g != primary_group:
                cleaned_sec.append(g)

        ex["secondary_muscle_groups"] = cleaned_sec

        exercise_muscle_map[ex["id"]] = {
            "name": ex["name"],
            "primary": primary_group,
            "secondary": cleaned_sec
        }
        sanitized_exercises.append(ex)

    # 4. Salva dataset limpo com os novos campos ontológicos
    with open(DATASET_FILE, "w", encoding="utf-8") as f:
        json.dump(sanitized_exercises, f, ensure_ascii=False, indent=2)

    # 5. Salva arquivo de ontologia e matriz anatômica
    ontology_output = {
        "groups": ANATOMICAL_GROUPS,
        "exercise_count": len(sanitized_exercises),
        "mapping_version": "v5.0_biomechanical_3d"
    }

    with open(OUTPUT_ONTOLOGY_FILE, "w", encoding="utf-8") as f:
        json.dump(ontology_output, f, ensure_ascii=False, indent=2)

    print(f"Sucesso! {len(sanitized_exercises)} exercícios sanitizados e mapeados.")
    print(f"Ontologia salva em {OUTPUT_ONTOLOGY_FILE}.")

if __name__ == "__main__":
    main()
