import type { FoundationRepository } from "../contracts.ts";
import { ApiError, successResponse } from "../http.ts";
import type { AuthClient } from "../middleware/auth.ts";
import { requireAuth } from "../middleware/auth.ts";
import {
  createCustomer,
  createCustomerGroup,
  createPriceList,
  createProduct,
  createProductGroup,
  deletePriceListItem,
  applyPriceFormula,
  getProductBom,
  listCustomerGroups,
  listCustomers,
  listPriceLists,
  listProductGroups,
  listProducts,
  previewPriceFormula,
  resolvePrices,
  saveProductBom,
  updateCustomer,
  updateCustomerGroup,
  updatePriceList,
  updateProduct,
  upsertPriceListItem,
} from "../use-cases/catalog.ts";

export interface CatalogRouteDependencies {
  auth: AuthClient;
  repository: FoundationRepository;
}

export async function handleCatalog(
  request: Request,
  traceId: string,
  dependencies: CatalogRouteDependencies,
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
    actorUserId: currentUser.user.id,
    organizationId: currentUser.organization.id,
    permissions: currentUser.permissions,
  };
  const url = new URL(request.url);

  if (url.pathname === "/api/v1/products") {
    if (request.method === "GET") {
      return successResponse(await listProducts(dependencies.repository, context, url), traceId);
    }
    if (request.method === "POST") {
      return successResponse(
        await createProduct(dependencies.repository, context, await request.json()),
        traceId,
        { status: 201 },
      );
    }
  }

  if (url.pathname === "/api/v1/product-groups") {
    if (request.method === "GET") {
      return successResponse(await listProductGroups(dependencies.repository, context, url), traceId);
    }
    if (request.method === "POST") {
      return successResponse(
        await createProductGroup(dependencies.repository, context, await request.json()),
        traceId,
        { status: 201 },
      );
    }
  }

  if (url.pathname === "/api/v1/customers") {
    if (request.method === "GET") {
      return successResponse(await listCustomers(dependencies.repository, context, url), traceId);
    }
    if (request.method === "POST") {
      return successResponse(
        await createCustomer(dependencies.repository, context, await request.json()),
        traceId,
        { status: 201 },
      );
    }
  }

  const customerMatch = url.pathname.match(/^\/api\/v1\/customers\/([^/]+)$/);
  if (customerMatch !== null && request.method === "PATCH") {
    return successResponse(
      await updateCustomer(dependencies.repository, context, customerMatch[1], await request.json()),
      traceId,
    );
  }

  if (url.pathname === "/api/v1/customer-groups") {
    if (request.method === "GET") {
      return successResponse(await listCustomerGroups(dependencies.repository, context, url), traceId);
    }
    if (request.method === "POST") {
      return successResponse(
        await createCustomerGroup(dependencies.repository, context, await request.json()),
        traceId,
        { status: 201 },
      );
    }
  }

  const customerGroupMatch = url.pathname.match(/^\/api\/v1\/customer-groups\/([^/]+)$/);
  if (customerGroupMatch !== null && request.method === "PATCH") {
    return successResponse(
      await updateCustomerGroup(dependencies.repository, context, customerGroupMatch[1], await request.json()),
      traceId,
    );
  }

  const productMatch = url.pathname.match(/^\/api\/v1\/products\/([^/]+)$/);
  const productBomMatch = url.pathname.match(/^\/api\/v1\/products\/([^/]+)\/bom$/);
  if (productBomMatch !== null) {
    if (request.method === "GET") {
      return successResponse(await getProductBom(dependencies.repository, context, productBomMatch[1]), traceId);
    }
    if (request.method === "POST" || request.method === "PUT") {
      return successResponse(
        await saveProductBom(dependencies.repository, context, productBomMatch[1], await request.json()),
        traceId,
        { status: 201 },
      );
    }
  }

  if (productMatch !== null && request.method === "PATCH") {
    return successResponse(
      await updateProduct(dependencies.repository, context, productMatch[1], await request.json()),
      traceId,
    );
  }

  if (url.pathname === "/api/v1/price-lists") {
    if (request.method === "GET") {
      return successResponse(await listPriceLists(dependencies.repository, context, url), traceId);
    }
    if (request.method === "POST") {
      return successResponse(
        await createPriceList(dependencies.repository, context, await request.json()),
        traceId,
        { status: 201 },
      );
    }
  }

  if (url.pathname === "/api/v1/price-lists/formulas/preview" && request.method === "POST") {
    return successResponse(await previewPriceFormula(dependencies.repository, context, await request.json()), traceId);
  }

  if (url.pathname === "/api/v1/price-lists/formulas/apply" && request.method === "POST") {
    return successResponse(await applyPriceFormula(dependencies.repository, context, await request.json()), traceId);
  }

  const priceListMatch = url.pathname.match(/^\/api\/v1\/price-lists\/([^/]+)$/);
  if (priceListMatch !== null && request.method === "PATCH") {
    return successResponse(
      await updatePriceList(dependencies.repository, context, priceListMatch[1], await request.json()),
      traceId,
    );
  }

  const priceListItemMatch = url.pathname.match(/^\/api\/v1\/price-lists\/([^/]+)\/items\/([^/]+)$/);
  if (priceListItemMatch !== null) {
    if (request.method === "PUT") {
      return successResponse(
        await upsertPriceListItem(
          dependencies.repository,
          context,
          priceListItemMatch[1],
          priceListItemMatch[2],
          await request.json(),
        ),
        traceId,
      );
    }
    if (request.method === "DELETE") {
      return successResponse(
        await deletePriceListItem(dependencies.repository, context, priceListItemMatch[1], priceListItemMatch[2]),
        traceId,
      );
    }
  }

  if (url.pathname === "/api/v1/pricing/resolve" && request.method === "POST") {
    return successResponse(await resolvePrices(dependencies.repository, context, await request.json()), traceId);
  }

  throw new ApiError({
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "The requested resource was not found.",
  });
}
