import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function AppPagination({
  currentPage,
  totalPages,
  onPageChange,
}: AppPaginationProps) {
  if (totalPages <= 1) return null;

  const createPages = () => {
    const pages: (number | "...")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="mt-12 flex items-center justify-center">

      {/* Desktop */}

      <div className="hidden sm:flex items-center mb-5 gap-2">

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="
            rounded-full
            px-4
            h-10
          "
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center gap-2">

          {createPages().map((page, index) =>
            page === "..." ? (
              <span
                key={index}
                className="px-2 text-muted-foreground"
              >
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={
                  page === currentPage
                    ? "default"
                    : "ghost"
                }
                onClick={() => onPageChange(page)}
                className={`
                  h-10
                  w-10
                  rounded-full
                  transition-all

                  ${
                    page === currentPage
                      ? "bg-primary text-black hover:bg-primary"
                      : "hover:bg-primary/10"
                  }
                `}
              >
                {page}
              </Button>
            )
          )}

        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="
            rounded-full
            px-4
            h-10
          "
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>

      </div>

      {/* Mobile */}

      <div className="flex sm:hidden items-center mb-3 gap-5">

        <Button
          variant="outline"
          size="icon"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="rounded-full"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <span
          className="
            text-sm
            font-medium
            min-w-[70px]
            text-center
          "
        >
          {currentPage} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="icon"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="rounded-full"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

      </div>

    </div>
  );
}