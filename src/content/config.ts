import { defineCollection } from "astro:content";
import { portfolioSchema } from "../../scripts/portfolio-schema";

const portfolio = defineCollection({
  type: "data",
  schema: portfolioSchema,
});

export const collections = { portfolio };
