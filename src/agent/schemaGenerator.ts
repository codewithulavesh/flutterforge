import type { DatabaseSchemaPlan, TableDefinition, ColumnDefinition, RLSPolicyDefinition } from './types';

export class SupabaseSchemaGenerator {
  /**
   * Generates complete PostgreSQL migration script with RLS and realtime publications
   */
  public static generateMigrationSql(schema: DatabaseSchemaPlan): string {
    const lines: string[] = [];

    lines.push(`-- ==============================================================================`);
    lines.push(`-- FlutterForge Generated Supabase Migration`);
    lines.push(`-- Generated At: ${new Date().toISOString()}`);
    lines.push(`-- Project: ${schema.projectName}`);
    lines.push(`-- ==============================================================================\n`);

    // Enable extensions
    lines.push(`-- Enable UUID generation extension`);
    lines.push(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`);

    // Helper trigger function for updated_at
    lines.push(`-- Trigger function for automatically updating updated_at`);
    lines.push(`CREATE OR REPLACE FUNCTION public.handle_updated_at()`);
    lines.push(`RETURNS TRIGGER AS $$`);
    lines.push(`BEGIN`);
    lines.push(`  NEW.updated_at = NOW();`);
    lines.push(`  RETURN NEW;`);
    lines.push(`END;`);
    lines.push(`$$ LANGUAGE plpgsql;\n`);

    // Generate Tables
    for (const table of schema.tables) {
      lines.push(this.generateTableSql(table));
      lines.push('');
    }

    // Enable Realtime
    const realtimeTables = schema.tables.filter((t) => t.enableRealtime).map((t) => t.name);
    if (realtimeTables.length > 0) {
      lines.push(`-- Enable Supabase Realtime for dynamic live subscriptions`);
      for (const tName of realtimeTables) {
        lines.push(`DO $$`);
        lines.push(`BEGIN`);
        lines.push(`  IF NOT EXISTS (`);
        lines.push(`    SELECT 1 FROM pg_publication_tables`);
        lines.push(`    WHERE pubname = 'supabase_realtime' AND tablename = '${tName}'`);
        lines.push(`  ) THEN`);
        lines.push(`    ALTER PUBLICATION supabase_realtime ADD TABLE public.${tName};`);
        lines.push(`  END IF;`);
        lines.push(`END $$;\n`);
      }
    }

    // Storage Buckets setup
    if (schema.storageBuckets && schema.storageBuckets.length > 0) {
      lines.push(`-- Supabase Storage Buckets Setup`);
      for (const bucket of schema.storageBuckets) {
        lines.push(`INSERT INTO storage.buckets (id, name, public)`);
        lines.push(`VALUES ('${bucket.name}', '${bucket.name}', ${bucket.isPublic})`);
        lines.push(`ON CONFLICT (id) DO NOTHING;`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generates SQL for a single table, including columns, RLS, and policies
   */
  private static generateTableSql(table: TableDefinition): string {
    const lines: string[] = [];
    lines.push(`-- Table: public.${table.name} (${table.description})`);
    lines.push(`CREATE TABLE IF NOT EXISTS public.${table.name} (`);

    const colDefs: string[] = [];
    for (const col of table.columns) {
      colDefs.push(`  ${this.formatColumnDefinition(col)}`);
    }
    lines.push(colDefs.join(',\n'));
    lines.push(`);\n`);

    // Indexes on foreign keys
    for (const col of table.columns) {
      if (col.references) {
        lines.push(`CREATE INDEX IF NOT EXISTS idx_${table.name}_${col.name} ON public.${table.name} (${col.name});`);
      }
    }

    // Updated at trigger if column exists
    const hasUpdatedAt = table.columns.some((c) => c.name === 'updated_at');
    if (hasUpdatedAt) {
      lines.push(`DROP TRIGGER IF EXISTS tr_${table.name}_updated_at ON public.${table.name};`);
      lines.push(`CREATE TRIGGER tr_${table.name}_updated_at`);
      lines.push(`  BEFORE UPDATE ON public.${table.name}`);
      lines.push(`  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();`);
    }

    // Row Level Security (RLS)
    if (table.enableRLS) {
      lines.push(`\n-- Row Level Security (RLS) for ${table.name}`);
      lines.push(`ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY;`);

      for (const policy of table.policies) {
        lines.push(this.formatRLSPolicy(policy));
      }
    }

    return lines.join('\n');
  }

  private static formatColumnDefinition(col: ColumnDefinition): string {
    const parts: string[] = [col.name];

    switch (col.type) {
      case 'uuid':
        parts.push('UUID');
        break;
      case 'text':
        parts.push('TEXT');
        break;
      case 'varchar':
        parts.push('VARCHAR(255)');
        break;
      case 'integer':
        parts.push('INTEGER');
        break;
      case 'bigint':
        parts.push('BIGINT');
        break;
      case 'boolean':
        parts.push('BOOLEAN');
        break;
      case 'timestamp':
        parts.push('TIMESTAMP WITHOUT TIME ZONE');
        break;
      case 'timestamptz':
        parts.push('TIMESTAMPTZ');
        break;
      case 'jsonb':
        parts.push('JSONB');
        break;
      case 'numeric':
        parts.push('NUMERIC(12, 2)');
        break;
      case 'float':
        parts.push('DOUBLE PRECISION');
        break;
    }

    if (col.isPrimary) {
      parts.push('PRIMARY KEY');
    }

    if (col.defaultValue) {
      parts.push(`DEFAULT ${col.defaultValue}`);
    }

    if (col.isNullable === false && !col.isPrimary) {
      parts.push('NOT NULL');
    }

    if (col.isUnique) {
      parts.push('UNIQUE');
    }

    if (col.references) {
      const onDelete = col.references.onDelete ? ` ON DELETE ${col.references.onDelete}` : '';
      parts.push(`REFERENCES ${col.references.table}(${col.references.column})${onDelete}`);
    }

    return parts.join(' ');
  }

  private static formatRLSPolicy(policy: RLSPolicyDefinition): string {
    const policyName = `policy_${policy.table}_${policy.action.toLowerCase()}_${Math.abs(this.hashCode(policy.name)) % 10000}`;
    const role = policy.role ? ` TO ${policy.role}` : '';
    const using = policy.usingExpression ? `\n  USING (${policy.usingExpression})` : '';
    const withCheck = policy.withCheckExpression ? `\n  WITH CHECK (${policy.withCheckExpression})` : '';

    return `DROP POLICY IF EXISTS "${policyName}" ON public.${policy.table};\nCREATE POLICY "${policyName}" ON public.${policy.table}\n  FOR ${policy.action}${role}${using}${withCheck};`;
  }

  private static hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
