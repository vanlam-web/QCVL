# POS-CUSTOMER — Nghiệp vụ khách hàng POS

> **Nguồn:** Chốt từ draft `docs/superpowers/specs/2026-06-30-customer-product-pricing-design.md`

---

## 1. Mục đích

Tài liệu này là Source of Truth cho cách POS nhận diện, tạo và áp nhóm khách hàng trong luồng bán hàng.

---

## 2. Quy tắc khách hàng

### BR-CUS-01: SĐT khách hàng

Khách hàng được phép không có SĐT.

Nếu có nhập SĐT, SĐT không được trùng trong cùng xưởng/organization.

Mục tiêu:

- cho phép bán cho khách chưa có hoặc chưa muốn cung cấp SĐT
- tránh tạo trùng hồ sơ và trùng công nợ khi đã có SĐT

### BR-CUS-02: Mã khách và tên khách

Mỗi khách hàng bắt buộc có:

- mã khách
- tên khách

Nếu nhân viên không nhập mã khách khi tạo khách, hệ thống tự sinh mã khách theo dạng:

```text
KH000001
KH000002
KH000003
```

Mã khách tăng dần trong phạm vi xưởng/organization.

Mã khách không được trùng trong cùng xưởng/organization, dù là nhập tay hay tự sinh.

### BR-CUS-03: Nhóm khách

Khách hàng có thể thuộc một nhóm khách.

Nếu khách có nhóm, nhóm khách quyết định bảng giá mặc định áp dụng cho khách đó.

Nếu khách không gán nhóm, POS áp dụng bảng giá chung.

Không bắt buộc mọi khách hàng phải thuộc nhóm.

---

## 3. Acceptance Criteria nghiệp vụ

1. Tạo khách không có SĐT thành công nếu có tên khách và mã khách hợp lệ; nếu không nhập mã khách thì hệ thống tự sinh.
2. Tạo khách có SĐT trùng trong cùng organization bị từ chối.
3. Tạo khách không nhập mã sẽ tự sinh mã dạng `KH000001`.
4. Mã khách nhập tay trùng trong cùng organization bị từ chối.
5. Khách không gán nhóm dùng bảng giá chung.
6. Khách có nhóm dùng bảng giá của nhóm.

---

← [Quay về Sales README](./README.md)
