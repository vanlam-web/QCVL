# Quy Æ°á»›c phÃ¡t triá»ƒn Backend QC-OMS

TuÃ¢n theo [DOCUMENT_RULES.md](../DOCUMENT_RULES.md), [ARCHITECTURE.md](../ARCHITECTURE.md) vÃ  [_RULES.md](./_RULES.md).

## 1. Pháº¡m vi

Backend chá»‰ hiá»‡n thá»±c nghiá»‡p vá»¥ Ä‘Ã£ Ä‘Æ°á»£c xÃ¡c Ä‘á»‹nh táº¡i 03-BUSINESS vÃ  cáº¥u trÃºc dá»¯ liá»‡u táº¡i 04-DATABASE. KhÃ´ng tá»± táº¡o Business Rule hoáº·c Database Schema má»›i.

## 2. API

- DÃ¹ng REST API vá»›i prefix `/api/v1/`.
- Resource dÃ¹ng danh tá»« sá»‘ nhiá»u, vÃ­ dá»¥ `/api/v1/orders`.
- API thay Ä‘á»•i khÃ´ng tÆ°Æ¡ng thÃ­ch pháº£i dÃ¹ng version má»›i; khÃ´ng phÃ¡ API cÅ© khi chÆ°a cÃ³ káº¿ hoáº¡ch ngá»«ng há»— trá»£.
- Frontend chá»‰ dÃ¹ng QCVL Node API SDK trá»±c tiáº¿p cho Auth vÃ  Realtime subscription.
- Dá»¯ liá»‡u nghiá»‡p vá»¥ pháº£i Ä‘á»c/ghi qua `/api/v1`; UI khÃ´ng gá»i trá»±c tiáº¿p `direct database access`, RPC hoáº·c Admin API.
- Realtime chá»‰ phÃ¡t tÃ­n hiá»‡u/tráº¡ng thÃ¡i sau khi dá»¯ liá»‡u Ä‘Ã£ Ä‘Æ°á»£c ghi thÃ nh cÃ´ng; khÃ´ng thay tháº¿ API command.

VÃ­ dá»¥:

```text
GET    /api/v1/orders
POST   /api/v1/orders
PUT    /api/v1/orders/{id}
DELETE /api/v1/orders/{id}
```

## 3. Request vÃ  Response

- Backend pháº£i validate toÃ n bá»™ input; validation Frontend chá»‰ phá»¥c vá»¥ UX.
- KhÃ´ng tin dá»¯ liá»‡u, quyá»n hoáº·c tráº¡ng thÃ¡i do Client gá»­i lÃªn.

Response thÃ nh cÃ´ng:

```json
{"success": true, "data": {}, "message": "", "trace_id": ""}
```

Response lá»—i:

```json
{"success": false, "code": "", "message": "", "trace_id": ""}
```

KhÃ´ng tráº£ stack trace hoáº·c lá»—i há»‡ thá»‘ng trá»±c tiáº¿p cho Client.

## 4. Authentication vÃ  Permission

- Má»i API cáº§n xÃ¡c Ä‘á»‹nh rÃµ yÃªu cáº§u Authentication, Authorization vÃ  Permission.
- Quyá»n pháº£i Ä‘Æ°á»£c kiá»ƒm tra táº¡i Backend, khÃ´ng phá»¥ thuá»™c viá»‡c Frontend cÃ³ áº©n nÃºt hay khÃ´ng.
- Ãp dá»¥ng nguyÃªn táº¯c quyá»n tá»‘i thiá»ƒu.

## 5. Use Case vÃ  Transaction

- Má»™t Use Case nghiá»‡p vá»¥ tÆ°Æ¡ng á»©ng má»™t workflow thá»±c thi rÃµ rÃ ng.
- KhÃ´ng gá»™p cÃ¡c nghiá»‡p vá»¥ Ä‘á»™c láº­p chá»‰ Ä‘á»ƒ tÃ¡i sá»­ dá»¥ng endpoint.
- Thao tÃ¡c ghi nhiá»u báº£ng liÃªn quan pháº£i dÃ¹ng transaction phÃ¹ há»£p.
- KhÃ´ng Ä‘á»ƒ dá»¯ liá»‡u á»Ÿ tráº¡ng thÃ¡i trung gian cÃ³ thá»ƒ quan sÃ¡t Ä‘Æ°á»£c.

## 6. Event vÃ  Idempotency

- Event Handler pháº£i cháº¡y láº¡i an toÃ n khi cÃ³ kháº£ nÄƒng nháº­n láº¡i sá»± kiá»‡n.
- CÃ¡c thao tÃ¡c retry pháº£i cÃ³ idempotency key hoáº·c cÆ¡ cháº¿ chá»‘ng trÃ¹ng tÆ°Æ¡ng Ä‘Æ°Æ¡ng.
- TÃªn event dÃ¹ng quÃ¡ khá»©, vÃ­ dá»¥ `OrderCreated`.

## 7. Error vÃ  Logging

- Lá»—i nghiá»‡p vá»¥ pháº£i cÃ³ error code á»•n Ä‘á»‹nh, message phÃ¹ há»£p vÃ  trace ID.
- Ghi log cÃ¡c thao tÃ¡c quan trá»ng nhÆ° Ä‘Äƒng nháº­p, táº¡o/sá»­a/há»§y Ä‘Æ¡n vÃ  thanh toÃ¡n.
- KhÃ´ng ghi password, token, secret hoáº·c dá»¯ liá»‡u nháº¡y cáº£m khÃ´ng cáº§n thiáº¿t.
- Backend Ä‘á»‹nh nghÄ©a log vÃ  metric phÃ¡t ra; 07-DEPLOYMENT sá»Ÿ há»¯u thu tháº­p, lÆ°u giá»¯, dashboard vÃ  cáº£nh bÃ¡o.

## 8. Naming

```text
Service:    OrderService
Use Case:   CreateOrder
Permission: order.create
Event:      OrderCreated
```

TÃªn pháº£i pháº£n Ã¡nh Ä‘Ãºng domain vÃ  hÃ nh Ä‘á»™ng, trÃ¡nh viáº¿t táº¯t khÃ´ng cÃ³ quy Æ°á»›c.

## 9. Source of Truth

- Business Rule: 03-BUSINESS.
- Database Structure: 04-DATABASE.
- Backend workflow vÃ  API: 05-BACKEND.
- Káº¿t ná»‘i há»‡ thá»‘ng ngoÃ i: 06-INTEGRATION.
- Háº¡ táº§ng vÃ  váº­n hÃ nh: 07-DEPLOYMENT.

Khi cÃ³ mÃ¢u thuáº«n, Ã¡p dá»¥ng thá»© tá»± táº¡i [DOCUMENT_RULES.md](../DOCUMENT_RULES.md).
