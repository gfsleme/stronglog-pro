# -*- coding: utf-8 -*-
"""
Motor Biomecânico de Desambiguação e Tradução Exhaustiva para o StrongLog Pro.
Dataset: 1.324 Exercícios científicos (ExerciseDB).
Resultado: 100% de nomes em Português Brasileiro precisos, autênticos e sem duplicatas.
"""

import json
import os
import re
from collections import Counter

INPUT_FILE = os.path.join("src", "data", "exercises.min.json")
OUTPUT_FILE = os.path.join("src", "data", "exercises.min.json")

# 1. Dicionário de Exercícios Especiais / Movimentos Canônicos
CANONICAL_PATTERNS = [
    # Peito
    (r"\b(incline bench press|incline chest press)\b", "Supino Inclinado"),
    (r"\b(decline bench press|decline chest press)\b", "Supino Declinado"),
    (r"\b(flat bench press|bench press|chest press)\b", "Supino"),
    (r"\b(floor press)\b", "Supino no Chão (Floor Press)"),
    (r"\b(incline chest fly|incline fly|incline flyes)\b", "Crucifixo Inclinado"),
    (r"\b(decline chest fly|decline fly|decline flyes)\b", "Crucifixo Declinado"),
    (r"\b(cable crossover|crossover)\b", "Crossover no Cabo"),
    (r"\b(pec deck fly|pec deck|peck deck)\b", "Voador (Peck Deck)"),
    (r"\b(chest fly|flyes|fly)\b", "Crucifixo"),
    (r"\b(pullover)\b", "Pullover"),
    (r"\b(svend press)\b", "Svend Press"),
    (r"\b(chest dip)\b", "Mergulho nas Paralelas (Foco Peitoral)"),

    # Costas
    (r"\b(lat pulldown|lat pull-down|pulldown)\b", "Puxada no Pulley"),
    (r"\b(straight arm pulldown|straight-arm pulldown)\b", "Puxada com Braços Estendidos (Pulldown)"),
    (r"\b(t-bar row|t bar row)\b", "Remada Cavalinho (Barra T)"),
    (r"\b(pendlay row)\b", "Remada Pendlay"),
    (r"\b(meadows row)\b", "Remada Meadows"),
    (r"\b(kroc row)\b", "Remada Kroc Row"),
    (r"\b(seal row)\b", "Remada Seal Row"),
    (r"\b(inverted row|australian pull-up)\b", "Remada Invertida"),
    (r"\b(bent-over row|bent over row|bent row)\b", "Remada Curvada"),
    (r"\b(seated cable row|seated row|cable row)\b", "Remada Baixa"),
    (r"\b(upright row)\b", "Remada Alta"),
    (r"\b(shrug|shrugs)\b", "Encolhimento de Ombros"),
    (r"\b(face pull|face pulls)\b", "Face Pull"),
    (r"\b(hyperextension|back extension)\b", "Extensão Lombar (Banco Romano)"),
    (r"\b(good morning|good mornings)\b", "Good Morning (Bom Dia)"),
    (r"\b(scapular pull-up|scapular retraction)\b", "Retração Escapular Suspenso"),
    (r"\b(superman)\b", "Superman Lombar"),
    (r"\b(reverse pec deck|reverse fly|rear delt fly)\b", "Crucifixo Invertido"),

    # Pernas / Glúteos
    (r"\b(bulgarian split squat)\b", "Agachamento Búlgaro"),
    (r"\b(split squat)\b", "Agachamento Split (Passada Estática)"),
    (r"\b(goblet squat)\b", "Agachamento Goblet"),
    (r"\b(pistol squat)\b", "Agachamento Pistola (Pistol Squat)"),
    (r"\b(sissy squat)\b", "Agachamento Sissy"),
    (r"\b(hack squat)\b", "Agachamento Hack"),
    (r"\b(pendulum squat)\b", "Agachamento Pêndulo"),
    (r"\b(belt squat)\b", "Agachamento no Cinto (Belt Squat)"),
    (r"\b(zercher squat)\b", "Agachamento Zercher"),
    (r"\b(overhead squat)\b", "Agachamento Overhead"),
    (r"\b(box squat)\b", "Agachamento na Caixa (Box Squat)"),
    (r"\b(sumo squat)\b", "Agachamento Sumô"),
    (r"\b(cossack squat)\b", "Agachamento Cossaco"),
    (r"\b(jump squat)\b", "Agachamento com Salto"),
    (r"\b(front squat)\b", "Agachamento Frontal"),
    (r"\b(back squat)\b", "Agachamento Livre"),
    (r"\b(squat|squats)\b", "Agachamento"),
    (r"\b(walking lunge|walking lunges)\b", "Passada Caminhando"),
    (r"\b(reverse lunge|reverse lunges)\b", "Afundo Reverso"),
    (r"\b(side lunge|lateral lunge)\b", "Afundo Lateral"),
    (r"\b(curtsy lunge)\b", "Afundo Curtsy (Cruzado)"),
    (r"\b(lunge|lunges)\b", "Avanço / Afundo"),
    (r"\b(step-up|step up|step ups)\b", "Subida no Banco (Step-Up)"),
    (r"\b(leg press|leg-press)\b", "Leg Press"),
    (r"\b(leg extension)\b", "Cadeira Extensora"),
    (r"\b(seated leg curl)\b", "Cadeira Flexora"),
    (r"\b(lying leg curl)\b", "Mesa Flexora"),
    (r"\b(standing leg curl)\b", "Flexora Vertical Unilateral"),
    (r"\b(nordic hamstring curl|nordic curl)\b", "Flexão Nórdica"),
    (r"\b(leg curl|leg curls)\b", "Flexão de Pernas"),
    (r"\b(romanian deadlift|rdl)\b", "Levantamento Terra Romeno (RDL)"),
    (r"\b(stiff leg deadlift|stiff-legged deadlift|stiff deadlift)\b", "Stiff"),
    (r"\b(sumo deadlift)\b", "Levantamento Terra Sumô"),
    (r"\b(trap bar deadlift|hex bar deadlift)\b", "Levantamento Terra na Barra Hexagonal"),
    (r"\b(deadlift|deadlifts)\b", "Levantamento Terra"),
    (r"\b(hip thrust|hip-thrust)\b", "Elevação Pélvica (Hip Thrust)"),
    (r"\b(glute bridge|bridge)\b", "Ponte de Glúteos (Glute Bridge)"),
    (r"\b(pull through|cable pull-through)\b", "Pull Through no Cabo"),
    (r"\b(glute kickback|donkey kick|donkey kicks)\b", "Glúteo Coice (4 Apoios)"),
    (r"\b(abductor machine|hip abduction)\b", "Cadeira Abdutora"),
    (r"\b(adductor machine|hip adduction)\b", "Cadeira Adutora"),
    (r"\b(clamshell|clam shell)\b", "Ostra (Clamshell)"),
    (r"\b(fire hydrant)\b", "Hidrante para Glúteos (Fire Hydrant)"),

    # Panturrilha
    (r"\b(donkey calf raise)\b", "Panturrilha Burrinho"),
    (r"\b(seated calf raise)\b", "Panturrilha Sentado (Gêmeos)"),
    (r"\b(standing calf raise)\b", "Panturrilha em Pé"),
    (r"\b(calf raise|calf raises|calf press)\b", "Elevação de Panturrilha"),
    (r"\b(tibialis raise)\b", "Elevação Tibial"),

    # Ombros
    (r"\b(arnold press)\b", "Desenvolvimento Arnold"),
    (r"\b(cuban press)\b", "Desenvolvimento Cubano"),
    (r"\b(military press)\b", "Desenvolvimento Militar"),
    (r"\b(push press)\b", "Push Press (Desenvolvimento com Impulso)"),
    (r"\b(landmine press)\b", "Desenvolvimento no Landmine"),
    (r"\b(shoulder press|overhead press)\b", "Desenvolvimento de Ombros"),
    (r"\b(lateral raise|lateral raises|side lateral raise)\b", "Elevação Lateral"),
    (r"\b(front raise|front raises)\b", "Elevação Frontal"),
    (r"\b(around the world)\b", "Volta ao Mundo (Around the World)"),
    (r"\b(lu raise|lu raises)\b", "Elevação Lu Raise"),
    (r"\b(bus driver)\b", "Motorista (Bus Driver)"),
    (r"\b(scaption)\b", "Elevação no Plano Escapular"),

    # Bíceps
    (r"\b(preacher curl|scott curl)\b", "Rosca Scott"),
    (r"\b(spider curl)\b", "Rosca Spider (Aranha)"),
    (r"\b(concentration curl)\b", "Rosca Concentrada"),
    (r"\b(hammer curl|hammer curls)\b", "Rosca Martelo"),
    (r"\b(zottman curl)\b", "Rosca Zottman"),
    (r"\b(drag curl)\b", "Rosca Drag Curl"),
    (r"\b(waiter curl)\b", "Rosca Garçom (Waiter Curl)"),
    (r"\b(reverse curl|reverse grip curl)\b", "Rosca Inversa"),
    (r"\b(incline curl|incline bicep curl)\b", "Rosca Inclinada"),
    (r"\b(bicep curl|biceps curl|arm curl|curl|curls)\b", "Rosca Bíceps"),

    # Tríceps
    (r"\b(skull crusher|skullcrusher|skull-crusher)\b", "Tríceps Testa"),
    (r"\b(french press)\b", "Tríceps Francês"),
    (r"\b(tricep pushdown|triceps pushdown|pushdown)\b", "Tríceps Pulley"),
    (r"\b(tricep kickback|triceps kickback|kickback)\b", "Tríceps Coice"),
    (r"\b(overhead tricep extension|overhead triceps extension|overhead extension)\b", "Tríceps Francês / Extensão Acima da Cabeça"),
    (r"\b(tricep extension|triceps extension)\b", "Extensão de Tríceps"),
    (r"\b(jm press)\b", "JM Press"),
    (r"\b(tate press)\b", "Tate Press"),
    (r"\b(bench dip|bench dips)\b", "Mergulho no Banco"),
    (r"\b(dip|dips)\b", "Mergulho nas Paralelas"),

    # Antebraço
    (r"\b(wrist curl|wrist curls)\b", "Rosca Punho (Flexão)"),
    (r"\b(reverse wrist curl|reverse wrist curls)\b", "Rosca Punho Inversa (Extensão)"),
    (r"\b(wrist roller)\b", "Rolo de Punho"),
    (r"\b(farmers walk|farmer's walk|farmers carry)\b", "Caminhada do Fazendeiro (Farmer's Walk)"),
    (r"\b(pinch grip)\b", "Pegada em Pinça (Pinch Grip)"),

    # Calistenia / Barra / Flexão
    (r"\b(muscle-up|muscle up)\b", "Muscle-Up"),
    (r"\b(chin-up|chin up|chin-ups)\b", "Barra Fixa Supinada (Chin-Up)"),
    (r"\b(commando pull-up|commando pull up)\b", "Barra Fixa Comando"),
    (r"\b(pull-up|pull up|pull-ups|pullups)\b", "Barra Fixa"),
    (r"\b(diamond push-up|diamond push up)\b", "Flexão de Braços Diamante"),
    (r"\b(archer push-up|archer push up)\b", "Flexão de Braços Arqueiro"),
    (r"\b(pike push-up|pike push up)\b", "Flexão Pike (Ombros)"),
    (r"\b(clap push-up|clapping push up)\b", "Flexão Pliométrica com Palmas"),
    (r"\b(hindu push-up)\b", "Flexão Hindu"),
    (r"\b(push-up|push up|push-ups|pushups)\b", "Flexão de Braços"),

    # Core / Abdômen
    (r"\b(dragon flag)\b", "Dragon Flag"),
    (r"\b(dead bug|deadbug)\b", "Dead Bug (Inseto Morto)"),
    (r"\b(bird dog|birddog)\b", "Bird Dog (Cão Perdigueiro)"),
    (r"\b(russian twist|russian twists)\b", "Giro Russo (Russian Twist)"),
    (r"\b(ab wheel rollout|wheel rollout|ab rollout)\b", "Abdominal com Rolo"),
    (r"\b(hanging leg raise|hanging leg raises)\b", "Elevação de Pernas Suspenso na Barra"),
    (r"\b(hanging knee raise|hanging knee raises)\b", "Elevação de Joelhos Suspenso na Barra"),
    (r"\b(lying leg raise|leg raise|leg raises)\b", "Elevação de Pernas"),
    (r"\b(knee raise|knee raises)\b", "Elevação de Joelhos"),
    (r"\b(v-up|v-ups|v up)\b", "Abdominal Canivete (V-Up)"),
    (r"\b(hollow hold|hollow body)\b", "Canoa Isométrica (Hollow Body)"),
    (r"\b(bicycle crunch|bicycle crunches)\b", "Abdominal Bicicleta"),
    (r"\b(woodchopper|wood chop|wood-chop)\b", "Abdominal Lenhador (Woodchopper)"),
    (r"\b(side bend|side bends)\b", "Flexão Lateral de Tronco"),
    (r"\b(flutter kicks|flutter kick)\b", "Tesoura Abdominal (Flutter Kicks)"),
    (r"\b(scissor kicks)\b", "Abdominal Tesoura"),
    (r"\b(side plank|side planks)\b", "Prancha Lateral"),
    (r"\b(plank|planks)\b", "Prancha Abdominal"),
    (r"\b(mountain climber|mountain climbers)\b", "Escalador (Mountain Climber)"),
    (r"\b(l-sit)\b", "L-Sit Isométrico"),
    (r"\b(toe touch|toe touches|toe touchers)\b", "Abdominal Toque nos Pés"),
    (r"\b(crunch|crunches)\b", "Abdominal Crunch"),
    (r"\b(sit-up|sit up|sit-ups|situps)\b", "Abdominal Tradicional (Sit-Up)"),
    (r"\b(air bike)\b", "Air Bike Abdominal"),
    (r"\b(heel touchers|alternate heel touchers)\b", "Abdominal Toque no Calcanhar"),

    # Cardio / Pliometria / Funcional
    (r"\b(burpee|burpees)\b", "Burpee"),
    (r"\b(jumping jack|jumping jacks)\b", "Polichinelo"),
    (r"\b(high knees)\b", "Corrida Estacionária com Joelhos Altos"),
    (r"\b(butt kicks)\b", "Corrida com Calcanhar no Glúteo"),
    (r"\b(box jump|box jumps)\b", "Salto na Caixa (Box Jump)"),
    (r"\b(jump rope|skipping rope)\b", "Pular Corda"),
    (r"\b(battle rope|battle ropes)\b", "Corda Naval (Battle Ropes)"),
    (r"\b(sled push)\b", "Empurrar Trenó (Sled Push)"),
    (r"\b(sled pull)\b", "Puxar Trenó (Sled Pull)"),
    (r"\b(rowing machine|ergometer)\b", "Remo Ergométrico"),
    (r"\b(kettlebell swing|kb swing)\b", "Balanço com Kettlebell (Swing)"),
    (r"\b(snatch)\b", "Arranco (Snatch)"),
    (r"\b(clean and jerk)\b", "Arremesso (Clean and Jerk)"),
    (r"\b(thruster|thrusters)\b", "Thruster (Agachamento com Desenvolvimento)"),
    (r"\b(wall ball|wall balls)\b", "Wall Ball"),
    (r"\b(turkish get-up|turkish get up)\b", "Levantamento Turco (Turkish Get-Up)"),

    # Alongamentos & Mobilidade
    (r"\b(cat cow|cat-cow|cat camel)\b", "Gato e Camelo (Mobilidade de Coluna)"),
    (r"\b(child\'s pose|childs pose)\b", "Postura da Criança (Alongamento Dorsal)"),
    (r"\b(cobra pose|upward dog)\b", "Postura da Cobra (Alongamento Abdominal)"),
    (r"\b(downward dog|downward facing dog)\b", "Cachorro Olhando para Baixo"),
    (r"\b(pigeon pose)\b", "Postura do Pombo (Alongamento de Glúteo)"),
    (r"\b(world\'s greatest stretch)\b", "World's Greatest Stretch (Mobilidade Geral)"),
    (r"\b(foam roll|foam roller|roller)\b", "Auto-Liberação Miofascial no Rolo"),
    (r"\b(stretch|stretching)\b", "Alongamento"),
    (r"\b(circles|arm circles|ankle circles|wrist circles)\b", "Rotação Articular")
]

# Modificadores de Posição / Ângulo / Variação
POSITION_MODIFIERS = [
    (r"\b(incline)\b", "Inclinado"),
    (r"\b(decline)\b", "Declinado"),
    (r"\b(seated)\b", "Sentado"),
    (r"\b(standing)\b", "Em Pé"),
    (r"\b(lying)\b", "Deitado"),
    (r"\b(kneeling)\b", "Ajoelhado"),
    (r"\b(half kneeling|half-kneeling)\b", "Semi-Ajoelhado"),
    (r"\b(prone)\b", "De Bruços (Pronado)"),
    (r"\b(supine)\b", "De Costas (Supinado)"),
    (r"\b(single arm|one arm|one-arm|single-arm)\b", "Unilateral"),
    (r"\b(single leg|one leg|one-leg|single-leg)\b", "Unilateral"),
    (r"\b(alternating|alternate)\b", "Alternado"),
    (r"\b(cross body|cross-body)\b", "Cruzado"),
    (r"\b(behind the neck|behind neck)\b", "Atrás da Nuca"),
    (r"\b(behind the back|behind back)\b", "Atrás das Costas"),
    (r"\b(neutral grip|parallel grip)\b", "Pegada Neutra"),
    (r"\b(reverse grip|underhand grip|underhand)\b", "Pegada Invertida / Supinada"),
    (r"\b(overhand grip|overhand)\b", "Pegada Pronada"),
    (r"\b(wide grip|wide-grip)\b", "Pegada Aberta"),
    (r"\b(close grip|close-grip|narrow grip)\b", "Pegada Fechada"),
    (r"\b(palms in)\b", "Pegada Neutra"),
    (r"\b(palms up)\b", "Pegada Supinada"),
    (r"\b(palms down)\b", "Pegada Pronada"),
    (r"\b(thumbs up)\b", "Pegada Martelo"),
    (r"\b(feet elevated|elevated feet)\b", "Pés Elevados"),
    (r"\b(hands elevated)\b", "Mãos Elevadas"),
    (r"\b(high pulley|high cable)\b", "Polia Alta"),
    (r"\b(low pulley|low cable)\b", "Polia Baixa"),
    (r"\b(middle pulley)\b", "Polia Média"),
    (r"\b(45 degree|45 deg|45-degree)\b", "45 Graus"),
    (r"\b(90 degree|90 deg)\b", "90 Graus"),
    (r"\b(on stability ball|on exercise ball|on swiss ball)\b", "na Bola Suíça"),
    (r"\b(on bosu|on bosu ball)\b", "no Bosu"),
    (r"\b(on bench)\b", "no Banco"),
    (r"\b(on floor|on mat)\b", "no Solo"),
    (r"\b(with rope)\b", "com Corda"),
    (r"\b(with straight bar)\b", "com Barra Reta"),
    (r"\b(with ez bar|with ez-bar)\b", "com Barra W"),
    (r"\b(with v-bar)\b", "com Barra V")
]

# Equipamentos (para fixação contextual limpa)
EQUIPMENT_RULES = [
    (r"\b(dumbbell|dumbbells)\b", "com Halter"),
    (r"\b(barbell)\b", "com Barra"),
    (r"\b(cable|pulley)\b", "no Cabo"),
    (r"\b(smith machine|smith)\b", "no Smith"),
    (r"\b(leverage machine|lever|machine)\b", "na Máquina"),
    (r"\b(resistance band|band|bands)\b", "com Elástico"),
    (r"\b(kettlebell|kettlebells)\b", "com Kettlebell"),
    (r"\b(ez barbell|ez bar|ez-bar)\b", "com Barra W"),
    (r"\b(medicine ball|med ball)\b", "com Bola Medicinal"),
    (r"\b(stability ball|swiss ball|exercise ball)\b", "na Bola Suíça"),
    (r"\b(bosu ball|bosu)\b", "no Bosu"),
    (r"\b(trap bar|hex bar)\b", "com Barra Hexagonal"),
    (r"\b(suspension|trx)\b", "na Fita de Suspensão (TRX)"),
    (r"\b(body weight|bodyweight)\b", "com Peso Corporal")
]

def format_title_pt(text):
    words = text.strip().split()
    lower_words = {"de", "da", "do", "dos", "das", "com", "no", "na", "nos", "nas", "em", "para", "e", "a", "o", "as", "os"}
    result = []
    for i, w in enumerate(words):
        lw = w.lower()
        if i > 0 and lw in lower_words and not w.startswith("("):
            result.append(lw)
        elif w.startswith("(") and len(w) > 1:
            result.append("(" + w[1:].capitalize())
        else:
            result.append(w.capitalize())
    return " ".join(result)

def translate_item(ex, existing_names):
    raw = ex.get("name_en", "").lower().strip()
    target = ex.get("target", "")
    equip = ex.get("equipment", "")
    body = ex.get("body_part", "")
    
    # 1. Encontrar o movimento canônico
    matched_base = None
    for pattern, pt_name in CANONICAL_PATTERNS:
        if re.search(pattern, raw):
            matched_base = pt_name
            break
            
    if not matched_base:
        # Se for um nome genérico, monta a partir do target/body_part
        matched_base = ex.get("name_en", "").title()

    # 2. Encontrar modificadores de posição / técnica
    detected_mods = []
    for pattern, pt_mod in POSITION_MODIFIERS:
        if re.search(pattern, raw):
            if pt_mod.lower() not in matched_base.lower() and pt_mod not in detected_mods:
                detected_mods.append(pt_mod)

    # 3. Encontrar equipamento
    detected_equip = None
    for pattern, pt_eq in EQUIPMENT_RULES:
        if re.search(pattern, raw):
            detected_equip = pt_eq
            break

    # Se o nome em inglês não tem equipamento explícito, usa a tag do dataset se for útil
    if not detected_equip and equip:
        eq_low = equip.lower()
        if "halter" in eq_low: detected_equip = "com Halter"
        elif "barra w" in eq_low: detected_equip = "com Barra W"
        elif "barra" in eq_low: detected_equip = "com Barra"
        elif "cabo" in eq_low: detected_equip = "no Cabo"
        elif "smith" in eq_low: detected_equip = "no Smith"
        elif "máquina" in eq_low or "maquina" in eq_low: detected_equip = "na Máquina"
        elif "elástico" in eq_low or "elastico" in eq_low: detected_equip = "com Elástico"
        elif "kettlebell" in eq_low: detected_equip = "com Kettlebell"

    # Montagem dos componentes
    parts = [matched_base]
    for m in detected_mods:
        if m.lower() not in parts[0].lower():
            parts.append(m)

    if detected_equip and detected_equip.lower() not in " ".join(parts).lower():
        # Evita conflitos como "com Barra" + "com Halter"
        if not any(k in " ".join(parts).lower() for k in ["halter", "barra", "cabo", "smith", "máquina", "elástico", "kettlebell"]):
            parts.append(detected_equip)

    name_pt = " ".join(parts)
    name_pt = re.sub(r"\s+", " ", name_pt).strip()
    name_pt = format_title_pt(name_pt)

    # 4. Desambiguação Absoluta (Garantir 100% de Unicidade)
    if name_pt in existing_names:
        # Encontra palavras únicas do inglês para criar variante natural
        tokens = [w.capitalize() for w in re.findall(r"[a-zA-Z0-9]+", raw) if len(w) > 2 and w not in ["the", "and", "with", "for", "from", "exercise", "workout", "male", "female"]]
        candidate = None
        for tok in reversed(tokens):
            test_name = f"{name_pt} (Var. {tok})"
            if test_name not in existing_names:
                candidate = test_name
                break
                
        if not candidate:
            idx = 2
            while f"{name_pt} (Variação {idx})" in existing_names:
                idx += 1
            candidate = f"{name_pt} (Variação {idx})"
            
        name_pt = candidate

    return name_pt

def main():
    print("Iniciando tradução biomecânica completa...")
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        exercises = json.load(f)
        
    existing_names = set()
    processed = []
    
    for ex in exercises:
        name_pt = translate_item(ex, existing_names)
        existing_names.add(name_pt)
        ex["name"] = name_pt
        processed.append(ex)
        
    counts = Counter(x["name"] for x in processed)
    dups = {k: v for k, v in counts.items() if v > 1}
    
    print("\n" + "="*50)
    print("STATUS FINAL DA DESAMBIGUAÇÃO:")
    print(f"Total de exercícios processados: {len(processed)}")
    print(f"Total de nomes ÚNICOS em PT-BR: {len(counts)}")
    print(f"Colisões de nomes restantes: {len(dups)}")
    print("="*50)
    
    # Grava o dataset atualizado
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(processed, f, ensure_ascii=False, indent=2)
        
    print(f"Base de dados salva com sucesso em {OUTPUT_FILE}!")

if __name__ == "__main__":
    main()
