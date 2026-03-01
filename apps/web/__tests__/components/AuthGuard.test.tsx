import { render, screen } from "@testing-library/react";
import { AuthGuard } from "@/components/layout/AuthGuard";

// Mock next/navigation
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// Mock useAuth hook
jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
const mockUseAuth = useAuth as jest.Mock;

describe("AuthGuard", () => {
  beforeEach(() => {
    mockReplace.mockClear();
  });

  it("shows spinner while loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    const { container } = render(<AuthGuard><p>Protected</p></AuthGuard>);
    // Should render the spinner div, not children
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(<AuthGuard><p>Protected</p></AuthGuard>);
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "1", email: "a@b.com", role: "admin", full_name: "Admin", is_active: true, totp_enabled: false },
      loading: false,
    });
    render(<AuthGuard><p>Protected content</p></AuthGuard>);
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
