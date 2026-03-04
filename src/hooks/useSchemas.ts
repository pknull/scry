import { useQuery } from '@tanstack/react-query';
import { getSchemas, getSchema } from '../api/schema';
import type { SchemaDefinition } from '../api/types';

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'enum';
  label: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  // For number fields
  min?: number;
  max?: number;
  // For enum fields
  options?: string[];
  // For array fields
  itemType?: 'string' | 'number';
  // For string fields
  minLength?: number;
  maxLength?: number;
  // Whether this is the primary content field (largest textarea)
  isPrimary?: boolean;
}

export interface ParsedSchema {
  schemaId: string;
  contentType: string;
  description?: string;
  fields: SchemaField[];
  primaryField?: string;
}

// Fields that are always handled at the envelope level, not in the form
const ENVELOPE_FIELDS = ['type', 'topic', 'references'];

// Common primary text fields for each content type
const PRIMARY_FIELDS: Record<string, string> = {
  message: 'text',
  insight: 'observation',
  query: 'question',
  response: 'answer',
  dispute: 'reason',
  endorsement: 'comment',
  profile: 'name',
};

function inferFieldType(propSchema: Record<string, unknown>): SchemaField['type'] {
  // Check for enum first
  if (propSchema.enum) {
    return 'enum';
  }

  const schemaType = propSchema.type;
  if (Array.isArray(schemaType)) {
    // Handle union types like ["string", "null"]
    const nonNullType = schemaType.find((t) => t !== 'null');
    if (nonNullType === 'number' || nonNullType === 'integer') return 'number';
    if (nonNullType === 'boolean') return 'boolean';
    if (nonNullType === 'array') return 'array';
    return 'string';
  }

  if (schemaType === 'number' || schemaType === 'integer') return 'number';
  if (schemaType === 'boolean') return 'boolean';
  if (schemaType === 'array') return 'array';
  return 'string';
}

function fieldNameToLabel(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function parseJsonSchema(schema: SchemaDefinition): ParsedSchema {
  const jsonSchema = schema.json_schema as {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };

  const properties = jsonSchema.properties ?? {};
  const required = new Set(jsonSchema.required ?? []);
  const contentType = schema.content_type;
  const primaryFieldName = PRIMARY_FIELDS[contentType];

  const fields: SchemaField[] = [];

  for (const [name, propSchema] of Object.entries(properties)) {
    // Skip envelope fields and the 'type' const field
    if (ENVELOPE_FIELDS.includes(name)) continue;
    if (propSchema.const !== undefined) continue;

    const fieldType = inferFieldType(propSchema);
    const isPrimary = name === primaryFieldName;

    const field: SchemaField = {
      name,
      type: fieldType,
      label: fieldNameToLabel(name),
      required: required.has(name),
      isPrimary,
    };

    // Add type-specific properties
    if (fieldType === 'number') {
      if (typeof propSchema.minimum === 'number') field.min = propSchema.minimum;
      if (typeof propSchema.maximum === 'number') field.max = propSchema.maximum;
    }

    if (fieldType === 'enum' && Array.isArray(propSchema.enum)) {
      // Filter out null from enum options
      field.options = propSchema.enum.filter((v): v is string => typeof v === 'string');
    }

    if (fieldType === 'string') {
      if (typeof propSchema.minLength === 'number') field.minLength = propSchema.minLength;
      if (typeof propSchema.maxLength === 'number') field.maxLength = propSchema.maxLength;
    }

    if (fieldType === 'array' && propSchema.items) {
      const items = propSchema.items as Record<string, unknown>;
      field.itemType = items.type === 'number' ? 'number' : 'string';
      field.placeholder = 'Comma-separated values';
    }

    // Generate placeholder
    if (!field.placeholder) {
      if (field.required) {
        field.placeholder = `Enter ${field.label.toLowerCase()}`;
      } else {
        field.placeholder = `${field.label} (optional)`;
      }
    }

    fields.push(field);
  }

  // Sort fields: primary first, then required, then optional
  fields.sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });

  return {
    schemaId: schema.schema_id,
    contentType: schema.content_type,
    description: schema.description,
    fields,
    primaryField: primaryFieldName,
  };
}

export function useSchemaList() {
  return useQuery({
    queryKey: ['schemas'],
    queryFn: getSchemas,
    staleTime: 5 * 60 * 1000, // Schemas don't change often
  });
}

export function useSchema(schemaId: string | null) {
  return useQuery({
    queryKey: ['schema', schemaId],
    queryFn: () => (schemaId ? getSchema(schemaId) : null),
    enabled: !!schemaId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useParsedSchemas() {
  const { data: schemas, isLoading, error } = useSchemaList();

  // Fetch all schema definitions
  const schemaQueries = useQuery({
    queryKey: ['parsed-schemas', schemas?.map((s) => s.schema_id)],
    queryFn: async () => {
      if (!schemas) return [];
      const definitions = await Promise.all(
        schemas.map((s) => getSchema(s.schema_id))
      );
      return definitions
        .filter((d): d is SchemaDefinition => d !== null)
        .map(parseJsonSchema);
    },
    enabled: !!schemas && schemas.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  return {
    schemas: schemaQueries.data ?? [],
    schemaList: schemas ?? [],
    isLoading: isLoading || schemaQueries.isLoading,
    error: error || schemaQueries.error,
  };
}
