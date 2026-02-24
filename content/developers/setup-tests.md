## Folder structure

```
your-app/
  app/
    page.tsx
  src/                (optional—if you use it)
  tests/
    hello.test.tsx
  vitest.config.ts
  vitest.setup.ts
  package.json
```

## Hello test (React Testing Library)

`tests/hello.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";

function Hello() {
  return <h1>Hello, auth tests</h1>;
}

describe("hello", () => {
  it("renders", () => {
    render(<Hello />);
    expect(screen.getByRole("heading", { name: /hello, auth tests/i })).toBeInTheDocument();
  });
});
```

`vitest.setup.ts`

```ts
import "@testing-library/jest-dom/vitest";
```

`vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  },
});
```

## Install tools

```bash
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Command to run

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

Run:

```bash
npm test
```
