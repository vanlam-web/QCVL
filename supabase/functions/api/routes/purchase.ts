import type { FoundationRepository } from "../contracts.ts";
import { ApiError, successResponse } from "../http.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  createPurchaseReceipt,
  createSupplier,
  getPurchaseReceipt,
  getSupplier,
  listSupplierPayableReceipts,
  listPurchaseReceipts,
  listSuppliers,
  paySupplier,
  postPurchaseReceipt,
  updatePurchaseReceipt,
  updateSupplier,
} from "../use-cases/purchase.ts";

export interface PurchaseRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
}

export async function handlePurchase(
  request: Request,
  traceId: string,
  dependencies: PurchaseRouteDependencies,
): Promise<Response> {
  const authUser = await requireAuth(request, dependencies.auth);
  const currentUser = await dependencies.repository.getCurrentUser({
    userId: authUser.id,
    email: authUser.email,
    workstationId: null,
  });
  if (currentUser === null) {
    throw new ApiError({ status: 403, code: "ACCOUNT_INACTIVE", message: "Account is inactive." });
  }

  const context = {
    organizationId: currentUser.organization.id,
    actorUserId: currentUser.user.id,
    permissions: currentUser.permissions,
  };
  const url = new URL(request.url);

  if (url.pathname === "/api/v1/purchase/receipts") {
    if (request.method === "GET") {
      return successResponse(await listPurchaseReceipts(dependencies.repository, context, url), traceId);
    }
    if (request.method === "POST") {
      return successResponse(
        await createPurchaseReceipt(dependencies.repository, context, await request.json()),
        traceId,
        { status: 201 },
      );
    }
    throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
  }

  const purchaseReceiptActionMatch = url.pathname.match(/^\/api\/v1\/purchase\/receipts\/([^/]+)\/(post|cancel)$/);
  if (purchaseReceiptActionMatch !== null) {
    if (request.method !== "POST") {
      throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
    }
    if (purchaseReceiptActionMatch[2] === "post") {
      return successResponse(
        await postPurchaseReceipt(
          dependencies.repository,
          context,
          purchaseReceiptActionMatch[1],
          await request.json().catch(() => ({})),
        ),
        traceId,
      );
    }
    throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Purchase receipt cancel is not enabled in P3." });
  }

  const purchaseReceiptMatch = url.pathname.match(/^\/api\/v1\/purchase\/receipts\/([^/]+)$/);
  if (purchaseReceiptMatch !== null) {
    if (request.method === "GET") {
      return successResponse(await getPurchaseReceipt(dependencies.repository, context, purchaseReceiptMatch[1]), traceId);
    }
    if (request.method === "PATCH") {
      return successResponse(
        await updatePurchaseReceipt(dependencies.repository, context, purchaseReceiptMatch[1], await request.json()),
        traceId,
      );
    }
    throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
  }

  if (url.pathname === "/api/v1/suppliers") {
    if (request.method === "GET") {
      return successResponse(await listSuppliers(dependencies.repository, context, url), traceId);
    }
    if (request.method === "POST") {
      return successResponse(
        await createSupplier(dependencies.repository, context, await request.json()),
        traceId,
        { status: 201 },
      );
    }
    throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
  }

  const supplierPayableReceiptsMatch = url.pathname.match(/^\/api\/v1\/suppliers\/([^/]+)\/payable-receipts$/);
  if (supplierPayableReceiptsMatch !== null) {
    if (request.method === "GET") {
      return successResponse(
        await listSupplierPayableReceipts(dependencies.repository, context, supplierPayableReceiptsMatch[1]),
        traceId,
      );
    }
    throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
  }

  const supplierPaymentsMatch = url.pathname.match(/^\/api\/v1\/suppliers\/([^/]+)\/payments$/);
  if (supplierPaymentsMatch !== null) {
    if (request.method === "POST") {
      return successResponse(
        await paySupplier(dependencies.repository, context, supplierPaymentsMatch[1], await request.json()),
        traceId,
        { status: 201 },
      );
    }
    throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
  }

  const supplierMatch = url.pathname.match(/^\/api\/v1\/suppliers\/([^/]+)$/);
  if (supplierMatch !== null) {
    if (request.method === "GET") {
      return successResponse(await getSupplier(dependencies.repository, context, supplierMatch[1]), traceId);
    }
    if (request.method === "PATCH") {
      return successResponse(
        await updateSupplier(dependencies.repository, context, supplierMatch[1], await request.json()),
        traceId,
      );
    }
    throw new ApiError({ status: 405, code: "METHOD_NOT_ALLOWED", message: "Method not allowed." });
  }

  throw new ApiError({ status: 404, code: "RESOURCE_NOT_FOUND", message: "Route not found." });
}
