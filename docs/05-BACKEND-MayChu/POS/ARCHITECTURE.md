# ARCHITECTURE â€” Kiáº¿n trÃºc State Manager & Data Safety

> **Nguá»“n:** Di chuyá»ƒn tá»« `02-PRD-UX-PhongCanh/POS/01-POS-LAYOUT.md` (Section V) vÃ  `02-PRD-UX-PhongCanh/POS/K01/01c-K01-ARCH-SAFETY.md` (Section V.1â€“V.3)

---

## 1. KIáº¾N TRÃšC STATE MANAGER (POS STORE)

### 1.1. NguyÃªn táº¯c cá»‘t lÃµi

UI component **chá»‰ lÃ m 2 viá»‡c:**
1. Hiá»ƒn thá»‹ state tá»« Store (qua selector / derived).
2. PhÃ¡t lá»‡nh báº±ng cÃ¡ch gá»i Action tá»« Store â€” khÃ´ng tá»± tÃ­nh, khÃ´ng tá»± gá»i API.

Component UI **TUYá»†T Äá»I KHÃ”NG** viáº¿t trá»±c tiáº¿p trong `.tsx` / `.svelte`:

- TÃ­nh toÃ¡n nghiá»‡p vá»¥: `mÂ² = R Ã— D Ã— SL`, `ThÃ nh tiá»n = mÂ² Ã— ÄÆ¡n giÃ¡`
- Thao tÃ¡c máº£ng giá» hÃ ng: `cart.push()`, `cart.find()`, `cart.reduce()`
- Gá»i dá»¯ liá»‡u nghiá»‡p vá»¥ trá»±c tiáº¿p: `direct database access`, `direct database access`
- ÄÄƒng kÃ½ Realtime trá»±c tiáº¿p trong component thay vÃ¬ qua lá»›p `lib/realtime`
- Sinh bill text: template Zalo, format tiá»n
- Validation: check SÄT rá»—ng, check giá» rá»—ng trÆ°á»›c thanh toÃ¡n

### 1.2. State táº­p trung trong Store

| VÃ¹ng state | Vai trÃ² | Action Ä‘i kÃ¨m |
|---|---|---|
| **Tabs** | Danh sÃ¡ch tab Ä‘ang má»Ÿ, tab active, cuá»™n ngang | `addTab()`, `closeTab(id)`, `setActiveTab(id)`, `scrollTabs(dir)` |
| **Cart** | Máº£ng dÃ²ng sáº£n pháº©m tá»«ng tab, focus row | `addRow()`, `updateRow()`, `removeRow()`, `selectRow()` |
| **Order note** | Ghi chÃº tá»•ng tab active | `setNote(text)` |
| **Customer** | KH Ä‘ang chá»n, báº£ng giÃ¡, % chiáº¿t kháº¥u | `setCustomer(id)`, `clearCustomer()`, `setPriceList(id)` |
| **Toast** | Tráº¡ng thÃ¡i hiá»ƒn thá»‹ Toast | `showMissingPhoneToast()`, `hideToast()` |
| **Production queue** | Danh sÃ¡ch file mÃ¡y sáº£n xuáº¥t Ä‘ang chá» K02-D | `enqueueFile()`, `removeFromQueue()` |
| **Connection** | Realtime: Connected / Connecting / Disconnected | `setConnection(state)` |
| **Active user** | Há»“ sÆ¡ nhÃ¢n viÃªn Ä‘ang Ä‘Äƒng nháº­p + `user_id` session | `setUser(profile)` |

### 1.3. Pattern chuáº©n

**Hiá»ƒn thá»‹:**

```ts
// SAI â€” logic náº·ng inline trong component
function K02A_Row({ row }) {
  const total = row.r * row.d * row.sl
  return <div>{total} mÂ²</div>
}

// ÄÃšNG â€” UI chá»‰ Ä‘á»c state Ä‘Ã£ Ä‘Æ°á»£c Store tÃ­nh sáºµn
function K02A_Row({ row }) {
  return <div>{row.totalArea} mÂ²</div>
}
```

**TÆ°Æ¡ng tÃ¡c:**

```ts
// SAI â€” component tá»± mutate state
<input onChange={e => cart.push({ ...row, sl: e.target.value })} />

// ÄÃšNG â€” component phÃ¡t action, Store lo tÃ­nh toÃ¡n
<input onChange={e => posStore.updateRow(row.id, { sl: e.target.value })} />
```

### 1.4. RÃ ng buá»™c

| RÃ ng buá»™c | Chi tiáº¿t |
|---|---|
| Component â‰¤ 200 dÃ²ng | Trá»« K02-A cÃ³ nhiá»u row |
| KhÃ´ng import QCVL Node API data client trong UI | Dá»¯ liá»‡u nghiá»‡p vá»¥ chá»‰ Ä‘i qua API Client; QCVL Node API SDK chá»‰ dÃ¹ng táº¡i lá»›p Auth/Realtime |
| CÃ´ng thá»©c tÃ­nh Ä‘áº·t táº¡i `lib/pos/calc.ts` | `mÂ²`, `ThÃ nh tiá»n`, `Tiá»n thá»«a` |
| Action trong Store pháº£i **pure** | Hoáº·c cÃ³ doc rÃµ side-effect |

### 1.5. Cáº¥u trÃºc thÆ° má»¥c

```
src/
â”œâ”€â”€ stores/
â”‚   â””â”€â”€ posStore.ts          â† State táº­p trung + Actions
â”œâ”€â”€ lib/pos/
â”‚   â”œâ”€â”€ calc.ts              â† CÃ´ng thá»©c tÃ­nh (mÂ², tiá»n, bill)
â”‚   â”œâ”€â”€ api.ts               â† API Client gá»i /api/v1
â”‚   â”œâ”€â”€ realtime.ts          â† QCVL Node API Realtime subscriptions
â”‚   â””â”€â”€ types.ts             â† TypeScript types cho Row, Tab, Customer
â”œâ”€â”€ lib/auth/
â”‚   â””â”€â”€ QCVL Node API.ts          â† QCVL Node API Auth client
â””â”€â”€ components/pos/
    â”œâ”€â”€ K01/
    â”œâ”€â”€ K02/
    â””â”€â”€ K03/
```

---

## 2. PERSISTENCE â€” LÆ¯U TRá»® LOCAL (CHá»NG Sáº¬P NGUá»’N)

### 2.1. Pháº¡m vi lÆ°u trá»¯ LocalStorage

> Database reference: `04-DATABASE/Sales/POS-TABLES.md`

Khi Store thay Ä‘á»•i (debounce 300ms), ghi xuá»‘ng LocalStorage (key: `pos.session.v1`):

| VÃ¹ng dá»¯ liá»‡u | Ghi chÃº |
|---|---|
| Danh sÃ¡ch tab Ä‘ang má»Ÿ | KÃ¨m thá»© tá»±, tab active |
| Tráº¡ng thÃ¡i tá»«ng tab | `Active` / `Dirty` (Ä‘Ã£ cÃ³ hÃ ng chÆ°a thanh toÃ¡n) |
| ToÃ n bá»™ dÃ²ng sáº£n pháº©m trong giá» tá»«ng tab | Rá»™ng / DÃ i / SL / ÄÆ¡n giÃ¡ / ThÃ nh tiá»n |
| Ghi chÃº Ä‘Æ¡n hÃ ng (K02-B) | Theo tá»«ng tab |
| Äá»‘i tÃ¡c Ä‘ang chá»n + báº£ng giÃ¡ (K03-A) | Theo tá»«ng tab |

### 2.2. VÃ²ng Ä‘á»i dá»¯ liá»‡u

```
Báº¥t ká»³ thay Ä‘á»•i nÃ o trong Store (addRow, setNote, setCustomer...)
    â†“ (Debounce 300ms)
Ghi xuá»‘ng LocalStorage (key: pos.session.v1)
    â†“
Sáº­p nguá»“n / F5 / ÄÃ³ng tab trÃ¬nh duyá»‡t â†’ Dá»¯ liá»‡u váº«n cÃ²n nguyÃªn
    â†“
Khá»Ÿi Ä‘á»™ng láº¡i POS â†’ Äá»c LocalStorage â†’ Dá»±ng láº¡i nguyÃªn tráº¡ng thÃ¡i lÃ m viá»‡c
    â†“
Dá»¯ liá»‡u CHá»ˆ bá»‹ xÃ³a sáº¡ch khá»i LocalStorage khi:
    (a) Báº¥m [Thanh toÃ¡n] thÃ nh cÃ´ng (F9), HOáº¶C
    (b) NhÃ¢n viÃªn chá»§ Ä‘á»™ng báº¥m [X] Ä‘Ã³ng tab
```

### 2.3. LÆ°u Ã½ an toÃ n

- KhÃ´ng lÆ°u thÃ´ng tin nháº¡y cáº£m (máº­t kháº©u, token bÃ­ máº­t) â€” chá»‰ lÆ°u state lÃ m viá»‡c.
- Khi version schema thay Ä‘á»•i, Ã©p key `pos.session.v1` â†’ `v2` Ä‘á»ƒ trÃ¡nh crash do dá»¯ liá»‡u cÅ©.

---

## 3. CONCURRENCY LOCK â€” KHÃ“A ÄÆ N TRANH CHáº¤P

### 3.1. Trigger

Khi nhÃ¢n viÃªn má»Ÿ Ä‘Æ¡n hÃ ng cÅ© Ä‘á»ƒ cáº­p nháº­t (`Update_HD010664`) â€” Tab khá»Ÿi táº¡o thÃ nh cÃ´ng â†’ **ngay láº­p tá»©c** gá»i RPC.

### 3.2. Workflow

```
NhÃ¢n viÃªn click [Sá»­a] HD010664
    â†“
Tab má»›i Ä‘Æ°á»£c sinh ra trÃªn POS
    â†“
Ngay láº­p tá»©c gá»i: POST /api/v1/orders/HD010664/lock
    â†“
Server ghi cá» locked_by + locked_at vÃ o báº£ng orders
    â†“
Realtime push xuá»‘ng mÃ n hÃ¬nh/mÃ¡y sáº£n xuáº¥t liÃªn quan
    â†“
MÃ n hÃ¬nh xÆ°á»Ÿng hiá»ƒn thá»‹: [ðŸ”’ Äang thanh toÃ¡n táº¡i quáº§y]
    â†“
ToÃ n bá»™ nÃºt báº¥m chá»‰nh sá»­a cá»§a thá»£ in/cáº¯t bá»‹ vÃ´ hiá»‡u hÃ³a
```

### 3.3. Giáº£i phÃ³ng khÃ³a

| TÃ¬nh huá»‘ng | HÃ nh Ä‘á»™ng |
|---|---|
| ÄÆ¡n hoÃ n thÃ nh (báº¥m [Thanh toÃ¡n] thÃ nh cÃ´ng) | Gá»i RPC `unlock_order(order_id)` |
| Tab POS bá»‹ Ä‘Ã³ng (báº¥m [X] trÃªn tab) | Gá»i RPC `unlock_order(order_id)` |
| Tab POS bá»‹ Ä‘Ã³ng do refresh/timeout | TTL lock tá»± háº¿t háº¡n â€” **30 phÃºt** |

### 3.4. RÃ ng buá»™c

Trong suá»‘t thá»i gian giá»¯ khÃ³a, há»‡ thá»‘ng pháº£i kiá»ƒm tra lock cÃ²n hiá»‡u lá»±c trÆ°á»›c khi cho lÆ°u. Náº¿u máº¥t khÃ³a giá»¯a chá»«ng (do tab khÃ¡c giÃ nh quyá»n), hiá»ƒn thá»‹ cáº£nh bÃ¡o vÃ  tá»« chá»‘i ghi.

---

## 4. TAB OVERFLOW â€” Xá»¬ LÃ TRÃ€N Dáº¢I TAB

### 4.1. PhÃ¡t hiá»‡n trÃ n

Khi tá»•ng chiá»u rá»™ng cÃ¡c tab `>` chiá»u rá»™ng vÃ¹ng hiá»ƒn thá»‹ kháº£ dá»¥ng â†’ kÃ­ch hoáº¡t cháº¿ Ä‘á»™ cuá»™n ngang.

### 4.2. CÆ¡ cháº¿ Ä‘iá»u phá»‘i

| ThÃ nh pháº§n | Vá»‹ trÃ­ | HÃ nh vi |
|---|---|---|
| NÃºt `[â—€]` | Äáº§u trÃ¡i dáº£i tab | Click â†’ cuá»™n sang trÃ¡i 1 tab (snap). áº¨n/má» 50% + disabled náº¿u Ä‘Ã£ á»Ÿ Ä‘áº§u |
| NÃºt `[â–¶]` | Cuá»‘i pháº£i dáº£i tab | Click â†’ cuá»™n sang pháº£i 1 tab (snap). áº¨n/má» 50% + disabled náº¿u Ä‘Ã£ á»Ÿ cuá»‘i |
| Cuá»™n chuá»™t | RÃª chuá»™t vÃ o dáº£i tab | `wheel` â†’ cuá»™n ngang (deltaY mapped sang scrollLeft) |
| Auto-scroll | Tá»± Ä‘á»™ng | Tab Active (hoáº·c tab vá»«a táº¡o) luÃ´n Ä‘Æ°á»£c cuá»™n vÃ o vÃ¹ng nhÃ¬n tháº¥y |

### 4.3. Quy táº¯c lÆ°u trá»¯

- Vá»‹ trÃ­ cuá»™n hiá»‡n táº¡i cá»§a dáº£i tab **khÃ´ng cáº§n lÆ°u** vÃ o LocalStorage (khÃ´ng cÃ³ key trong Â§2) â€” khi khá»Ÿi Ä‘á»™ng láº¡i POS, tab active sáº½ Ä‘Æ°á»£c auto-scroll vÃ o view.
- NÃºt `[+]` **luÃ´n hiá»ƒn thá»‹** á»Ÿ cuá»‘i dáº£i, khÃ´ng bá»‹ che bá»Ÿi nÃºt `[â–¶]`.

---

â† [Quay vá» POS README](./README.md)
