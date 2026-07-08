import { createApp } from "../../functions/api/app.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertMatch(actual: string, expected: RegExp): void {
  if (!expected.test(actual)) {
    throw new Error(`Expected ${actual} to match ${expected}`);
  }
}

Deno.test("GET /api/v1/health returns the standard success envelope", async () => {
  const response = await createApp({ version: "test-sha" })(
    new Request("http://local/api/v1/health"),
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data, {
    status: "ok",
    service: "qc-oms-api",
    version: "test-sha",
  });
  assertMatch(body.trace_id, /^[0-9a-f-]{36}$/);
  assertEquals(response.headers.get("x-request-id"), body.trace_id);
});

Deno.test("server errors log trace id, method, path and safe code", async () => {
  const logs: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args);
  };

  try {
    const response = await createApp({ version: "test-sha" })(
      new Request("http://local/api/v1/me", {
        headers: { "x-request-id": "trace-observe-1" },
      }),
    );
    const body = await response.json();

    assertEquals(response.status, 500);
    assertEquals(body.trace_id, "trace-observe-1");
    assertEquals(response.headers.get("x-request-id"), "trace-observe-1");
    assertEquals(logs.length, 1);
    assertEquals(logs[0][0], "api_error");
    assertEquals(logs[0][1], {
      trace_id: "trace-observe-1",
      method: "GET",
      path: "/api/v1/me",
      status: 500,
      code: "INTERNAL_ERROR",
    });
  } finally {
    console.error = originalError;
  }
});

Deno.test("OPTIONS preflight allows client device header", async () => {
  const response = await createApp({
    version: "test-sha",
    allowedOrigins: ["http://127.0.0.1:3000"],
  })(
    new Request("http://local/api/v1/me", {
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1:3000",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization,content-type,x-request-id,x-client-device-id",
      },
    }),
  );

  assertEquals(response.status, 204);
  assertMatch(response.headers.get("access-control-allow-headers") ?? "", /x-client-device-id/);
});

Deno.test("unsafe request id headers are replaced before response and logs", async () => {
  const logs: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args);
  };

  try {
    const response = await createApp({ version: "test-sha" })(
      new Request("http://local/api/v1/me", {
        headers: { "x-request-id": "trace bad <script>" },
      }),
    );
    const body = await response.json();

    assertEquals(response.status, 500);
    assertMatch(body.trace_id, /^[0-9a-f-]{36}$/);
    assertEquals(response.headers.get("x-request-id"), body.trace_id);
    assertEquals(logs.length, 1);
    assertEquals(logs[0][1], {
      trace_id: body.trace_id,
      method: "GET",
      path: "/api/v1/me",
      status: 500,
      code: "INTERNAL_ERROR",
    });
  } finally {
    console.error = originalError;
  }
});
