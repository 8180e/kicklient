import z from "zod";
import { KickAPIClient } from "../api-client.js";

interface GetCategoriesOptions {
  limit?: number;
}

interface GetCategoriesParams extends GetCategoriesOptions {
  names?: string[];
  tags?: string[];
}

interface GetCategoriesByIdsParams extends GetCategoriesOptions {
  ids: number[];
}

const CategoriesSchema = z.array(
  z.object({ id: z.number(), name: z.string(), thumbnail: z.string() }),
);

export class CategoriesAPI extends KickAPIClient {
  private getCategoriesData(params: URLSearchParams, limit?: number) {
    if (limit) params.set("limit", limit.toString());
    return this.getPaginatedData("/v2/categories", params, CategoriesSchema);
  }

  getCategories({ names = [], tags = [], limit }: GetCategoriesParams) {
    const params = new URLSearchParams();
    for (const name of names) params.append("name", name);
    for (const tag of tags) params.append("tag", tag);
    return this.getCategoriesData(params, limit);
  }

  getCategoriesByIds({ ids, limit }: GetCategoriesByIdsParams) {
    const params = new URLSearchParams();
    for (const id of ids) params.append("id", id.toString());
    return this.getCategoriesData(params, limit);
  }
}
