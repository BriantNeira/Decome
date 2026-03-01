import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock document.documentElement.setAttribute
const setAttributeMock = jest.fn();
Object.defineProperty(document.documentElement, "setAttribute", {
  value: setAttributeMock,
  writable: true,
});

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorageMock.clear();
    setAttributeMock.mockClear();
  });

  it("renders a button with aria-label", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows moon icon in day mode", () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-label", expect.stringContaining("night"));
  });
});
