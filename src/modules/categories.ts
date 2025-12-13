import z from "zod";
import { KickAPIClient } from "../api-client.js";

const CategoriesSchema = z.array(
  z.object({ id: z.number(), name: z.string(), thumbnail: z.string() })
);

const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  tags: z.array(z.string()),
  thumbnail: z.string(),
  viewer_count: z.number(),
});

export class CategoriesAPI extends KickAPIClient {
  getCategories(q: string, page?: number) {
    const params = new URLSearchParams({ q });
    if (page) {
      params.append("page", page.toString());
    }
    return this.get(`/categories?${params}`, CategoriesSchema);
  }

  getCategoryById(categoryId: number) {
    return this.get(`/categories/${categoryId}`, CategorySchema);
  }
}
