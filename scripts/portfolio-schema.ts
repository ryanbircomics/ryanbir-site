import { z } from "zod";

export const CATEGORIES = [
  { slug: "pencils-inks", label: "Pencils & Inks" },
  { slug: "colors", label: "Colors" },
  { slug: "illustrations", label: "Illustrations" },
] as const;

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

export const portfolioSchema = z.object({
  title: z.string().min(1),
  issueNumber: z.coerce.number().int().optional(),
  date: z.string().min(1), // DD/MM/YYYY
  category: z.enum(CATEGORY_SLUGS),
  role: z.string().min(1),
  coCredit: z.string().optional(),
  coCreditLink: z.string().url().optional(),
  contentLink: z.string().url().optional(),
  imageFolderLocation: z.string(),
  ranking: z.coerce.number().int().min(1),
  hidden: z.boolean().default(false),
});

// What a project owner provides by hand — imageFolderLocation and ranking are
// derived/auto-assigned by the add-project script, not typed in by hand.
export const sourceSchema = portfolioSchema
  .omit({ imageFolderLocation: true, ranking: true })
  .extend({ ranking: z.coerce.number().int().min(1).optional() });

export function slugify(title: string, issueNumber?: number): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return issueNumber ? `${base}-${issueNumber}` : base;
}

const CATEGORY_ALIASES: Record<string, string> = {
  colour: "colors",
  colours: "colors",
};

export function normalizeCategory(input: string | undefined | null): string | null {
  if (!input) return null;
  const cleaned = input.trim().toLowerCase();
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const squashed = squash(cleaned);

  for (const cat of CATEGORIES) {
    if (cleaned === cat.slug || squashed === squash(cat.label)) return cat.slug;
  }
  return CATEGORY_ALIASES[squashed] ?? null;
}
