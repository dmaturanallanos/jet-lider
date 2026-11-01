import type { Database } from './database.generated';
export type { Database, Json } from './database.generated';
export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
