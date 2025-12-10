import z from "zod";
import type { AppClientOptions, UserClientOptions } from "../client.js";
import { createResponseSchema, formatData } from "../utils.js";

const CategoriesSchema = createResponseSchema(
  z.array(z.object({ id: z.number(), name: z.string(), thumbnail: z.string() }))
);

const CategorySchema = createResponseSchema(
  z.object({
    id: z.number(),
    name: z.string(),
    tags: z.array(z.string()),
    thumbnail: z.string(),
    viewer_count: z.number(),
  })
);

export class CategoriesAPI {
  constructor(private readonly options: AppClientOptions | UserClientOptions) {}

  async getCategories(q: string, page?: number) {
    const params = new URLSearchParams({ q });
    if (page) {
      params.append("page", page.toString());
    }
    const res = await fetch(
      `https://api.kick.com/public/v1/categories?${params}`,
      { headers: { Authorization: `Bearer ${this.options.accessToken}` } }
    );
    return formatData(CategoriesSchema, await res.json()).data;
  }

  async getCategoryById(categoryId: number) {
    const res = await fetch(
      `https://api.kick.com/public/v1/categories/${categoryId}`,
      { headers: { Authorization: `Bearer ${this.options.accessToken}` } }
    );
    return formatData(CategorySchema, await res.json()).data;
  }
}
