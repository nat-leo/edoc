import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestUser = { displayName?: string | null; email?: string | null };

let authListener: ((user: TestUser | null) => void) | null = null;

const onAuthStateChangedMock = vi.fn((cb: (user: TestUser | null) => void) => {
  authListener = cb;
  return vi.fn();
});

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/auth", () => ({
  onAuthStateChanged: onAuthStateChangedMock,
  signInWithEmailPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
  signUpWithEmailPassword: vi.fn(),
}));

vi.mock("@/app/login/page", () => ({
  LoginForm: () => <div>Sign in page</div>,
}));

import LandingPage from "@/app/landing/page";

beforeEach(() => {
  authListener = null;
  onAuthStateChangedMock.mockClear();
  pushMock.mockClear();
  refreshMock.mockClear();
});

describe("LandingPage", () => {
  it("renders sign in page when no user is signed in", async () => {
    render(<LandingPage />);

    expect(onAuthStateChangedMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      authListener?.(null);
    });

    expect(screen.getByText("Sign in page")).toBeInTheDocument();
  });

  it("renders hello message when a user is signed in", async () => {
    render(<LandingPage />);

    await act(async () => {
      authListener?.({ displayName: "Ada Lovelace", email: "ada@example.com" });
    });

    expect(
      screen.getByRole("heading", { name: "Hello, Ada Lovelace" }),
    ).toBeInTheDocument();
  });
});
