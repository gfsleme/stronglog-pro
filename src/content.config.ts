import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import fs from 'node:fs';

// Coleção oficial de 1.324 Exercícios
const exercises = defineCollection({
  loader: file('src/data/exercises.min.json'),
  schema: z.object({
    id: z.string(),
    name: z.string(),
    name_en: z.string().optional(),
    body_part: z.string().optional(),
    equipment: z.string().optional(),
    target: z.string().optional(),
    secondary_muscles: z.array(z.string()).optional(),
    media_id: z.string().optional(),
    instruction_steps: z.array(z.string()).optional(),
    gif_url: z.string().optional(),
  }),
});

// Coleção oficial da Ontologia dos 19 Grupos Musculares
const muscleOntology = defineCollection({
  loader: {
    name: 'muscle-ontology-loader',
    load: async ({ store }) => {
      const raw = fs.readFileSync('src/data/muscle_ontology.json', 'utf-8');
      const json = JSON.parse(raw);
      store.clear();
      for (const [key, group] of Object.entries(json.groups)) {
        store.set({
          id: key,
          data: group as Record<string, unknown>,
        });
      }
    },
  },
  schema: z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    view: z.string(),
    nodes: z.array(z.string()),
    targets: z.array(z.string()),
    recovery_hours: z.number().optional(),
  }),
});

export const collections = { exercises, muscleOntology };
