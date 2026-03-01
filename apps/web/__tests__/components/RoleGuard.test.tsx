import { render, screen } from "@testing-library/react";
import { RoleGuard } from "@/components/layout/RoleGuard";

// Mock useAuth hook
jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/hooks/useAuth";
const mockUseAuth = useAuth as jest.Mock;

describe("RoleGuard", () => {
  it("renders children when user has allowed role", () => {
    mockUseAuth.mockReturnValue({ user: { role: "admin" }, loading: false });
    render(
      <RoleGuard allowedRoles={["admin"]}>
        <p>Admin content</p>
      </RoleGuard>
    );
    expect(screen.getByText("Admin content")).toBeInTheDocument();
  });

  it("renders fallback when user lacks role", () => {
    mockUseAuth.mockReturnValue({ user: { role: "bdm" }, loading: false });
    render(
      <RoleGuard allowedRoles={["admin"]} fallback={<p>Access denied</p>}>
        <p>Admin content</p>
      </RoleGuard>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("Admin content")).not.toBeInTheDocument();
  });

  it("renders nothing (no fallback) when user lacks role and no fallback", () => {
    mockUseAuth.mockReturnValue({ user: { role: "bdm" }, loading: false });
    const { container } = render(
      <RoleGuard allowedRoles={["admin"]}>
        <p>Admin content</p>
      </RoleGuard>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    const { container } = render(
      <RoleGuard allowedRoles={["admin"]}>
        <p>Admin content</p>
      </RoleGuard>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
