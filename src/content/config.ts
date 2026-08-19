import { defineCollection, z } from "astro:content";

const portfolio = defineCollection({
  type: "data",
  schema: z.object({
    title: z.string(),
    issueNumber: z.number().optional(),
    date: z.string(), // DD/MM/YYYY
    role: z.string(),
    coCredit: z.string().optional(),
    coCreditLink: z.string().url().optional(),
    contentLink: z.string().url().optional(),
    imageFolderLocation: z.string(), // e.g. "portfolio/nightfall-issue-1"
    ranking: z.number().int().min(1),
  }),
});

export const collections = { portfolio };
