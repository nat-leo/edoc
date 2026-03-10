# Submit Endpoint Design Specification (`app/api/submit/route.ts`)

## 1. Overview

This project defines the design specification for a Next.js App Router API endpoint at `app/api/submit/route.ts` that supports code submission and polling for hidden-test execution using Judge0.

The endpoint is for engineers building an online coding practice or interview-prep platform where users submit code solutions to programming problems. It is primarily consumed by the platform frontend and indirectly by authenticated end users solving problems.

The problem it solves is: the system needs a secure, consistent way to take a user’s source code, wrap it in a hidden-test runner harness, submit it to Judge0 asynchronously, then poll for normalized results that the frontend can render consistently across languages.

The core value proposition is:

* secure authenticated execution of hidden tests
* normalized execution results regardless of raw Judge0 response shape
* predictable frontend contract for submission and polling
* a testable architecture with clear seams for unit, integration, and end-to-end verification

### Assumptions

* The application uses Next.js App Router.
* Authentication is handled via Firebase session cookies stored under `__session`.
* Problem definitions are already available at `GET /api/problems/[slug]`.
* Problem documents contain `tests`, `paramOrder`, and optional `metaData`.
* Only Python and TypeScript runner harnesses are currently supported.
* Judge0 is accessed through RapidAPI.
* Hidden tests are never sent to the client.
* `parseNdjson()` parses newline-delimited JSON emitted by the harness.
* The current file exists and works as a baseline, but this spec formalizes expected behavior and introduces test-driven hardening.

---

## 2. Goals and Non-Goals

### Goals

The system must:

* expose a `POST /api/submit` endpoint that:

  * authenticates the user
  * validates request payload
  * fetches problem configuration by slug
  * builds a hidden-test harness around submitted source code
  * submits the program to Judge0 asynchronously
  * returns a submission token and metadata for polling

* expose a `GET /api/submit?token=...` endpoint that:

  * authenticates the user
  * polls Judge0 for submission results
  * normalizes Judge0 output into a stable internal response shape
  * parses structured stdout into test case results

* prevent hidden test definitions from being exposed to the client

* support deterministic harness generation for supported languages

* provide consistent error semantics for:

  * authentication failures
  * invalid input
  * missing problem data
  * upstream Judge0 failures
  * malformed upstream payloads
  * unexpected internal exceptions

* be implementation-ready for strong automated testing, with emphasis on:

  * unit isolation
  * dependency mocking
  * contract validation
  * error-path coverage
  * parsing robustness
  * auth and permission verification

### Non-Goals

Out of scope for this endpoint:

* synchronous code execution
* storing submissions in a database
* execution history UI
* per-user submission rate limiting implementation
* problem authoring workflows
* hidden test generation
* Judge0 provisioning or infrastructure ownership
* multi-language support beyond currently supported runner harnesses
* advanced job orchestration, queues, retries, or webhook-based completion
* plagiarism detection or code similarity analysis

---

## 3. Users and Use Cases

### Primary Users

* **Authenticated learners** submitting solutions to coding problems
* **Frontend application** that initiates submissions and polls results
* **Engineers/maintainers** extending judge, parsing, or testing behavior

### Key User Journeys

#### Journey 1: Submit solution and poll result

1. User writes code in the editor.
2. Frontend sends `POST /api/submit` with `slug`, `source_code`, and `language_id`.
3. API authenticates the user.
4. API fetches hidden tests and problem metadata.
5. API builds a runner harness around submitted code.
6. API submits the combined code to Judge0.
7. API returns `{ token, meta }`.
8. Frontend polls `GET /api/submit?token=...`.
9. API returns normalized result with parsed cases.
10. Frontend renders pass/fail status, runtime, memory, and stderr/compile errors.

#### Journey 2: Auth failure

1. Unauthenticated client calls endpoint.
2. API returns `401 Unauthorized`.
3. Frontend redirects to login or shows auth-required message.

#### Journey 3: Invalid problem configuration

1. User submits code for a malformed problem document.
2. API detects missing hidden tests or `paramOrder`.
3. API returns `400` or `500` depending on failure category.
4. Frontend shows failure state without retry loop.

### Main Use Cases

* Run hidden tests against Python code
* Run hidden tests against TypeScript code
* Poll pending Judge0 jobs
* Display compile/runtime errors
* Render parsed per-case results from structured stdout

### Edge Cases

* request body is invalid JSON
* `slug` missing or empty
* `source_code` missing or empty
* `language_id` missing or unsupported
* `/api/problems/[slug]` returns non-JSON or malformed JSON
* problem exists but `problem` field is missing
* `tests` is empty or not an array
* `paramOrder` missing or invalid
* Judge0 responds with non-JSON body
* harness emits malformed NDJSON lines
* stdout is empty but status exists
* stderr absent but `compile_output` or `message` exists
* env vars missing at runtime

---

## 4. Functional Requirements

### 4.1 Authentication

* Both `POST` and `GET` must require authentication.
* Auth source is the `__session` cookie.
* The server must verify the cookie using Firebase Admin `verifySessionCookie(token, true)`.
* On missing or invalid session, return:

```json
{
  "error": "Unauthorized"
}
```

with status `401` and `Content-Type: application/json`.

### 4.2 Environment Validation

The endpoint depends on:

* `RAPIDAPI_BASE_URL`
* `RAPIDAPI_KEY`
* `RAPIDAPI_HOST`

Behavior:

* validate env presence at request time via `assertEnv()`
* if any are missing, return `500` with:

```json
{
  "error": "Missing RAPIDAPI env vars (RAPIDAPI_BASE_URL / RAPIDAPI_KEY / RAPIDAPI_HOST)"
}
```

### 4.3 POST `/api/submit`

#### Inputs

Request body JSON:

```ts
type SubmitRequest = {
  slug: string;
  source_code: string;
  language_id: number;
};
```

#### Validation Rules

* `slug` must be coercible to non-empty string
* `source_code` must be coercible to non-empty string
* `language_id` must be coercible to number
* invalid JSON body should not crash; fallback to `{}` then fail validation

#### Behavior

1. Validate env
2. Require auth
3. Parse JSON body
4. Validate required fields
5. Resolve `origin` from `req.url`
6. Fetch problem data from `${origin}/api/problems/${slug}` with `cache: "no-store"`
7. If problem fetch is not OK:

   * pass through returned payload and status
8. Extract `problem`
9. Validate:

   * `tests` is a non-empty array
   * `paramOrder` is a non-empty array
10. Convert hidden tests into `RunnerCase[]`
11. Select harness builder:

* TypeScript if `language_id === JUDGE0_LANGUAGE_ID.typescript`
* Python for all other current cases

12. Generate `final_source_code`
13. Submit to Judge0 `POST /submissions`
14. Request fields:

* `base64_encoded=false`
* `wait=false`
* `fields=token,status_id`

15. Forward Judge0 errors as raw text with upstream status
16. Parse Judge0 response if JSON; otherwise store raw text
17. Return merged response with meta:

```ts
{
  ...judge0Payload,
  meta: {
    slug: string,
    testCount: number,
    paramOrder: string[],
    stdoutFormat: "jsonl"
  }
}
```

#### Output

Success response example:

```json
{
  "token": "abc123",
  "status_id": 1,
  "meta": {
    "slug": "two-sum",
    "testCount": 12,
    "paramOrder": ["nums", "target"],
    "stdoutFormat": "jsonl"
  }
}
```

#### Error Handling

Validation errors:

* missing `slug` -> `400 {"error":"Missing slug"}`
* missing `source_code` -> `400 {"error":"Missing source_code"}`

Problem data errors:

* problem fetch failure -> propagate upstream status/payload
* missing `problem` field -> `500 {"error":"Problem payload missing"}`
* no hidden tests -> `400 {"error":"No hidden tests found"}`
* missing `paramOrder` -> `400 {"error":"Missing paramOrder in problem doc"}`

Unexpected failures:

* catch all exceptions and return `500 {"error":"..."}`

### 4.4 GET `/api/submit?token=...`

#### Inputs

Query string:

* `token` required

#### Validation Rules

* `token` must exist and be non-empty

#### Behavior

1. Validate env
2. Require auth
3. Read `token`
4. If missing, return `400`
5. Request Judge0 `GET /submissions/{token}` with:

   * `base64_encoded=false`
   * `fields=stdout,stderr,compile_output,message,status,time,memory`
6. Read response body as text
7. Parse JSON if possible, else wrap as `{ raw: text }`
8. Normalize:

   * `stdout_raw = String(payload?.stdout ?? "")`
   * `stderr_raw = String(payload?.stderr ?? payload?.compile_output ?? payload?.message ?? "")`
9. Parse stdout with `parseNdjson(stdout_raw)`
10. Return `RunResponse`

#### Output Shape

```ts
type RunResponse = {
  token: string;
  status: unknown;
  stdout_raw: string;
  stderr_raw: string;
  cases: unknown[];
  compile_output: string | null;
  time: string | null;
  memory: number | string | null;
  unparsed_lines: string[];
};
```

Success response example:

```json
{
  "token": "abc123",
  "status": { "id": 3, "description": "Accepted" },
  "stdout_raw": "{\"n\":1,\"ok\":true}\n{\"n\":2,\"ok\":false}",
  "stderr_raw": "",
  "cases": [
    { "n": 1, "ok": true },
    { "n": 2, "ok": false }
  ],
  "compile_output": null,
  "time": "0.021",
  "memory": 12344,
  "unparsed_lines": []
}
```

Error example:

```json
{
  "error": "Missing token"
}
```

### 4.5 Output Normalization Rules

* API must not expose raw hidden tests
* API must prefer normalized fields over Judge0’s raw shape
* API must preserve raw stdout and stderr for debugging
* API must parse structured stdout opportunistically, not fail if parsing is partial
* unparseable stdout lines must be returned in `unparsed_lines`, not dropped silently

### 4.6 Content-Type Rules

All successful and error JSON responses must set:

```http
Content-Type: application/json
```

Current implementation is inconsistent for some `400` responses. Implementation should standardize this.

---

## 5. System Architecture

### High-Level Architecture

```text
Frontend Editor UI
  -> POST /api/submit
      -> Auth via Firebase session cookie
      -> Fetch problem config from internal Problems API
      -> Build runner harness
      -> Submit to Judge0
      -> Return token + meta

Frontend Poller
  -> GET /api/submit?token=...
      -> Auth via Firebase session cookie
      -> Poll Judge0
      -> Parse NDJSON stdout
      -> Return normalized run result
```

### Major Services / Modules / Components

#### `app/api/submit/route.ts`

Responsible for:

* request handling
* auth enforcement
* input validation
* internal problem fetch
* Judge0 integration
* response normalization

#### `next/headers -> cookies()`

Responsible for:

* reading session cookie from request context

#### `@/lib/firebase-admin`

Responsible for:

* verifying Firebase session cookie

#### `@/lib/judge0`

Responsible for:

* `makePythonRunnerHarness()`
* `makeTypescriptRunnerHarness()`
* `parseNdjson()`
* shared types such as `RunResponse`, `RunnerCase`

#### `@/lib/starter-code`

Responsible for:

* Judge0 language ID constants

#### `/api/problems/[slug]`

Responsible for:

* returning canonical problem definition including hidden tests and metadata

#### Judge0 via RapidAPI

Responsible for:

* asynchronous code execution
* result retrieval by token

### Component Communication

* `POST /api/submit` calls internal problems API via HTTP
* `POST /api/submit` and `GET /api/submit` call Judge0 via HTTP
* frontend polls `GET /api/submit` until Judge0 status is terminal

### Suggested Deployment Shape

* deploy as part of the existing Next.js server application
* use server-only env vars in deployment platform
* no separate worker required for current asynchronous polling design

### Recommended Refactor for Testability

Refactor `route.ts` into:

* `route.ts` thin handlers
* `submit-service.ts`
* `submit-validation.ts`
* `submit-auth.ts`
* `submit-http.ts` or `judge0-client.ts`

This creates seams for isolated testing without over-mocking framework internals.

---

## 6. Data Model

## Core Entities

### HiddenTest

Represents one hidden problem test case.

```ts
type HiddenTest = {
  n: number;
  args: Record<string, any>;
  solutionOutput?: unknown;
};
```

Fields:

* `n`: stable test index or case number
* `args`: named arguments for the solution function
* `solutionOutput`: expected output used by harness comparison; may be omitted

### RunnerCase

Internal normalized test case used by harness builders.

```ts
type RunnerCase = {
  n: number;
  args: Record<string, any>;
  expected: unknown | null;
};
```

Mapping:

* `expected = solutionOutput ?? null`

### Problem

Minimum required subset of problem definition.

```ts
type Problem = {
  slug: string;
  metaData?: unknown;
  paramOrder: string[];
  tests: HiddenTest[];
};
```

### SubmitRequest

```ts
type SubmitRequest = {
  slug: string;
  source_code: string;
  language_id: number;
};
```

### SubmitResponse

```ts
type SubmitResponse = {
  token?: string;
  status_id?: number;
  raw?: string;
  meta: {
    slug: string;
    testCount: number;
    paramOrder: string[];
    stdoutFormat: "jsonl";
  };
};
```

### RunResponse

```ts
type RunResponse = {
  token: string;
  status: unknown;
  stdout_raw: string;
  stderr_raw: string;
  cases: unknown[];
  compile_output: string | null;
  time: string | null;
  memory: number | string | null;
  unparsed_lines: string[];
};
```

### Relationships

* One `Problem` has many `HiddenTest`
* One `POST /api/submit` request generates many `RunnerCase`
* One Judge0 submission token corresponds to one submitted harnessed program
* One polled result may contain many parsed case outputs

---

## 7. API / Interface Design

## 7.1 POST `/api/submit`

### Authentication

* Requires valid Firebase session cookie `__session`

### Request

```http
POST /api/submit
Content-Type: application/json
Cookie: __session=...
```

```json
{
  "slug": "two-sum",
  "source_code": "def twoSum(nums, target):\n    ...",
  "language_id": 71
}
```

### Success Response

```json
{
  "token": "submission-token",
  "status_id": 1,
  "meta": {
    "slug": "two-sum",
    "testCount": 8,
    "paramOrder": ["nums", "target"],
    "stdoutFormat": "jsonl"
  }
}
```

### Failure Responses

| Condition                  |    Status | Response                                        |
| -------------------------- | --------: | ----------------------------------------------- |
| No session                 |       401 | `{"error":"Unauthorized"}`                      |
| Missing slug               |       400 | `{"error":"Missing slug"}`                      |
| Missing source_code        |       400 | `{"error":"Missing source_code"}`               |
| Missing hidden tests       |       400 | `{"error":"No hidden tests found"}`             |
| Missing paramOrder         |       400 | `{"error":"Missing paramOrder in problem doc"}` |
| Problem fetch bad response | propagate | upstream JSON or raw body                       |
| Missing problem object     |       500 | `{"error":"Problem payload missing"}`           |
| Missing env                |       500 | env error                                       |
| Unexpected exception       |       500 | `{"error":"..."}`                               |

## 7.2 GET `/api/submit?token=...`

### Authentication

* Requires valid Firebase session cookie `__session`

### Request

```http
GET /api/submit?token=submission-token
Cookie: __session=...
```

### Success Response

```json
{
  "token": "submission-token",
  "status": {
    "id": 3,
    "description": "Accepted"
  },
  "stdout_raw": "{\"n\":1,\"ok\":true}\n{\"n\":2,\"ok\":true}",
  "stderr_raw": "",
  "cases": [
    { "n": 1, "ok": true },
    { "n": 2, "ok": true }
  ],
  "compile_output": null,
  "time": "0.013",
  "memory": 18432,
  "unparsed_lines": []
}
```

### Failure Responses

| Condition            | Status | Response                    |
| -------------------- | -----: | --------------------------- |
| No session           |    401 | `{"error":"Unauthorized"}`  |
| Missing token        |    400 | `{"error":"Missing token"}` |
| Missing env          |    500 | env error                   |
| Unexpected exception |    500 | `{"error":"..."}`           |

## 7.3 Internal Interfaces

### `requireAuth(): Promise<DecodedClaims | null>`

Responsibilities:

* read session cookie
* verify cookie
* return decoded claims or `null`

### `assertEnv(): void`

Responsibilities:

* throw if Judge0 env vars missing

### `buildRunnerCases(tests: HiddenTest[]): RunnerCase[]`

Responsibilities:

* transform problem hidden tests to harness input

### `selectHarness(language_id: number)`

Responsibilities:

* choose TypeScript or Python harness generator

### `normalizeJudgePollResponse(token, payloadText): RunResponse`

Responsibilities:

* parse JSON or raw fallback
* derive `stdout_raw`
* derive `stderr_raw`
* parse NDJSON
* assemble `RunResponse`

---

## 8. Frontend / UX Structure

Although the work centers on the API endpoint, the frontend contract should be explicit so engineers can build against it reliably.

### Pages / Views

* Problem solve page
* Code editor panel
* Submission status panel
* Hidden test results panel

### Component Hierarchy

```text
ProblemPage
  ├─ ProblemStatement
  ├─ CodeEditor
  ├─ LanguageSelector
  ├─ SubmitButton
  └─ SubmissionPanel
      ├─ SubmissionStatus
      ├─ RuntimeMemorySummary
      ├─ CaseResultsList
      ├─ CompileErrorPanel
      └─ RawOutputDebugPanel
```

### State Management Approach

Recommended client state:

```ts
type SubmissionUiState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "queued"; token: string; meta: SubmitResponse["meta"] }
  | { phase: "polling"; token: string; meta: SubmitResponse["meta"] }
  | { phase: "done"; result: RunResponse; meta?: SubmitResponse["meta"] }
  | { phase: "error"; error: string };
```

### User Interactions and Flows

#### Submit flow

* user clicks Submit
* button enters loading state
* API `POST /api/submit`
* on success, store token and start polling
* on failure, show inline error

#### Poll flow

* poll at fixed interval until terminal Judge0 status
* render partial state while waiting
* stop polling on:

  * terminal success/failure status
  * unrecoverable API error
  * unmount/navigation

### Loading, Empty, and Error States

#### Loading

* submitting spinner
* polling indicator with token hidden from casual UI but available in debug mode

#### Empty

* before first submission: “Submit your solution to run hidden tests.”

#### Error

* unauthorized -> prompt sign-in
* validation -> inline user-facing message
* compile/runtime errors -> code-output panel
* upstream transient failures -> retry affordance

### UX Notes

* do not display hidden inputs or expected outputs
* do display:

  * case number
  * pass/fail
  * runtime/memory
  * stderr/compile errors
* allow debug expansion for `stdout_raw` and `stderr_raw` in development mode

---

## 9. Backend Logic

### Core Business Logic

#### POST Workflow

1. authenticate request
2. parse and validate request body
3. fetch problem document
4. validate problem contains hidden tests and param order
5. transform hidden tests into `RunnerCase[]`
6. select harness generator by language
7. generate final executable source code
8. submit to Judge0 asynchronously
9. return submission token plus metadata

#### GET Workflow

1. authenticate request
2. validate token
3. fetch Judge0 result
4. normalize raw response
5. parse structured stdout into case records
6. return stable `RunResponse`

### Validation and Permissions

* only authenticated users may submit or poll
* no ownership model is currently enforced for tokens; any authenticated user with a valid token could poll it under current design
* recommended future improvement: bind submission token to user ID in server-side store if cross-user leakage is a concern

### External Integrations

#### Firebase Admin

* verify session cookie
* failure should be treated as unauthenticated, not fatal server error

#### Internal Problems API

* source of truth for hidden tests and metadata
* must not leak hidden tests through downstream frontend contract

#### Judge0

* external execution service
* asynchronous token-based polling model
* may return non-JSON or incomplete payloads

### Jobs, Workflows, Queues, Async Processing

Current design is asynchronous but not queue-backed:

* submission is fire-and-poll
* frontend is responsible for polling cadence
* no retry worker exists

This is acceptable for MVP and low infrastructure complexity.

---

## 10. Infrastructure and Deployment

### Recommended Stack

* Next.js App Router
* Node.js runtime
* Firebase Admin SDK
* Judge0 via RapidAPI
* Vitest for unit/integration testing
* Playwright for end-to-end tests
* MSW or fetch mocking for HTTP contract tests

### Environments

* local
* preview/staging
* production

Each environment must define:

* `RAPIDAPI_BASE_URL`
* `RAPIDAPI_KEY`
* `RAPIDAPI_HOST`

### Hosting / Deployment Assumptions

* deployed as part of the existing Next.js application
* secrets managed by hosting platform env settings
* server-side execution only; no client exposure of RapidAPI secrets

### Storage

No database storage is required for current implementation.

Optional future storage:

* submission audit logs
* token-to-user ownership mapping
* metrics on pass rates and runtime

### Secrets

Must remain server-only:

* RapidAPI key
* Firebase admin credentials

### Observability and Logging

Recommended structured logs:

* request id
* route
* user uid if available
* slug
* language_id
* Judge0 token
* upstream status
* elapsed time

Do not log:

* full source code in production
* hidden tests
* session cookie
* RapidAPI credentials

Recommended metrics:

* submit success rate
* poll success rate
* unauthorized rate
* Judge0 upstream error rate
* average submit latency
* average poll latency
* parse failure count
* harness generation failure count

---

## 11. Security and Privacy

### Auth Model

* Firebase session cookie auth
* server validates cookie on every request
* invalid token treated as unauthenticated

### Access Control

Current:

* route requires authenticated user
* no per-token ownership binding

Risk:

* token enumeration or leakage could allow authenticated cross-user polling

Mitigation options:

* short-term: accept risk if tokens are unguessable and UI never exposes them widely
* medium-term: persist token -> uid mapping and enforce ownership on GET
* long-term: signed opaque polling handles instead of raw Judge0 tokens

### Sensitive Data Handling

Sensitive:

* hidden tests
* expected outputs
* user source code
* auth cookies
* API secrets

Requirements:

* never return hidden tests in API responses
* never log hidden tests
* do not expose RapidAPI credentials to client
* minimize logging of user code

### Common Abuse Cases and Mitigations

| Abuse Case                 | Risk                         | Mitigation                                         |
| -------------------------- | ---------------------------- | -------------------------------------------------- |
| Unauthenticated access     | submission/poll misuse       | require auth on both endpoints                     |
| Hidden test leakage        | cheating                     | keep tests server-side only                        |
| Large source payloads      | resource abuse               | add request body size limits in future             |
| Submission spam            | cost and upstream throttling | add rate limiting later                            |
| Poll spam                  | upstream load                | frontend backoff and optional server rate limiting |
| Cross-user token polling   | privacy leak                 | token ownership binding                            |
| Malformed stdout injection | parser breakage              | tolerant parsing and escaped rendering             |

---

## 12. Testing Strategy

This section is the primary focus of this design spec.

### Testing Objectives

The test strategy must ensure:

* auth is enforced consistently
* validation failures are deterministic
* hidden-test preparation is correct
* harness selection is correct
* Judge0 requests are formed correctly
* response normalization is stable
* partial/malformed upstream payloads do not crash the endpoint
* edge cases are explicitly covered
* regression risk is low when adding languages, parser changes, or auth changes

### Testing Pyramid

#### Unit tests

Fast, isolated, high coverage for pure logic.

#### Integration tests

Route handler tests with mocked framework dependencies and mocked fetch.

#### End-to-end tests

Full browser flows from code editor submit to rendered results.

### Recommended Test Refactor

To test well, extract logic into pure functions.

Suggested modules:

* `submit-auth.ts`
* `submit-validation.ts`
* `submit-post-service.ts`
* `submit-get-service.ts`
* `submit-normalization.ts`

This allows:

* minimal mocking
* deterministic unit coverage
* clean integration seams

### Unit Tests

Focus on pure functions or mostly pure wrappers.

#### 1. `assertEnv()`

Test cases:

* all vars present -> does not throw
* missing base -> throws exact error
* missing key -> throws exact error
* missing host -> throws exact error

Technique:

* dependency injection or temporarily stub env-backed config object instead of relying on module import timing

#### 2. Hidden test to runner-case mapping

Function:

```ts
buildRunnerCases(tests: HiddenTest[]): RunnerCase[]
```

Test cases:

* maps `solutionOutput` to `expected`
* missing `solutionOutput` becomes `null`
* preserves `n`
* preserves `args`
* empty tests returns empty array if function is pure, though route should reject earlier

#### 3. Harness selection

Function:

```ts
selectHarness(language_id: number)
```

Test cases:

* typescript language id -> TypeScript harness
* python language id -> Python harness
* unsupported language id current fallback behavior -> Python harness

Important note:

* current fallback behavior is implicit and potentially dangerous; tests should document current behavior and create pressure for explicit unsupported-language handling later

#### 4. Response normalization for GET

Function:

```ts
normalizeJudgePollResponse(token: string, text: string, parseNdjsonFn = parseNdjson): RunResponse
```

Test cases:

* valid Judge0 JSON with stdout and stderr
* valid Judge0 JSON with compile_output but no stderr
* valid Judge0 JSON with message but no stderr/compile_output
* non-JSON response body becomes `{ raw }`
* empty stdout yields empty cases
* parseNdjson returns unparsed lines correctly
* status preserved exactly
* compile_output/time/memory null normalization works

Technique:

* pass `parseNdjson` as dependency for mocking isolated behavior

#### 5. Request body validation

Function:

```ts
validateSubmitBody(body: unknown)
```

Test cases:

* valid input
* missing slug
* missing source_code
* language_id string coercion if allowed
* invalid shapes

Recommendation:

* move away from ad hoc coercion toward explicit schema validation using Zod or a small manual validator

### Integration Tests

These should exercise `POST` and `GET` handlers with mocked dependencies.

Recommended tools:

* Vitest
* `vi.mock()` for:

  * `next/headers`
  * `@/lib/firebase-admin`
  * `@/lib/judge0`
  * `global.fetch`

#### POST route integration cases

##### Auth

* no cookie -> 401
* invalid cookie -> 401
* valid cookie -> proceeds

##### Validation

* invalid JSON body -> 400 missing slug
* missing slug -> 400
* missing source_code -> 400

##### Problem fetch

* problem API 404 -> exact pass-through status/body
* problem payload missing `problem` -> 500
* no tests -> 400
* no paramOrder -> 400

##### Harness generation

* TypeScript language uses `makeTypescriptRunnerHarness`
* other supported language uses `makePythonRunnerHarness`
* generated `RunnerCase[]` contains expected mapping

##### Judge0 submission

* request URL includes required search params
* headers include rapidapi key and host
* body includes `final_source_code`, `language_id`, `stdin: ""`
* Judge0 non-OK response text is forwarded
* Judge0 JSON success gets merged with `meta`
* Judge0 non-JSON success returns `{ raw, meta }`

##### Unexpected failures

* problem fetch throws
* harness builder throws
* fetch to Judge0 throws
* catch-all returns 500 JSON

#### GET route integration cases

##### Auth

* no cookie -> 401
* invalid cookie -> 401

##### Validation

* missing token -> 400

##### Judge0 fetch

* request URL includes required query params
* response JSON with stdout -> parsed correctly
* response JSON with stderr fallback chain -> correct
* response non-JSON -> raw fallback
* parseNdjson called with stdout
* returned status code matches upstream `r.status`

##### Unexpected failures

* fetch throws -> 500 JSON
* parseNdjson throws -> 500 JSON unless intentionally caught separately

### Contract Tests

These verify exact response shapes expected by frontend.

Technique:

* snapshot tests for stable JSON envelopes
* prefer targeted snapshots on payload shape over full raw text where dynamic fields exist

Recommended contracts:

* POST success envelope
* GET normalized envelope
* Unauthorized envelope
* Validation error envelopes

### End-to-End Tests

Recommended tool:

* Playwright

Scenarios:

#### 1. Successful submit and poll

* sign in as test user
* open problem page
* enter known-correct solution
* submit
* intercept network or use test backend
* poll until complete
* verify pass/fail UI and runtime/memory rendering

#### 2. Compile error flow

* submit syntactically invalid code
* verify compile error panel displays message
* verify no hidden test details leaked

#### 3. Runtime error flow

* submit code that raises exception
* verify stderr displayed
* verify result state is terminal

#### 4. Unauthorized flow

* force expired session
* submit
* verify user is redirected or shown sign-in prompt

#### 5. Polling resilience

* mock pending Judge0 statuses before terminal result
* verify polling stops at terminal state
* verify UI does not duplicate submissions

### Testing Techniques

#### Dependency Injection

Prefer pure service functions that accept:

* `fetch`
* auth verifier
* harness builders
* parser

This reduces brittle module mocking.

#### Table-Driven Tests

Use table-driven cases for validation and normalization.

Example:

```ts
[
  { name: "stderr wins", payload: {...}, expected: "boom" },
  { name: "compile_output fallback", payload: {...}, expected: "compile fail" },
  { name: "message fallback", payload: {...}, expected: "queued" }
]
```

#### Mocked HTTP Sequences

For POST tests, mock `fetch` in ordered sequence:

1. problem fetch
2. Judge0 submission

For GET tests:

1. Judge0 poll

Validate both call count and request arguments.

#### Property-Oriented Parser Tests

For `parseNdjson` integration:

* mixture of valid and invalid lines
* blank lines
* whitespace
* malformed JSON fragments

Verify:

* parsed lines preserved in order
* invalid lines collected in `unparsed_lines`
* no thrown errors for partial corruption

#### Mutation-Resistant Assertions

Avoid only testing status codes. Also assert:

* headers
* response body
* selected harness function
* Judge0 request params
* transformed case data

#### Negative Testing

Ensure tests intentionally cover:

* malformed JSON input
* malformed JSON output
* missing fields
* thrown exceptions
* partial upstream failures

### Test Coverage Targets

Suggested minimums:

* 95% line coverage for extracted service modules
* 90% branch coverage for validation and normalization logic
* 100% coverage for auth/validation helper branches
* route file can be lower if kept thin, but handlers should still have direct integration coverage

### Test File Layout

```text
app/api/submit/
  route.ts
  __tests__/
    route.post.test.ts
    route.get.test.ts
    normalization.test.ts
    validation.test.ts
    auth.test.ts
```

Or after refactor:

```text
app/api/submit/
  route.ts
  submit-auth.ts
  submit-validation.ts
  submit-post-service.ts
  submit-get-service.ts
  submit-normalization.ts
  __tests__/
    route.test.ts
    submit-auth.test.ts
    submit-validation.test.ts
    submit-post-service.test.ts
    submit-get-service.test.ts
    submit-normalization.test.ts
```

### Example Integration Test Matrix

| Area                 | Scenario                  | Expected               |
| -------------------- | ------------------------- | ---------------------- |
| POST auth            | no cookie                 | 401                    |
| POST validation      | missing slug              | 400                    |
| POST validation      | missing source_code       | 400                    |
| POST problems API    | upstream 404              | same 404 body/status   |
| POST problem payload | missing problem           | 500                    |
| POST problem config  | missing tests             | 400                    |
| POST problem config  | missing paramOrder        | 400                    |
| POST harness         | TS language               | TS harness called      |
| POST harness         | Python language           | Python harness called  |
| POST Judge0          | non-OK text               | forwarded status/body  |
| POST Judge0          | OK JSON                   | merged with meta       |
| POST Judge0          | OK non-JSON               | raw + meta             |
| GET auth             | no cookie                 | 401                    |
| GET validation       | missing token             | 400                    |
| GET Judge0           | stdout JSONL              | parsed cases           |
| GET Judge0           | stderr fallback           | correct stderr_raw     |
| GET Judge0           | non-JSON payload          | raw fallback           |
| GET parsing          | mixed valid/invalid lines | cases + unparsed_lines |

### Recommended Improvements to Make Testing Easier

* standardize all JSON responses with helper:

```ts
json(data: unknown, status = 200): Response
```

* isolate URL construction:

  * `buildJudge0SubmitUrl(base)`
  * `buildJudge0PollUrl(base, token)`

* isolate headers:

  * `buildJudge0Headers(key, host)`

* use schema validation for request body and problem payload

* optionally add typed status normalization for Judge0 responses

These changes reduce repeated assertions and improve test precision.

---

## 13. Risks, Tradeoffs, and Alternatives

### Main Technical Risks

#### 1. Tight coupling in one route file

Risk:

* hard to test
* brittle mocks
* low maintainability

Mitigation:

* extract pure services and helpers

#### 2. Cross-user token polling

Risk:

* token leakage could expose another user’s result

Mitigation:

* add token ownership mapping later

#### 3. Implicit language fallback

Risk:

* unsupported languages may be wrapped in wrong harness

Mitigation:

* switch to explicit allowlist and 400 on unsupported language

#### 4. Dependency on internal HTTP call to `/api/problems/[slug]`

Risk:

* slower than direct module/service call
* more brittle in tests and deployments

Mitigation:

* future refactor to shared problem service/repository

#### 5. Upstream Judge0 variability

Risk:

* non-JSON bodies or changed payload shape

Mitigation:

* tolerant parsing and contract tests

### Important Tradeoffs

#### Current tradeoff: polling over callbacks/webhooks

Pros:

* simple
* easy to reason about
* frontend-controlled

Cons:

* repeated requests
* slower UX under long-running jobs

#### Current tradeoff: no database persistence

Pros:

* low complexity
* stateless route behavior

Cons:

* no ownership enforcement
* no historical auditing
* no replay/debug metadata

#### Current tradeoff: internal problems API via HTTP

Pros:

* uses existing contract
* simple reuse

Cons:

* duplicates network hop
* harder local isolation

### Alternatives Considered

#### Alternative A: synchronous Judge0 wait

Rejected because:

* hidden test execution may take too long
* worse perceived responsiveness
* greater timeout risk

#### Alternative B: queue + worker + persistence

Not chosen for current scope because:

* more infrastructure
* unnecessary if token polling is sufficient

#### Alternative C: direct problem repository lookup instead of HTTP fetch

Good future option:

* better performance
* simpler testing
* less coupling to URL origin semantics

---

## 14. Milestones / Implementation Plan

### Phase 1 — Baseline Hardening

**Scope**

* formalize current behavior
* standardize JSON response headers
* add missing tests around current route

**Deliverables**

* test suite for existing `POST` and `GET`
* standardized error response helper
* documented response contracts
* coverage report baseline

**Dependencies**

* Vitest setup
* route mocking utilities

### Phase 2 — Refactor for Testability

**Scope**

* extract pure helpers and service modules
* reduce route handler complexity

**Deliverables**

* `submit-auth.ts`
* `submit-validation.ts`
* `submit-post-service.ts`
* `submit-get-service.ts`
* `submit-normalization.ts`
* updated tests migrated to service-level focus

**Dependencies**

* Phase 1 contract tests to prevent regressions

### Phase 3 — Robust Validation and Contracts

**Scope**

* introduce typed validation for request and problem payloads
* harden unsupported language handling

**Deliverables**

* schema validation layer
* explicit unsupported language response
* improved error classification
* expanded edge-case tests

**Dependencies**

* extracted service boundaries from Phase 2

### Phase 4 — Frontend Integration and E2E

**Scope**

* wire UI submission/poll flow fully against contract
* add Playwright coverage

**Deliverables**

* submit/poll UI flow
* compile/runtime error states
* loading and terminal states
* Playwright scenarios

**Dependencies**

* stable API contract from Phases 1–3

### Phase 5 — Security and Ownership Enhancements

**Scope**

* reduce token leakage risk
* improve observability and abuse resistance

**Deliverables**

* optional token ownership storage
* request correlation logging
* rate limiting design or implementation
* metrics dashboard

**Dependencies**

* persistence decision
* auth/user model confirmation

---

## 15. Open Questions

1. Should unsupported `language_id` values fail with `400` instead of defaulting to Python harness?
2. Should submission tokens be persisted and bound to user IDs to prevent authenticated cross-user polling?
3. Should the route continue fetching problem data over HTTP, or should it call a shared server-side problem service directly?
4. What Judge0 statuses should the frontend treat as terminal versus polling states?
5. Should request body validation use a schema library such as Zod, or stay manual for minimal dependency surface?
6. Is there a maximum allowed `source_code` size that should be enforced server-side?
7. Should `slug` and `token` inputs be sanitized more strictly beyond string coercion and presence checks?
8. Should raw Judge0 payload fragments be included in responses for debugging in production, or only in non-production environments?
9. Should all errors use a standardized envelope with machine-readable codes, for example:

   ```json
   { "error": { "code": "MISSING_SLUG", "message": "Missing slug" } }
   ```
10. Should parse failures in `parseNdjson` ever cause the whole request to fail, or always degrade gracefully into `unparsed_lines`?
11. Should compile errors and runtime errors be normalized into more structured frontend-friendly categories?
12. Should polling be moved to a dedicated route such as `/api/submissions/[token]` for clearer resource modeling?
13. Does the system need audit logging for submissions in regulated or enterprise contexts?
14. Should there be backoff recommendations or server-provided poll intervals in the `POST` response metadata?
15. Should hidden test runner output format be versioned, for example `stdoutFormatVersion: 1`, to support future harness evolution?
