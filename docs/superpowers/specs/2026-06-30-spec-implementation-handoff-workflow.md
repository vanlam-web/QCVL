# Spec And Implementation Handoff Workflow

> Ngay lap: 2026-06-30
> Trang thai: Draft dieu phoi, khong phai Source of Truth nghiep vu
> Pham vi: Cach luu dac ta va ban giao cho luong implementation de tranh xung dot

## 1. Muc tieu

Tai lieu nay quy dinh cach luong dac ta lam viec song song voi luong implementation:

- luong dac ta duoc tiep tuc hoi va chot nghiep vu ma khong sua truc tiep worktree implementation
- luong implementation co moc commit ro rang de merge hoac cherry-pick
- cac quyet dinh chua chac duoc luu thanh draft, khong lam implement hieu nham la Source of Truth
- cac quyet dinh da chot duoc cap nhat vao dung tang tai lieu

## 2. Nguyen tac chinh

### 2.1. Khong sua truc tiep worktree implementation

Luong dac ta chi sua tai lieu trong worktree dac ta.

Neu can implement doi huong, luong dac ta gui message sang luong implementation kem:

- branch
- commit hash
- file da doi
- quyet dinh nghiep vu moi
- diem nao trong plan cu can sua

### 2.2. Khong rewrite commit da ban giao

Khi mot commit spec da duoc bao cho implementation, khong amend, rebase hoac force update de thay doi noi dung commit do.

Neu can bo sung hoac sua lai, tao commit moi phia sau commit cu.

### 2.3. Moi cum nghiep vu la mot commit nho

Khong gom qua nhieu domain vao mot commit.

Vi du commit tot:

- `docs: specify inventory stock rules`
- `docs: specify bom combo rules`
- `docs: update cashbook api rules`

Vi du commit nen tranh:

- `docs: update everything`
- mot commit gom ca kho, BOM, nhan su, bao cao va thanh toan

## 3. Noi luu dac ta theo trang thai

### 3.1. Chua chot nghiep vu

Neu dang hoi, dang gom y, hoac con can Owner xac nhan, luu vao draft rieng:

```text
docs/superpowers/specs/YYYY-MM-DD-<topic>-draft.md
```

Draft phai ghi ro:

- `Trang thai: Draft`
- cac cau da chot
- cac cau con can Owner chot
- noi dung nao chua duoc implement dung theo

Implementation khong lay draft lam Source of Truth tru khi message handoff noi ro phan nao da duoc chot.

### 3.2. Da chot nghiep vu

Khi Owner da chot, cap nhat Source of Truth dung tang:

```text
docs/02-PRD-UX-PhongCanh/...
docs/03-BUSINESS-NghiepVu/...
docs/04-DATABASE/...
docs/05-BACKEND-MayChu/...
docs/06-INTEGRATION/...
docs/07-DEPLOYMENT/...
```

Quy tac chon tang:

- UX/luong thao tac man hinh: `docs/02-PRD-UX-PhongCanh/`
- Business rule: `docs/03-BUSINESS-NghiepVu/`
- Bang, constraint, ERD: `docs/04-DATABASE/`
- API, permission, validation, error code: `docs/05-BACKEND-MayChu/`
- Dong bo tich hop ngoai: `docs/06-INTEGRATION/`
- Moi truong, deploy, van hanh: `docs/07-DEPLOYMENT/`

Neu mot quyet dinh anh huong nhieu tang, cap nhat theo thu tu:

1. Business
2. Database
3. Backend API
4. UX hoac integration neu co lien quan

## 4. Quy trinh lam mot cum spec

### Buoc 1: Kiem tra truoc khi sua

Chay:

```sh
git status --short --branch
rg --files docs
```

Neu worktree dang co thay doi chua ro nguon goc, doc diff truoc khi sua va khong revert thay doi cua nguoi khac.

### Buoc 2: Luu draft neu chua chac

Voi cum nghiep vu moi, tao draft trong `docs/superpowers/specs/`.

Draft co the gom:

- pham vi
- quyet dinh da chot
- cau hoi can chot
- rui ro neu implement som
- de xuat thu tu cap nhat Source of Truth

### Buoc 3: Cap nhat Source of Truth sau khi Owner chot

Chi dua vao Source of Truth nhung noi dung da chot.

Khong de cau mo ho kieu `co the`, `tuy sau nay`, `tam thoi chua biet` trong Source of Truth neu no anh huong implement. Neu can giu ngoai le, phai ghi thanh rule ro rang:

```text
MVP khong ho tro ...
Sau MVP se mo lai bang spec rieng.
```

### Buoc 4: Verify docs

Truoc commit, chay toi thieu:

```sh
git diff --check
rg -n "TBD|TODO|FIXME" docs
```

Neu dang thay the quyet dinh cu, chay them scan keyword cu de dam bao khong con noi dung mau thuan.

### Buoc 5: Commit rieng

Stage dung pham vi docs can ban giao, sau do commit voi message ro nghiep vu.

Khong amend commit da gui cho implementation.

### Buoc 6: Handoff sang implementation

Gui message sang luong implementation gom:

```text
Spec update:
- Branch:
- Commit:
- Files changed:
- Business decisions:
- Plan changes required:
- Verification:
```

Neu spec moi lam plan cu sai, noi ro:

```text
Please update the saved implementation plan before continuing implementation.
If old plan conflicts with commit <hash>, treat commit <hash> as current spec.
```

## 5. Mau handoff ngan

```text
Spec update for QC-OMS:

Branch: codex/<spec-branch>
Commit: <hash> <message>

Please merge/cherry-pick this spec commit and update your saved implementation plan before coding further.

Changed files:
- ...

Decisions now locked:
- ...

Plan impact:
- ...

Verification:
- git diff --check clean
- no TBD/TODO/FIXME in touched docs
```

## 6. Cach xu ly xung dot

### 6.1. Implementation da code theo plan cu

Luong implementation khong bi mat plan cu.

Nhung neu code/plan cu mau thuan voi spec commit moi, implementation phai:

1. doc commit spec moi
2. sua saved implementation plan
3. tiep tuc code theo plan da sua

Luong dac ta khong sua code thay implementation.

### 6.2. Draft va Source of Truth mau thuan

Source of Truth thang.

Draft chi dung de truy vet qua trinh chot nghiep vu.

### 6.3. Owner doi y sau khi da ban giao

Khong sua lai commit cu.

Tao commit spec moi ghi ro:

- rule cu
- rule moi
- ly do doi
- file/plan implementation can cap nhat

Sau do handoff commit moi sang implementation.

## 7. Trang thai hien tai

Spec Sales/Finance Phase 1 da duoc ban giao bang:

```text
Branch: codex/spec-sales-finance-phase-1
Commit: 90e501e docs: add sales finance phase specs
```

Tu sau moc nay, moi thay doi dac ta tiep theo nen la commit moi phia sau commit `90e501e` hoac tren branch spec rieng neu pham vi lon.

Uu tien dac ta tiep theo hien tai:

1. Inventory/kho
2. BOM/Combo
3. Checkout/debt/cashbook API chi tiet neu implementation can them transaction/idempotency
