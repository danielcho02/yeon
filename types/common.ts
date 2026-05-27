export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type SortDirection = "asc" | "desc";
