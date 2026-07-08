import type { CurrentUserData } from '../../lib/api/types'
import { canOpenModule, phaseOneModules } from './module-boundaries'

it('shows only MVP top-level module entries with inventory managed inside goods', () => {
  expect(phaseOneModules.map((module) => module.id)).toEqual([
    'pos',
    'sales-documents',
    'customers',
    'goods',
    'suppliers',
    'purchase-receipts',
    'price-book',
    'finance',
    'reports',
  ])
})

it('keeps stock and stocktake under the goods module instead of a separate warehouse tab', () => {
  const moduleIds = phaseOneModules.map((module) => module.id) as string[]

  expect(phaseOneModules.find((module) => module.id === 'goods')).toMatchObject({
    label: 'Hàng hóa',
    path: '/products',
  })
  expect(moduleIds).not.toContain('inventory')
})

it('names purchase receipts as the operator-facing import workflow', () => {
  expect(phaseOneModules.find((module) => module.id === 'purchase-receipts')?.label).toBe('Nhập hàng')
})

it('does not expose returns delivery cod e-invoice purchasing payroll online sales or tax modules', () => {
  const blocked = [
    'returns',
    'shipping',
    'cod',
    'e-invoice',
    'purchase',
    'payroll',
    'online-sales',
    'tax-accounting',
  ]
  expect(phaseOneModules.map((module) => module.id)).not.toEqual(expect.arrayContaining(blocked))
})

it('requires both finance and inventory permissions for reports', () => {
  const reports = phaseOneModules.find((module) => module.id === 'reports')
  const currentUser: CurrentUserData = {
    user: { id: 'u-1', email: 'owner@qc.local', display_name: 'Owner' },
    organization: { id: 'o-1', code: 'QC', name: 'QC OMS' },
    workstation: null,
    permissions: ['perm.manage_finance'],
  }

  expect(reports).toBeDefined()
  expect(canOpenModule(currentUser, reports!)).toBe(false)
  expect(canOpenModule({ ...currentUser, permissions: ['perm.manage_finance', 'perm.manage_inventory'] }, reports!)).toBe(true)
})
