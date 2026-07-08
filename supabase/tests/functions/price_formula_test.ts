import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  computeFormulaPrice,
  validatePriceFormula,
} from "../../functions/api/repositories/foundation-repository.ts";

Deno.test("formula rounds final prices up to 1000 VND", () => {
  const result = computeFormulaPrice({
    latestPurchaseCost: 100001,
    costFormula: { type: "amount_plus_percent", amount: 5000, percent_of_latest_purchase_cost: 8 },
    profitFormula: { type: "fixed", amount: 25000 },
    priceListAdjustment: { type: "amount", amount: 20000 },
  });

  assertEquals(result, {
    latest_purchase_cost: 100001,
    cost_amount: 13001,
    profit_amount: 25000,
    adjustment_amount: 20000,
    computed_price: 159000,
  });
});

Deno.test("formula treats missing latest purchase cost as zero", () => {
  const result = computeFormulaPrice({
    latestPurchaseCost: null,
    costFormula: { type: "fixed", amount: 5000 },
    profitFormula: { type: "tiers", tiers: [{ operator: ">", value: 100000, amount: 40000 }] },
    priceListAdjustment: { type: "percent", percent: 10 },
  });

  assertEquals(result.computed_price, 6000);
});

Deno.test("profit tiers are evaluated top-down and gaps are allowed", () => {
  const result = computeFormulaPrice({
    latestPurchaseCost: 150000,
    costFormula: { type: "fixed", amount: 0 },
    profitFormula: {
      type: "tiers",
      tiers: [
        { operator: "<=", value: 100000, amount: 25000 },
        { operator: ">", value: 200000, amount: 60000 },
      ],
    },
    priceListAdjustment: { type: "amount", amount: 0 },
  });

  assertEquals(result.profit_amount, 0);
  assertEquals(result.computed_price, 150000);
});

Deno.test("formula validation blocks obvious overlapping tiers", () => {
  assertThrows(
    () =>
      validatePriceFormula({
        name: "Overlap",
        product_filter: {},
        cost_formula: { type: "fixed", amount: 0 },
        profit_formula: {
          type: "tiers",
          tiers: [
            { operator: "<=", value: 100000, amount: 25000 },
            { operator: "<", value: 120000, amount: 30000 },
          ],
        },
        price_list_adjustments: {},
      }),
    Error,
    "FORMULA_TIER_OVERLAP",
  );
});
