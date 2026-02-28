// tests/auth-page.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Prevent Firebase initialization in unit tests.
 * Your stack trace shows lib/firebase.ts is executed at import time.
 *
 * We mock both common paths:
 *  - "../lib/firebase"  (relative import)
 *  - "@/lib/firebase"   (tsconfig path alias)
 *
 * Add more vi.mock(...) here if your code imports firebase from another specifier.
 */
vi.mock("../lib/firebase", () => ({
  app: {},
  auth: {},
  ui: {},
}));
vi.mock("@/lib/firebase", () => ({
  app: {},
  auth: {},
  ui: {},
}));

// If you import from a more specific path (example), uncomment and adjust:
// vi.mock("../edocteel/lib/firebase", () => ({ app: {}, auth: {}, ui: {} }));
const pushMock = vi.fn();

// Mock Next.js navigation + Link
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => {
  return {
    default: ({ href, children, ...props }: any) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
});

// Adjust this import path if your tests run from a different cwd.
// With vitest at repo root, this relative path is typically correct:
import { AuthPage } from "@/app/login/page";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  pushMock.mockReset();
});

describe("AuthPage", () => {
  it("Invalid email blocks submit + no auth call", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockResolvedValue(undefined);

    render(<AuthPage onSignIn={onSignIn} redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), "bad");
    await user.type(screen.getByLabelText(/^password$/i), "12345678");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(onSignIn).not.toHaveBeenCalled();
    expect(await screen.findByText(/please enter a valid email/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("Short password blocks submit + no auth call", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockResolvedValue(undefined);

    render(<AuthPage onSignIn={onSignIn} redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "123"); // too short
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(onSignIn).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/password must be at least 8 characters/i)
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("Pending disables submit and prevents double-submit", async () => {
    const user = userEvent.setup();
    const d = deferred<void>();
    const onSignIn = vi.fn().mockImplementation(() => d.promise);

    render(<AuthPage onSignIn={onSignIn} redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "12345678");

    const submit = screen.getByRole("button", { name: /^sign in$/i });

    // Click twice quickly: should only submit once if pending is set promptly.
    await user.click(submit);
    await user.click(submit);

    expect(onSignIn).toHaveBeenCalledTimes(1);

    // Pending UI should reflect disabled state
    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByRole("button", { name: /signing in/i })).toBeInTheDocument();

    // Resolve the pending promise and ensure UI re-enables
    d.resolve();
    await waitFor(() => expect(screen.getByRole("button", { name: /^sign in$/i })).toBeEnabled());
  });

  it("Failed sign-in shows error and re-enables controls", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockRejectedValue(new Error("boom"));

    render(<AuthPage onSignIn={onSignIn} redirectTo="/dashboard" />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/^password$/i), "12345678");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText("boom")).toBeInTheDocument();

    const submit = screen.getByRole("button", { name: /^sign in$/i });
    await waitFor(() => expect(submit).toBeEnabled());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("OAuth failure shows error and re-enables controls", async () => {
    const user = userEvent.setup();
    const onOAuth = vi.fn().mockRejectedValue(new Error("oauth boom"));

    render(<AuthPage onOAuth={onOAuth} redirectTo="/dashboard" />);

    const google = screen.getByRole("button", { name: /^google$/i });
    expect(google).toBeEnabled();

    await user.click(google);

    expect(await screen.findByText("oauth boom")).toBeInTheDocument();
    await waitFor(() => expect(google).toBeEnabled());
  });
});