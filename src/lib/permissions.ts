export type Role = 'admin' | 'worker';
export function canManage(role: string) {
  return role === 'admin';
}
export function canEditEntry(role: string, actor: string, author: string) {
  return canManage(role) || actor === author;
}
