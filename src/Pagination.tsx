import { useEffect, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronLeft, ChevronRight } from "lucide-react";

export const PAGE_SIZE = 10;
export type SortDirection = "asc" | "desc";
export type SortOption = { value: string; label: string };

export function sortItems<T>(
  items: T[],
  getValue: (item: T) => string | number | null | undefined,
  direction: SortDirection,
): T[] {
  const directionMultiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    const leftValue = getValue(left);
    const rightValue = getValue(right);
    if (leftValue == null) return rightValue == null ? 0 : 1;
    if (rightValue == null) return -1;
    const comparison =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), undefined, {
            numeric: true,
            sensitivity: "base",
          });
    return comparison * directionMultiplier;
  });
}

export function SortControls({
  value,
  options,
  direction,
  onChange,
  onToggleDirection,
}: {
  value: string;
  options: SortOption[];
  direction: SortDirection;
  onChange: (value: string) => void;
  onToggleDirection: () => void;
}) {
  const DirectionIcon = direction === "asc" ? ArrowDownAZ : ArrowUpAZ;
  return (
    <>
      <label className="filter-select">
        <span className="sr-only">Sort table by</span>
        <select
          aria-label="Sort table by"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button button-secondary sort-direction-button"
        aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}
        onClick={onToggleDirection}
      >
        <DirectionIcon size={15} />
        {direction === "asc" ? "Ascending" : "Descending"}
      </button>
    </>
  );
}

export function usePagination<T>(
  items: T[],
  resetKey: string,
  pageSize = PAGE_SIZE,
) {
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [resetKey]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page: currentPage,
    pageCount,
    total: items.length,
    start: items.length ? startIndex + 1 : 0,
    end: Math.min(startIndex + pageSize, items.length),
    setPage,
  };
}

export function PaginationControls({
  page,
  pageCount,
  total,
  start,
  end,
  setPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  setPage: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;

  return (
    <nav className="pagination-controls" aria-label="List pages">
      <span>Showing {start}–{end} of {total}</span>
      <div>
        <button
          type="button"
          className="button button-secondary"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span aria-live="polite">Page {page} of {pageCount}</span>
        <button
          type="button"
          className="button button-secondary"
          aria-label="Next page"
          disabled={page === pageCount}
          onClick={() => setPage(page + 1)}
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </nav>
  );
}
