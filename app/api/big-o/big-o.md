# FILE: `big-o.m`

# Client API Reference Specification

## 1. API Overview

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| API Name            | Complexity Analysis API                                                               |
| Purpose             | Classify algorithmic time complexity from benchmark observations produced by Judge0   |
| Base URL            | `/api`                                                                                |
| Versioning Strategy | Version embedded in response metadata (`modelVersion` internally; API version stable) |
| Authentication      | Optional for run flows; required for submission flows                                 |
| Content Type        | `application/json`                                                                    |
| Primary Resources   | Complexity Analysis                                                                   |
| Error Format        | JSON error envelope                                                                   |
| Pagination Style    | None                                                                                  |
| Idempotency Notes   | Requests are safe to retry if the same input payload is sent                          |

This API allows clients to submit benchmark observations derived from Judge0 execution results and receive a classification of the algorithm’s time complexity.

The API is product-facing and returns only user-safe information such as the complexity class.

---

# 2. Design Conventions

## 2.1 Request Conventions

| Topic               | Rule                                        |
| ------------------- | ------------------------------------------- |
| JSON format         | UTF-8 encoded JSON                          |
| Naming convention   | camelCase                                   |
| Nullable fields     | Explicitly documented                       |
| Optional fields     | May be omitted                              |
| Date/time format    | Not used                                    |
| Unknown fields      | Ignored                                     |
| Validation behavior | Invalid fields return `400 INVALID_REQUEST` |

---

## 2.2 Response Conventions

| Topic            | Rule                      |
| ---------------- | ------------------------- |
| Success envelope | Direct object with `meta` |
| Error envelope   | `{ "error": {...} }`      |
| List responses   | Not used                  |
| Empty responses  | Not used                  |
| Create responses | Not used                  |
| Update responses | Not used                  |
| Delete responses | Not used                  |

---

## 2.3 HTTP Semantics

| Method | Typical Use                          |
| ------ | ------------------------------------ |
| GET    | Retrieve resources                   |
| POST   | Perform analysis or create resources |
| PUT    | Replace resource                     |
| PATCH  | Partial update                       |
| DELETE | Remove resource                      |

---

# 3. Authentication and Authorization

| Topic                 | Details                          |
| --------------------- | -------------------------------- |
| Auth type             | Session / Bearer token           |
| Header format         | `Authorization: Bearer <token>`  |
| Required endpoints    | Required for submission analysis |
| Unauthorized response | `401`                            |
| Forbidden response    | `403`                            |

### Example Headers

```
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
```

Guest execution flows may not require authentication.

---

# 4. Resource Model

| Resource            | Description                                   | Primary Identifier | Notes                                        |
| ------------------- | --------------------------------------------- | ------------------ | -------------------------------------------- |
| Complexity Analysis | Result of algorithm complexity classification | `judge0Token`      | Observations originate from Judge0 execution |

---

# 5. Endpoint Reference

---

## `POST /api/analysis/big-o`

### Purpose

Classifies algorithmic time complexity using benchmark observations.

### Behavior Summary

| Item           | Details                       |
| -------------- | ----------------------------- |
| Auth Required  | Optional depending on context |
| Idempotent     | Yes                           |
| Resource       | Complexity Analysis           |
| Operation Type | Analysis                      |
| Pagination     | None                          |
| Filtering      | None                          |
| Sorting        | None                          |

---

### Path Parameters

None.

---

### Query Parameters

None.

---

### Headers

| Header        | Required | Description                      |
| ------------- | -------- | -------------------------------- |
| Content-Type  | Yes      | Must be `application/json`       |
| Authorization | Optional | Required for submission analysis |

---

### Request Body Schema

| Field        | Type   | Required | Nullable | Description                          | Constraints      |
| ------------ | ------ | -------- | -------- | ------------------------------------ | ---------------- |
| judge0Token  | string | Yes      | No       | Token returned from Judge0 execution | UUID             |
| observations | array  | Yes      | No       | Benchmark observations               | Minimum length 1 |

Observation Fields

| Field     | Type   | Required | Nullable | Description                       | Constraints |
| --------- | ------ | -------- | -------- | --------------------------------- | ----------- |
| n         | number | Yes      | No       | Input size                        | > 0         |
| runtimeMs | number | Yes      | No       | Execution runtime in milliseconds | > 0         |

---

### Example Request Body

```json
{
  "judge0Token": "98c90745-585a-4970-b620-7764eb07d384",
  "observations": [
    { "n": 2, "runtimeMs": 0.68 },
    { "n": 4, "runtimeMs": 1.3 },
    { "n": 8, "runtimeMs": 2.7 }
  ]
}
```

---

### Success Response

| Field           | Type   | Nullable | Description                     |
| --------------- | ------ | -------- | ------------------------------- |
| complexityClass | string | No       | Classified algorithm complexity |
| meta            | object | No       | Response metadata               |

Meta Fields

| Field     | Type   | Nullable | Description                         |
| --------- | ------ | -------- | ----------------------------------- |
| requestId | string | No       | Server-generated request identifier |

---

### Example Response

```json
{
  "complexityClass": "O(n)",
  "meta": {
    "requestId": "req_12af89"
  }
}
```

---

### Error Responses

| Status | When It Happens       | Notes                     |
| ------ | --------------------- | ------------------------- |
| 400    | Invalid observations  | Validation failure        |
| 401    | Unauthorized request  | Missing or invalid token  |
| 403    | Forbidden request     | Token ownership violation |
| 503    | Inference unavailable | Inference server offline  |
| 500    | Internal error        | Unexpected failure        |

---

### Test Cases

| Test Case ID | Scenario                  | Input              | Expected Status | Expected Result     |
| ------------ | ------------------------- | ------------------ | --------------- | ------------------- |
| TC-001       | Valid observations        | valid payload      | 200             | complexity returned |
| TC-002       | Missing token             | token missing      | 400             | validation error    |
| TC-003       | Invalid runtime           | negative runtime   | 400             | validation error    |
| TC-004       | Unauthorized submission   | invalid auth       | 401             | auth error          |
| TC-005       | Token ownership violation | other user's token | 403             | forbidden           |
| TC-006       | Retry same payload        | same payload twice | 200             | same result         |

---

# 6. Data Models

## Observation

| Field     | Type   | Required | Nullable | Description    | Constraints |
| --------- | ------ | -------- | -------- | -------------- | ----------- |
| n         | number | Yes      | No       | Input size     | >0          |
| runtimeMs | number | Yes      | No       | Execution time | >0          |

Example

```json
{
  "n": 32,
  "runtimeMs": 6.4
}
```

---

# 7. Enumerations

## ComplexityClass

| Value      | Meaning                    |
| ---------- | -------------------------- |
| O(1)       | Constant time              |
| O(log n)   | Logarithmic                |
| O(n)       | Linear                     |
| O(n log n) | Linearithmic               |
| O(n^2)     | Quadratic                  |
| O(V + E)   | Graph traversal complexity |
| O(2^n)     | Exponential                |
| O(n!)      | Factorial                  |
| unknown    | Unable to classify         |

---

# 8. Validation Rules

| Field / Scope          | Rule       | Failure Status | Notes            |
| ---------------------- | ---------- | -------------- | ---------------- |
| observations           | must exist | 400            | Required         |
| observations.n         | >0         | 400            | positive integer |
| observations.runtimeMs | >0         | 400            | positive number  |
| judge0Token            | valid UUID | 400            | format check     |

---

# 9. Error Model

| Field     | Type   | Required | Nullable | Description            |
| --------- | ------ | -------- | -------- | ---------------------- |
| error     | object | Yes      | No       | Error wrapper          |
| code      | string | Yes      | No       | Error identifier       |
| message   | string | Yes      | No       | Human readable message |
| requestId | string | Yes      | No       | Trace identifier       |

Example Validation Error

```json
{
  "error": {
    "code": "INVALID_OBSERVATIONS",
    "message": "runtimeMs must be greater than zero",
    "requestId": "req_321"
  }
}
```

Example Server Error

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected server error",
    "requestId": "req_891"
  }
}
```

---

# 10. Pagination / Filtering / Sorting

Not applicable.

---

# 11. CRUD Workflow Examples

### Create Analysis

Request

```json
{
  "judge0Token": "abc123",
  "observations": [
    {"n":2,"runtimeMs":0.4},
    {"n":4,"runtimeMs":0.9}
  ]
}
```

Response

```json
{
  "complexityClass": "O(n)",
  "meta": {
    "requestId": "req_100"
  }
}
```

Retrieve, Update, Delete are not implemented.

---

# 12. Testability and Contract Notes

| Area                | Recommendation                      |
| ------------------- | ----------------------------------- |
| Contract testing    | Validate JSON schema                |
| Unit testing        | Validate request validation         |
| Integration testing | Test inference service connectivity |
| E2E testing         | Full Judge0 → API flow              |
| Fixtures            | Benchmark observation datasets      |
| Mocking             | Mock inference service              |
| Seed data           | Known complexity benchmarks         |
| Idempotency testing | Repeat same payload                 |
| Pagination testing  | Not applicable                      |
| Error path testing  | Validate all error codes            |

Core API guarantees:

* Deterministic classification for identical input
* Observations validated before inference
* Internal model details never exposed
* Stable response schema

---

# 13. OpenAPI 3.1 Skeleton

```yaml
openapi: 3.1.0
info:
  title: Complexity Analysis API
  version: 1.0.0
servers:
  - url: /api
paths:
  /analysis/big-o:
    post:
      summary: Classify algorithm complexity
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AnalyzeBigORequest'
      responses:
        '200':
          description: Classification result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AnalyzeBigOResponse'
components:
  schemas:
    AnalyzeBigORequest:
      type: object
      properties:
        judge0Token:
          type: string
        observations:
          type: array
          items:
            $ref: '#/components/schemas/Observation'
    Observation:
      type: object
      properties:
        n:
          type: number
        runtimeMs:
          type: number
    AnalyzeBigOResponse:
      type: object
      properties:
        complexityClass:
          type: string
        meta:
          type: object
          properties:
            requestId:
              type: string
```
