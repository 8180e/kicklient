import z from "zod";
import { parseSchema } from "../utils.js";
import { KickAPIClient } from "../api-client.js";

const CategoriesSchema = z.array(
  z.object({ id: z.number(), name: z.string(), thumbnail: z.string() })
);

const CategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  tags: z.array(z.string()),
  thumbnail: z.string(),
  viewerCount: z.number(),
});

export class CategoriesAPI extends KickAPIClient {
  async getCategories(q: string, page?: number) {
    const params = new URLSearchParams({ q });
    if (page) {
      params.append("page", page.toString());
    }
    return parseSchema(
      CategoriesSchema,
      await this.get(`/categories?${params}`)
    );
  }

  async getCategoryById(categoryId: number) {
    return parseSchema(
      CategorySchema,
      await this.get(`/categories/${categoryId}`)
    );
  }
}
