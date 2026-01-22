import { defineCollection, z } from 'astro:content';

const transcriptsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().optional(),
    contributors: z.array(z.string()).optional(),
  }),
});

export const collections = {
  'transcripts': transcriptsCollection,
};
