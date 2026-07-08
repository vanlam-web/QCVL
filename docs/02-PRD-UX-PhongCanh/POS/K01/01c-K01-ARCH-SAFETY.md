# 01c-K01-ARCH-SAFETY.md â€” K01: Kiáº¿n TrÃºc & An ToÃ n Dá»¯ Liá»‡u

> **Thuá»™c khá»‘i:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) â€” Má»¥c IV vÃ  V
>
> **Trá»Ÿ vá»:** [01-K01-TOPBAR.md](./01-K01-TOPBAR.md) | [Master Map](../01-POS-LAYOUT.md)

---

## IV. KIáº¾N TRÃšC Dá»® LIá»†U LIÃŠN Káº¾T

| Ná»™i dung liÃªn káº¿t | Má»¥c Ä‘Ã­ch | Chi tiáº¿t |
|---|---|---|
| Há»“ sÆ¡ ngÆ°á»i dÃ¹ng | Láº¥y thÃ´ng tin nhÃ¢n viÃªn session | [â†’ POS-TABLES.md Â§3](../../../04-DATABASE/Sales/POS-TABLES.md#3-báº£ng-authusers--ngÆ°á»i-dÃ¹ng-QCVL Node API-auth) |
| Danh má»¥c sáº£n pháº©m | Gá»i danh sÃ¡ch sáº£n pháº©m F3 | [â†’ POS-TABLES.md Â§4](../../../04-DATABASE/Sales/POS-TABLES.md#4-báº£ng-publicproducts--sáº£n-pháº©m) |
| HÃ ng Ä‘á»£i mÃ¡y sáº£n xuáº¥t | Láº¯ng nghe sá»± kiá»‡n mÃ¡y sáº£n xuáº¥t â†’ K02-D | [â†’ POS-TABLES.md Â§11](../../../04-DATABASE/Sales/POS-TABLES.md#11-ranh-giá»›i-production-queue) |

---

## V. QUY Táº®C KHÃ“A Lá»–I VÃ€ AN TOÃ€N Dá»® LIá»†U (EDGE CASES & SAFETY)

| Ná»™i dung | Chi tiáº¿t |
|---|---|
| LocalStorage persistence, debounce 300ms, key `pos.session.v1` | [â†’ ARCHITECTURE.md Â§2](../../../05-BACKEND-MayChu/POS/ARCHITECTURE.md#2-persistence--lÆ°u-trá»¯-local-chá»‘ng-sáº­p-nguá»“n) |
| KhÃ³a tranh cháº¥p khi nhiá»u ngÆ°á»i cÃ¹ng sá»­a Ä‘Æ¡n | [â†’ ARCHITECTURE.md Â§3](../../../05-BACKEND-MayChu/POS/ARCHITECTURE.md#3-concurrency-lock--khÃ³a-Ä‘Æ¡n-tranh-cháº¥p) |
| Tab scroll, quy táº¯c khÃ´ng lÆ°u scroll position | [â†’ ARCHITECTURE.md Â§4](../../../05-BACKEND-MayChu/POS/ARCHITECTURE.md#4-tab-overflow--xá»­-lÃ½-trÃ n-dáº£i-tab) |

> Logic thá»±c thi chi tiáº¿t thuá»™c táº§ng Backend / code triá»ƒn khai.

---

â† [01-K01-TOPBAR.md](./01-K01-TOPBAR.md)
