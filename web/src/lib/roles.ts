import type { Role } from '../types'

export function canManageAssets(role: Role) {
  return role === 'admin'
}

export function canManageUsers(role: Role) {
  return role === 'admin'
}

export function canManageDevices(role: Role) {
  return role === 'admin'
}

export function canEditThresholds(role: Role) {
  return role === 'admin'
}

export function canAckResolve(role: Role) {
  return role === 'admin' || role === 'operator'
}

export function canAddMaintenanceNote(role: Role) {
  return role === 'admin' || role === 'technician'
}

export function canCharacterizeStock(role: Role) {
  return role === 'admin' || role === 'operator'
}
