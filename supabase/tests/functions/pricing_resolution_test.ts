import { assertEquals } from "jsr:@std/assert@1";
import { resolvePriceRows } from "../../functions/api/repositories/foundation-repository.ts";

Deno.test("price resolution keeps default zero as declared price", () => {
  const items = resolvePriceRows({
    productIds: ["p-1"],
    defaultPriceListId: "pl-default",
    customerPriceListId: null,
    priceRows: [
      { product_id: "p-1", price_list_id: "pl-default", unit_price: 0 },
    ],
    latestPurchaseCosts: new Map(),
  });

  assertEquals(items, [
    {
      product_id: "p-1",
      unit_price: 0,
      price_source: "default_price_list",
      price_list_id: "pl-default",
    },
  ]);
});

Deno.test("price resolution uses missing latest cost source for customer group zero", () => {
  const items = resolvePriceRows({
    productIds: ["p-1"],
    defaultPriceListId: "pl-default",
    customerPriceListId: "pl-group",
    priceRows: [
      { product_id: "p-1", price_list_id: "pl-group", unit_price: 0 },
      { product_id: "p-1", price_list_id: "pl-default", unit_price: 120000 },
    ],
    latestPurchaseCosts: new Map(),
  });

  assertEquals(items, [
    {
      product_id: "p-1",
      unit_price: 0,
      price_source: "latest_purchase_cost_missing_zero",
      price_list_id: "pl-group",
    },
  ]);
});

Deno.test("price resolution falls back to default only when customer group row is missing", () => {
  const items = resolvePriceRows({
    productIds: ["p-1"],
    defaultPriceListId: "pl-default",
    customerPriceListId: "pl-group",
    priceRows: [
      { product_id: "p-1", price_list_id: "pl-default", unit_price: 120000 },
    ],
    latestPurchaseCosts: new Map(),
  });

  assertEquals(items, [
    {
      product_id: "p-1",
      unit_price: 120000,
      price_source: "fallback_default_price_list",
      price_list_id: "pl-default",
    },
  ]);
});

Deno.test("price resolution uses latest purchase cost when group row is zero and cost exists", () => {
  const items = resolvePriceRows({
    productIds: ["p-1"],
    defaultPriceListId: "pl-default",
    customerPriceListId: "pl-group",
    priceRows: [
      { product_id: "p-1", price_list_id: "pl-group", unit_price: 0 },
      { product_id: "p-1", price_list_id: "pl-default", unit_price: 120000 },
    ],
    latestPurchaseCosts: new Map([["p-1", 88000]]),
  });

  assertEquals(items, [
    {
      product_id: "p-1",
      unit_price: 88000,
      price_source: "latest_purchase_cost",
      price_list_id: "pl-group",
    },
  ]);
});

Deno.test("price resolution uses formula mode over manual unit price", () => {
  const items = resolvePriceRows({
    productIds: ["p-1"],
    defaultPriceListId: "pl-default",
    customerPriceListId: null,
    priceRows: [
      {
        product_id: "p-1",
        price_list_id: "pl-default",
        unit_price: null,
        pricing_mode: "formula",
        formula_rule_id: "rule-1",
      },
    ],
    latestPurchaseCosts: new Map([["p-1", 100000]]),
    formulaRules: new Map([[
      "rule-1",
      {
        cost_formula: { type: "fixed", amount: 5000 },
        profit_formula: { type: "fixed", amount: 25000 },
        price_list_adjustments: { "pl-default": { type: "amount", amount: 20000 } },
      },
    ]]),
  });

  assertEquals(items[0].unit_price, 150000);
  assertEquals(items[0].price_source, "price_formula");
});

Deno.test("price resolution uses formula missing cost source when latest purchase cost is absent", () => {
  const items = resolvePriceRows({
    productIds: ["p-1"],
    defaultPriceListId: "pl-default",
    customerPriceListId: null,
    priceRows: [
      {
        product_id: "p-1",
        price_list_id: "pl-default",
        unit_price: null,
        pricing_mode: "formula",
        formula_rule_id: "rule-1",
      },
    ],
    latestPurchaseCosts: new Map(),
    formulaRules: new Map([[
      "rule-1",
      {
        cost_formula: { type: "fixed", amount: 0 },
        profit_formula: { type: "fixed", amount: 0 },
        price_list_adjustments: {},
      },
    ]]),
  });

  assertEquals(items[0].unit_price, 0);
  assertEquals(items[0].price_source, "price_formula_missing_cost_zero");
});
