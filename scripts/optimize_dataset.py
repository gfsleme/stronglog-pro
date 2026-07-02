import json
import os
import urllib.request
import urllib.parse
import time
import re

# Caminhos dos arquivos
INPUT_FILE = r"C:\Users\Gabriel\.gemini\antigravity-ide\brain\852bf2df-9a63-4f4c-873f-6768350d9c15\scratch\exercises-dataset\data\exercises.json"
OUTPUT_DIR = r"c:\Users\Gabriel\OneDrive\Desktop\Projetos Python\StrongLog\src\data"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "exercises.min.json")

# Garantir que a pasta de destino existe
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Dicionários de tradução por mapeamento estático (Jargão da Musculação BR)
BODY_PART_MAP = {
    "waist": "Cintura",
    "upper arms": "Braços",
    "lower arms": "Antebraços",
    "back": "Costas",
    "chest": "Peito",
    "shoulders": "Ombros",
    "upper legs": "Pernas",
    "lower legs": "Panturrilhas",
    "cardio": "Cardio",
    "neck": "Pescoço"
}

EQUIPMENT_MAP = {
    "body weight": "Peso Corporal",
    "dumbbell": "Halter",
    "cable": "Cabo",
    "barbell": "Barra",
    "leverage machine": "Máquina",
    "band": "Elástico",
    "smith machine": "Smith",
    "kettlebell": "Kettlebell",
    "weighted": "Com Peso",
    "stability ball": "Bola de Estabilidade",
    "ez barbell": "Barra W",
    "rope": "Corda",
    "medicine ball": "Bola Medicinal",
    "exercise ball": "Bola de Exercício",
    "bosu ball": "Bosu",
    "slide board": "Prancha Deslizante",
    "wheel roller": "Rolo Abdominal",
    "roller": "Rolo de Espuma",
    "assisted": "Assistido",
    "parallel bar": "Barras Paralelas",
    "pull-up bar": "Barra Fixa",
    "sledge": "Trenó"
}

TARGET_MAP = {
    "abs": "Abdômen",
    "biceps": "Bíceps",
    "triceps": "Tríceps",
    "lats": "Dorsal",
    "pectorals": "Peitoral",
    "delts": "Deltoides",
    "glutes": "Glúteos",
    "hamstrings": "Posterior de Coxa",
    "quads": "Quadríceps",
    "calves": "Panturrilha",
    "forearms": "Antebraço",
    "adductors": "Adutores",
    "abductors": "Abdutores",
    "traps": "Trapézio",
    "cardiovascular system": "Cardiovascular",
    "spine": "Lombar/Eretores da Espinha",
    "serratus anterior": "Serrátil",
    "upper back": "Costas Superior",
    "levator scapulae": "Elevador da Escápula"
}

# Mapeamento léxico de termos comuns em nomes de exercícios
EXERCISE_TERMS = {
    "bench press": "Supino",
    "incline bench press": "Supino Inclinado",
    "decline bench press": "Supino Declinado",
    "lateral raise": "Elevação Lateral",
    "front raise": "Elevação Frontal",
    "bicep curl": "Rosca Bíceps",
    "tricep extension": "Extensão de Tríceps",
    "tricep kickback": "Tríceps Coice",
    "pushdown": "Tríceps Pulley",
    "skull crusher": "Tríceps Testa",
    "squat": "Agachamento",
    "deadlift": "Levantamento Terra",
    "leg press": "Leg Press",
    "leg extension": "Cadeira Extensora",
    "leg curl": "Mesa Flexora",
    "lat pulldown": "Puxada Dorsal",
    "cable row": "Remada no Cabo",
    "dumbbell row": "Remada com Halter",
    "barbell row": "Remada com Barra",
    "shrug": "Encolhimento",
    "push-up": "Flexão de Braço",
    "pull-up": "Barra Fixa",
    "chin-up": "Barra Fixa Supinada",
    "dip": "Mergulho nas Paralelas",
    "crunch": "Abdominal Crunch",
    "sit-up": "Abdominal",
    "plank": "Prancha",
    "lunges": "Avanço/Passada",
    "lunge": "Avanço/Passada",
    "wrist curl": "Rosca Punho",
    "calf raise": "Elevação de Panturrilha",
    "fly": "Crucifixo",
    "pullover": "Pullover",
    "press": "Prensa/Desenvolvimento"
}

def translate_via_google(text, source_lang="en", target_lang="pt"):
    """
    Traduz um texto usando a API não oficial gratuita do Google Translate.
    Usa urllib para não requerer dependências externas.
    """
    if not text or text.strip() == "":
        return text
    
    try:
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={urllib.parse.quote(text)}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            translated_text = "".join([part[0] for part in data[0] if part[0]])
            return translated_text
    except Exception as e:
        print(f"Erro ao traduzir '{text[:30]}...': {e}")
        return text # Fallback para o original em inglês se falhar

def translate_name(name):
    """
    Traduz nomes de exercícios combinando jargão da musculação e regras.
    """
    name_lower = name.lower()
    
    # 1. Tentar substituição direta dos termos principais
    translated = None
    for en_term, pt_term in EXERCISE_TERMS.items():
        if en_term in name_lower:
            # Substitui o termo e trata o resto do nome
            parts = name_lower.split(en_term)
            prefix = parts[0].strip()
            suffix = parts[1].strip()
            
            # Reconhece equipamentos no prefixo ou sufixo
            eq_suffix = ""
            if "dumbbell" in prefix or "dumbbell" in suffix:
                eq_suffix = " com Halter"
            elif "barbell" in prefix or "barbell" in suffix:
                eq_suffix = " com Barra"
            elif "cable" in prefix or "cable" in suffix:
                eq_suffix = " no Cabo"
            elif "smith" in prefix or "smith" in suffix:
                eq_suffix = " no Smith"
            elif "machine" in prefix or "machine" in suffix:
                eq_suffix = " na Máquina"
            elif "band" in prefix or "band" in suffix:
                eq_suffix = " com Elástico"
            
            # Se for incline/decline
            mod_prefix = ""
            if "incline" in prefix or "incline" in suffix:
                mod_prefix = " Inclinado"
            elif "decline" in prefix or "decline" in suffix:
                mod_prefix = " Declinado"
            elif "seated" in prefix or "seated" in suffix:
                mod_prefix = " Sentado"
            elif "standing" in prefix or "standing" in suffix:
                mod_prefix = " Em Pé"
            elif "lying" in prefix or "lying" in suffix:
                mod_prefix = " Deitado"
            elif "one arm" in prefix or "one arm" in suffix or "single arm" in prefix:
                mod_prefix = " Unilateral"
                
            translated = f"{pt_term}{mod_prefix}{eq_suffix}"
            break
            
    if not translated:
        # Se não cair em nenhuma regra, faz uma tradução rápida via Google Translate
        # e capitaliza cada palavra.
        translated = translate_via_google(name).title()
    else:
        # Garante a capitalização correta
        translated = translated.strip().title()
        
    return translated

def process_dataset():
    print(f"Lendo dataset de entrada: {INPUT_FILE}")
    if not os.path.exists(INPUT_FILE):
        print(f"Erro: Arquivo {INPUT_FILE} não existe!")
        return
        
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        exercises = json.load(f)
        
    total_exercises = len(exercises)
    print(f"Total de exercícios encontrados: {total_exercises}")
    
    optimized_exercises = []
    
    # Vamos rodar o processamento
    start_time = time.time()
    for idx, ex in enumerate(exercises):
        # Campos básicos
        ex_id = ex.get("id")
        name_en = ex.get("name", "")
        
        # Mapeamento estático imediato
        body_part_en = ex.get("body_part", "").lower()
        body_part_pt = BODY_PART_MAP.get(body_part_en, body_part_en.title())
        
        equipment_en = ex.get("equipment", "").lower()
        equipment_pt = EQUIPMENT_MAP.get(equipment_en, equipment_en.title())
        
        target_en = ex.get("target", "").lower()
        target_pt = TARGET_MAP.get(target_en, target_en.title())
        
        # Mapeia os músculos secundários
        sec_muscles_pt = [TARGET_MAP.get(m.lower(), m.title()) for m in ex.get("secondary_muscles", [])]
        
        # Traduz o nome do exercício
        name_pt = translate_name(name_en)
        
        # Traduz as instruções para PT-BR
        # O espanhol é usado como fallback imediato se a tradução falhar, ou o inglês.
        steps_en = ex.get("instruction_steps", {}).get("en", [])
        steps_es = ex.get("instruction_steps", {}).get("es", [])
        steps_pt = []
        
        # Tenta traduzir cada passo. Para evitar rate limit do google, vamos fazer 
        # tradução apenas se necessário, mas como queremos as instruções traduzidas,
        # vamos concatená-las em um único texto, traduzir e depois separar.
        if steps_en:
            combined_steps = " || ".join(steps_en)
            translated_combined = translate_via_google(combined_steps)
            steps_pt = [step.strip() for step in translated_combined.split("||")]
            
            # Fallback se o split der errado ou a quantidade de passos mudar
            if len(steps_pt) != len(steps_en):
                # Se falhar no parse do split, traduz individualmente
                steps_pt = []
                for step in steps_en:
                    steps_pt.append(translate_via_google(step))
                    time.sleep(0.05)
        else:
            steps_pt = steps_es if steps_es else []
            
        # Objeto otimizado final
        optimized_ex = {
            "id": ex_id,
            "name": name_pt,
            "name_en": name_en.title(),
            "body_part": body_part_pt,
            "equipment": equipment_pt,
            "target": target_pt,
            "secondary_muscles": sec_muscles_pt,
            "media_id": ex.get("media_id"),
            "instruction_steps": steps_pt,
            "instruction_steps_en": steps_en
        }
        
        optimized_exercises.append(optimized_ex)
        
        # Log de progresso a cada 50 exercícios
        if (idx + 1) % 50 == 0 or idx + 1 == total_exercises:
            elapsed = time.time() - start_time
            avg_time = elapsed / (idx + 1)
            eta = avg_time * (total_exercises - (idx + 1))
            print(f"Progresso: {idx + 1}/{total_exercises} ({(idx + 1)/total_exercises*100:.1f}%) | Tempo decorrido: {elapsed:.1f}s | ETA: {eta:.1f}s")
            
            # Pequena pausa para evitar bloqueio do Google Translate
            time.sleep(0.5)

    # Escreve o JSON final otimizado
    print(f"Escrevendo arquivo otimizado em: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(optimized_exercises, f, ensure_ascii=False, indent=2)
        
    print(f"Processamento concluído com sucesso!")
    print(f"Tamanho do arquivo original: {os.path.getsize(INPUT_FILE) / 1024 / 1024:.2f} MB")
    print(f"Tamanho do arquivo final: {os.path.getsize(OUTPUT_FILE) / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    process_dataset()
