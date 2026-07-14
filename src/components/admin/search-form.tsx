import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Plain GET search form (no client JS). Submitting reloads the page with
 * `?search=...`, resetting to page 1. Extra filters render as children.
 */
export function SearchForm({
  action,
  defaultValue,
  placeholder = "جستجو…",
  children,
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      <Input
        name="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-9 w-56"
      />
      {children}
      <Button type="submit" size="sm" variant="outline">
        اعمال
      </Button>
    </form>
  );
}
