# POS Roll/Sheet Reconciliation Design

> **Date:** 2026-07-08
> **Status:** Approved business direction from Owner conversation.
> **Scope:** POS checkout, roll/sheet material assignment, production-machine matching, and cart validation behavior.

---

## 1. Owner Decisions

### 1.1. Sell first, reconcile material later

POS must not block checkout only because the cashier does not yet know which physical roll or sheet will be used.

Two operating flows are valid:

| Flow | Business rule |
|---|---|
| Print/produce first, enter bill later | Staff may know the real roll/sheet/width and can assign it immediately or after bill creation. |
| Enter bill first, print/produce later | Bill is created before the actual roll/sheet is known. Later production-machine data can suggest the matching width/object for reconciliation. |

### 1.2. One bill line maps to one physical object

One bill line can be assigned to at most one roll/sheet object.

If a sale uses multiple rolls/sheets, staff should split it into multiple bill lines. One bill can contain many lines and therefore many objects.

### 1.3. Negative stock is allowed

Insufficient total stock, insufficient physical roll/sheet stock, and missing object assignment are not blocking errors.

The system may show warnings and may record negative stock or pending reconciliation state.

### 1.4. Quotes do not reserve objects

Quotes store product, dimensions, quantity, price, and notes. Quotes do not reserve or assign physical roll/sheet objects.

Object assignment happens on invoice checkout or later reconciliation.

### 1.5. Old invoices are not backfilled by default

Invoices created before this rule do not require automatic backfill.

Backfill/reassignment is only done when there is enough real-world data and staff intentionally reconciles it.

### 1.6. Retail customer debt note stays blocking

If no customer is selected, checkout resolves to `KH000001 - Khach le`.

The only confirmed blocking rule in this area is: if the invoice has debt under the retail customer, staff must enter a debt note so the shop can identify the debtor later.

### 1.7. Combo/BOM deduction stays component-based

Combo products deduct BOM components, not the combo SKU itself.

---

## 2. Required Behavior

### 2.1. POS checkout

- Allows checkout for roll/sheet lines without a physical object.
- Allows checkout when stock is insufficient or negative.
- Stores invoice line snapshots.
- Marks roll/sheet lines without object assignment as pending material reconciliation.
- Returns warnings for missing object/negative stock, but does not block checkout.

### 2.2. Cart validation

`/pos/cart/validate` should be treated as soft validation.

It may return hard errors only for data that cannot be interpreted or saved as a business document. Inventory shortage, negative stock, and missing roll/sheet object should be warnings.

### 2.3. Production reconciliation

When production-machine data arrives after the bill, the system may propose a matching roll/sheet based on width, dimensions, time, file/customer hints, and available objects.

The system must not silently mutate confirmed stock assignment from machine data alone. Staff confirmation is required in MVP.

---

## 3. Implementation Implications
