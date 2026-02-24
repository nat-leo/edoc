import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

function Hello() {
  return <h1>hello, auth tests</h1>;
}

describe("hello", () => {
  it("renders", () => {
    render(<Hello />);
    expect(screen.getByRole("heading", { name: /hello, auth tests/i })).toBeInTheDocument();
  });
});