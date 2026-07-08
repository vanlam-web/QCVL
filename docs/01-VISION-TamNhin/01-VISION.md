# PHáº¦N 1: Táº¦M NHÃŒN & Má»¤C TIÃŠU CHIáº¾N LÆ¯á»¢C

---

## ðŸŽ¯ 1. Táº¦M NHÃŒN PHÃT TRIá»‚N (VISION)

**Hiá»‡n táº¡i:** Há»‡ thá»‘ng quáº£n lÃ½ váº­n hÃ nh ná»™i bá»™ (OMS) chuyÃªn biá»‡t cho xÆ°á»Ÿng quáº£ng cÃ¡o VÄƒn LÃ¢m, Ä‘á»“ng bá»™ Realtime tá»« mÃ¡y sáº£n xuáº¥t Ä‘áº¿n quáº§y thu ngÃ¢n.

**TÆ°Æ¡ng lai:** Kiáº¿n trÃºc chuáº©n chá»‰nh, sáºµn sÃ ng Ä‘Ã³ng gÃ³i thÃ nh giáº£i phÃ¡p thÆ°Æ¡ng máº¡i (SaaS) Ä‘á»™c láº­p Ä‘á»ƒ bÃ¡n cho cÃ¡c xÆ°á»Ÿng quáº£ng cÃ¡o khÃ¡c.

---

## ðŸ‘¥ 2. PHÃ‚N QUYá»€N Bá»˜ MÃY (ROLES)

> **Cáº­p nháº­t MVP 2026-07-01:** QC-OMS váº«n giá»¯ ná»n táº£ng permission-based access control Ä‘á»ƒ an toÃ n ká»¹ thuáº­t vÃ  má»Ÿ rá»™ng sau nÃ y. Tuy nhiÃªn trong MVP xÆ°á»Ÿng nhá»/ná»™i bá»™, nhÃ¢n viÃªn ná»™i bá»™ máº·c Ä‘á»‹nh nÃªn cÃ³ Ä‘á»§ quyá»n thao tÃ¡c chÃ­nh Ä‘á»ƒ trÃ¡nh váº­n hÃ nh bá»‹ chia cáº¯t quÃ¡ sá»›m. Chá»‰ tÃ¡ch quyá»n máº¡nh cho quáº£n lÃ½ user/quyá»n, cáº¥u hÃ¬nh há»‡ thá»‘ng, há»§y/sá»­a chá»©ng tá»« Ä‘Ã£ chá»‘t náº¿u cáº§n, vÃ  cÃ¡c thao tÃ¡c tÃ i chÃ­nh nháº¡y cáº£m náº¿u Owner chá»‘t sau.

### Báº£ng vai trÃ² máº·c Ä‘á»‹nh (Default Roles)

| Vai trÃ² | Quyá»n háº¡n cá»‘t lÃµi | MÃ´ táº£ chi tiáº¿t |
|---------|---------------------|----------------|
| ðŸ‘‘ **Chá»§ xÆ°á»Ÿng** | Full Access | ToÃ n quyá»n há»‡ thá»‘ng, cáº¥u hÃ¬nh mÃ¡y in, xem bÃ¡o cÃ¡o tÃ i chÃ­nh tá»•ng |
| ðŸ’° **NhÃ¢n viÃªn ná»™i bá»™ / Thu ngÃ¢n / Káº¿ toÃ¡n ná»™i bá»™** | Operational Access | Máº·c Ä‘á»‹nh dÃ¹ng Ä‘Æ°á»£c POS, khÃ¡ch hÃ ng, báº£ng giÃ¡, kho cÆ¡ báº£n, thu tiá»n/cÃ´ng ná»£ vÃ  chá»©ng tá»« trong pháº¡m vi MVP |
| ðŸ”§ **Thá»£ mÃ¡y** | Execute / Internal Access | Váº­n hÃ nh mÃ¡y in/CNC, theo dÃµi hÃ ng Ä‘á»£i mÃ¡y sáº£n xuáº¥t; náº¿u dÃ¹ng chung QC-OMS ná»™i bá»™ cÃ³ thá»ƒ Ä‘Æ°á»£c cáº¥p preset váº­n hÃ nh rá»™ng nhÆ° nhÃ¢n viÃªn ná»™i bá»™ |

### âš™ï¸ CÆ¡ cháº¿ má»Ÿ rá»™ng: Vai trÃ² tÃ¹y chá»‰nh (Custom Roles)

Há»‡ thá»‘ng há»— trá»£ **Ma tráº­n phÃ¢n quyá»n Ä‘á»™ng** (Dynamic Permissions Matrix) á»Ÿ ná»n ká»¹ thuáº­t, nhÆ°ng MVP khÃ´ng tá»‘i Æ°u theo kiá»ƒu SaaS enterprise vá»›i quÃ¡ nhiá»u role/permission nhá».

NguyÃªn táº¯c MVP:

- Permission nhá» váº«n cÃ³ thá»ƒ tá»“n táº¡i trong DB/API Ä‘á»ƒ báº£o vá»‡ backend.
- TÃ i khoáº£n ná»™i bá»™ máº·c Ä‘á»‹nh dÃ¹ng preset Ä‘á»§ quyá»n thao tÃ¡c chÃ­nh.
- UI khÃ´ng nÃªn áº©n/cháº·n quÃ¡ nhiá»u thao tÃ¡c thÆ°á»ng ngÃ y chá»‰ vÃ¬ thiáº¿u má»™t quyá»n nhá».
- Quyá»n quáº£n lÃ½ user/quyá»n, cáº¥u hÃ¬nh há»‡ thá»‘ng vÃ  há»§y/sá»­a chá»©ng tá»« Ä‘Ã£ chá»‘t náº¿u cáº§n pháº£i tÃ¡ch riÃªng.
- Quyá»n tÃ i chÃ­nh nháº¡y cáº£m cÃ³ thá»ƒ tÃ¡ch riÃªng náº¿u Owner chá»‘t, nhÆ°ng chÆ°a lÃ m phá»©c táº¡p á»Ÿ MVP.

**Use case:** TÃ i khoáº£n tÃ¹y biáº¿n phá»¥c vá»¥ riÃªng cho nhÃ¢n sá»± Ä‘áº·c thÃ¹ nhÆ° Káº¿ toÃ¡n thuÃª ngoÃ i, Cá»™ng tÃ¡c viÃªn thiáº¿t káº¿, hoáº·c Thá»£ há»c viá»‡c.

#### VÃ­ dá»¥ cáº¥u hÃ¬nh: Káº¿ toÃ¡n thuÃª ngoÃ i

| PhÃ¢n há»‡ | âœ… Xem / KhÃ³a | Chi tiáº¿t |
|----------|---------------|----------|
| BÃ¡o cÃ¡o doanh thu | âœ… Xem | Truy cáº­p bÃ¡o cÃ¡o, sá»• quá»¹ hÃ³a Ä‘Æ¡n, danh sÃ¡ch cÃ´ng ná»£ KH |
| POS táº¡o Ä‘Æ¡n | âŒ KhÃ³a | KhÃ´ng Ä‘Æ°á»£c táº¡o, sá»­a, xÃ³a Ä‘Æ¡n hÃ ng |
| Kho váº­t tÆ° | âŒ KhÃ³a | KhÃ´ng Ä‘Æ°á»£c xem thÃ´ng tin kho |
| Lá»‡nh in áº¥n | âŒ KhÃ³a | KhÃ´ng Ä‘Æ°á»£c can thiá»‡p lá»‡nh in dÆ°á»›i xÆ°á»Ÿng |
| Cáº¥u hÃ¬nh há»‡ thá»‘ng | âŒ KhÃ³a | KhÃ´ng Ä‘Æ°á»£c thay Ä‘á»•i cÃ i Ä‘áº·t |
| Audit log tÃ i khoáº£n khÃ¡c | âŒ KhÃ³a | KhÃ´ng Ä‘Æ°á»£c xem lá»‹ch sá»­ thao tÃ¡c cá»§a user khÃ¡c |

---

## ðŸ“Š 3. 5 Má»¤C TIÃŠU CHIáº¾N LÆ¯á»¢C (KPI CORES)

| Má»¥c tiÃªu (Goal) | Giáº£i phÃ¡p thá»±c hiá»‡n | Chá»‰ sá»‘ Ä‘o lÆ°á»ng (KPI) |
|-----------------|---------------------|----------------------|
| ðŸ›¡ï¸ **Chá»‘ng tháº¥t thoÃ¡t** | MÃ¡y in tá»± Ä‘áº©y diá»‡n tÃ­ch thá»±c táº¿ vá» Ä‘á»ƒ Thu ngÃ¢n Ä‘á»‘i chiáº¿u | 0% sai lá»‡ch sá»‘ liá»‡u mÃ©t vuÃ´ng ($m^2$) |
| âš¡ **Tá»‘c Ä‘á»™ váº­n hÃ nh** | CÆ¡ cháº¿ "Táº¥t cáº£ trong má»™t", tá»± gá»™p Ä‘Æ¡n, náº¡p Clipboard gá»­i Zalo | Thao tÃ¡c chá»‘t Ä‘Æ¡n dÆ°á»›i 3 giÃ¢y |
| ðŸ“Š **TÃ i chÃ­nh sáº¡ch** | ÄÆ¡n há»§y (bÃ¡o giÃ¡ xá»‹t) Ä‘Æ°á»£c bÃ³c tÃ¡ch riÃªng hoÃ n toÃ n | 100% dÃ²ng tiá»n sá»• quá»¹ lÃ  tiá»n tháº­t |
| ðŸ“¦ **Kho tá»± Ä‘á»™ng** | ÄÆ¡n chuyá»ƒn tráº¡ng thÃ¡i sáº£n xuáº¥t tá»± Ä‘á»™ng trá»« kho váº­t tÆ° | KhÃ´ng bá»‹ Ä‘á»™ng thiáº¿u há»¥t váº­t tÆ° |
| ðŸ”— **Äá»“ng bá»™ Realtime** | ToÃ n bá»™ cÃ¡c bá»™ pháº­n cháº¡y chung trÃªn má»™t ná»n táº£ng Cloud | 100% dá»¯ liá»‡u nháº¥t quÃ¡n qua backend cu da go |

---

## âš™ï¸ 4. TRIáº¾T LÃ THIáº¾T Káº¾ Cá»T LÃ•I (PRODUCT PHILOSOPHY)

### TÃ¹y biáº¿n Ä‘á»™ng cao (High Customization)

Há»‡ thá»‘ng **khÃ´ng fix cá»©ng** luá»“ng váº­n hÃ nh. Má»i thÃ´ng sá»‘ Ä‘á»u Ä‘Æ°á»£c thiáº¿t káº¿ dÆ°á»›i dáº¡ng **"Cáº¥u hÃ¬nh má»Ÿ"** (Dynamic Configuration):

- Äá»‹nh má»©c giÃ¡ theo tá»«ng nhÃ³m khÃ¡ch VIP (VD: PNJ)
- Äá»‹nh má»©c váº­t tÆ° tiÃªu hao theo tá»«ng mÃ¡y in/CNC
- Ma tráº­n phÃ¢n quyá»n nhÃ¢n sá»± tÃ¹y chá»‰nh á»Ÿ ná»n ká»¹ thuáº­t; MVP váº­n hÃ nh báº±ng preset ná»™i bá»™ Ä‘Æ¡n giáº£n
- NgÆ°á»¡ng cáº£nh bÃ¡o hao há»¥t váº­t tÆ°

### Thá»±c chiáº¿n vÃ  Linh hoáº¡t (Practicality)

Pháº§n má»m pháº£i **thÃ­ch á»©ng** vá»›i cÃ¡c tÃ¬nh huá»‘ng phÃ¡t sinh thá»±c táº¿ táº¡i xÆ°á»Ÿng.

> **VÃ­ dá»¥:** Kho háº¿t trÃªn pháº§n má»m nhÆ°ng thá»±c táº¿ váº«n cÃ²n báº¡t láº» â†’ Há»‡ thá»‘ng **chá»‰ cáº£nh bÃ¡o**, khÃ´ng khÃ³a cá»©ng lá»‡nh in. TrÃ¡nh lÃ m Ä‘Ã¬nh trá»‡ tiáº¿n Ä‘á»™ sáº£n xuáº¥t cá»§a thá»£ dÆ°á»›i xÆ°á»Ÿng.

---

> **LÆ°u Ã½:**
> - Má»¥c 4 Ä‘á»‹nh hÃ¬nh Triáº¿t lÃ½ thiáº¿t káº¿ â†’ CÃ¡c Pháº§n 2-6 sáº½ chi tiáº¿t hÃ³a cá»¥ thá»ƒ tá»«ng má»¥c tÃ¹y biáº¿n.
> - Pháº§n 2: TÃ­nh nÄƒng & UX (ká»‹ch báº£n UX tÃ¹y biáº¿n)
> - Pháº§n 3: Database Schema (cáº¥u hÃ¬nh Ä‘á»™ng, settings table)
> - Pháº§n 4: Backend Logic (ngÆ°á»¡ng cáº£nh bÃ¡o, hao há»¥t)

---

*Pháº§n 1 - ÄÃ£ chá»‘t âœ…*
