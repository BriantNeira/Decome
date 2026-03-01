import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock auth lib
jest.mock("@/lib/auth", () => ({
  login: jest.fn(),
  storeToken: jest.fn(),
}));

import { login, storeToken } from "@/lib/auth";
const mockLogin = login as jest.Mock;
const mockStoreToken = storeToken as jest.Mock;

describe("LoginPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockLogin.mockClear();
    mockStoreToken.mockClear();
    // stub document.cookie setter
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  it("renders email, password inputs and submit button", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows error message on failed login", async () => {
    mockLogin.mockRejectedValue({
      response: { data: { detail: "Invalid email or password." } },
    });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "bad@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "wrongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to /dashboard on successful login (no 2FA)", async () => {
    mockLogin.mockResolvedValue({ access_token: "tok123", requires_2fa: false });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@decome.app" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Admin123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockStoreToken).toHaveBeenCalledWith("tok123");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to /login/2fa when 2FA is required", async () => {
    mockLogin.mockResolvedValue({ requires_2fa: true, temp_token: "tmp_abc" });
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "admin@decome.app" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "Admin123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login/2fa");
    });
  });
});
