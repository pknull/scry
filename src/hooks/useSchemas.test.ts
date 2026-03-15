import { describe, it, expect } from 'vitest';
import { parseJsonSchema } from './useSchemas';
import type { SchemaDefinition } from '../api/types';

// Helper to create a minimal SchemaDefinition
function createSchemaDefinition(
  contentType: string,
  properties: Record<string, Record<string, unknown>>,
  required: string[] = [],
  description?: string
): SchemaDefinition {
  return {
    schema_id: `schema-${contentType}-v1`,
    content_type: contentType,
    version: 1,
    codec: 'json',
    compatibility: 'none',
    description,
    json_schema: {
      type: 'object',
      properties,
      required,
    },
  };
}

describe('parseJsonSchema', () => {
  describe('basic field parsing', () => {
    it('parses a simple string field', () => {
      const schema = createSchemaDefinition(
        'custom',
        { title: { type: 'string' } },
        ['title']
      );

      const result = parseJsonSchema(schema);

      expect(result.schemaId).toBe('schema-custom-v1');
      expect(result.contentType).toBe('custom');
      expect(result.fields).toHaveLength(1);
      expect(result.fields[0]).toMatchObject({
        name: 'title',
        type: 'string',
        label: 'Title',
        required: true,
      });
    });

    it('parses a number field with min/max constraints', () => {
      const schema = createSchemaDefinition('custom', {
        count: { type: 'number', minimum: 0, maximum: 100 },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'count');

      expect(field).toBeDefined();
      expect(field?.type).toBe('number');
      expect(field?.min).toBe(0);
      expect(field?.max).toBe(100);
    });

    it('parses an integer field as number type', () => {
      const schema = createSchemaDefinition('custom', {
        age: { type: 'integer', minimum: 18 },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'age');

      expect(field?.type).toBe('number');
      expect(field?.min).toBe(18);
    });

    it('parses a boolean field', () => {
      const schema = createSchemaDefinition('custom', {
        active: { type: 'boolean' },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'active');

      expect(field?.type).toBe('boolean');
    });

    it('parses an array field with item type', () => {
      const schema = createSchemaDefinition('custom', {
        tags: { type: 'array', items: { type: 'string' } },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'tags');

      expect(field?.type).toBe('array');
      expect(field?.itemType).toBe('string');
      expect(field?.placeholder).toBe('Comma-separated values');
    });

    it('parses an array field with number items', () => {
      const schema = createSchemaDefinition('custom', {
        scores: { type: 'array', items: { type: 'number' } },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'scores');

      expect(field?.type).toBe('array');
      expect(field?.itemType).toBe('number');
    });

    it('parses an enum field and filters out null values', () => {
      const schema = createSchemaDefinition('custom', {
        status: { enum: ['pending', 'active', 'complete', null] },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'status');

      expect(field?.type).toBe('enum');
      expect(field?.options).toEqual(['pending', 'active', 'complete']);
    });

    it('parses string field with length constraints', () => {
      const schema = createSchemaDefinition('custom', {
        code: { type: 'string', minLength: 3, maxLength: 10 },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'code');

      expect(field?.type).toBe('string');
      expect(field?.minLength).toBe(3);
      expect(field?.maxLength).toBe(10);
    });
  });

  describe('union types', () => {
    it('handles nullable string union type', () => {
      const schema = createSchemaDefinition('custom', {
        nickname: { type: ['string', 'null'] },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'nickname');

      expect(field?.type).toBe('string');
    });

    it('handles nullable number union type', () => {
      const schema = createSchemaDefinition('custom', {
        rating: { type: ['number', 'null'] },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'rating');

      expect(field?.type).toBe('number');
    });

    it('handles nullable integer union type', () => {
      const schema = createSchemaDefinition('custom', {
        count: { type: ['integer', 'null'] },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'count');

      expect(field?.type).toBe('number');
    });

    it('handles nullable boolean union type', () => {
      const schema = createSchemaDefinition('custom', {
        confirmed: { type: ['boolean', 'null'] },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'confirmed');

      expect(field?.type).toBe('boolean');
    });

    it('handles nullable array union type', () => {
      const schema = createSchemaDefinition('custom', {
        items: { type: ['array', 'null'], items: { type: 'string' } },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'items');

      expect(field?.type).toBe('array');
    });

    it('defaults to string when union contains no recognizable type', () => {
      const schema = createSchemaDefinition('custom', {
        unknown: { type: ['null'] },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'unknown');

      expect(field?.type).toBe('string');
    });
  });

  describe('envelope fields filtering', () => {
    it('filters out the type field', () => {
      const schema = createSchemaDefinition('custom', {
        type: { const: 'custom' },
        title: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields.map((f) => f.name)).not.toContain('type');
      expect(result.fields.map((f) => f.name)).toContain('title');
    });

    it('filters out the topic field', () => {
      const schema = createSchemaDefinition('custom', {
        topic: { type: 'string' },
        content: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields.map((f) => f.name)).not.toContain('topic');
      expect(result.fields.map((f) => f.name)).toContain('content');
    });

    it('filters out the references field', () => {
      const schema = createSchemaDefinition('custom', {
        references: { type: 'array', items: { type: 'string' } },
        body: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields.map((f) => f.name)).not.toContain('references');
      expect(result.fields.map((f) => f.name)).toContain('body');
    });

    it('filters out fields with const values', () => {
      const schema = createSchemaDefinition('custom', {
        version: { const: '1.0' },
        data: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields.map((f) => f.name)).not.toContain('version');
      expect(result.fields.map((f) => f.name)).toContain('data');
    });
  });

  describe('primary field detection', () => {
    it('marks text as primary for message content type', () => {
      const schema = createSchemaDefinition('message', {
        text: { type: 'string' },
        metadata: { type: 'string' },
      });

      const result = parseJsonSchema(schema);
      const textField = result.fields.find((f) => f.name === 'text');
      const metadataField = result.fields.find((f) => f.name === 'metadata');

      expect(textField?.isPrimary).toBe(true);
      expect(metadataField?.isPrimary).toBe(false);
      expect(result.primaryField).toBe('text');
    });

    it('marks observation as primary for insight content type', () => {
      const schema = createSchemaDefinition('insight', {
        observation: { type: 'string' },
        confidence: { type: 'number' },
      });

      const result = parseJsonSchema(schema);
      const obsField = result.fields.find((f) => f.name === 'observation');

      expect(obsField?.isPrimary).toBe(true);
      expect(result.primaryField).toBe('observation');
    });

    it('marks question as primary for query content type', () => {
      const schema = createSchemaDefinition('query', {
        question: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields[0]?.isPrimary).toBe(true);
      expect(result.primaryField).toBe('question');
    });

    it('marks answer as primary for response content type', () => {
      const schema = createSchemaDefinition('response', {
        answer: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields[0]?.isPrimary).toBe(true);
      expect(result.primaryField).toBe('answer');
    });

    it('marks reason as primary for dispute content type', () => {
      const schema = createSchemaDefinition('dispute', {
        reason: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields[0]?.isPrimary).toBe(true);
      expect(result.primaryField).toBe('reason');
    });

    it('marks comment as primary for endorsement content type', () => {
      const schema = createSchemaDefinition('endorsement', {
        comment: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields[0]?.isPrimary).toBe(true);
      expect(result.primaryField).toBe('comment');
    });

    it('marks name as primary for profile content type', () => {
      const schema = createSchemaDefinition('profile', {
        name: { type: 'string' },
        bio: { type: 'string' },
      });

      const result = parseJsonSchema(schema);
      const nameField = result.fields.find((f) => f.name === 'name');

      expect(nameField?.isPrimary).toBe(true);
      expect(result.primaryField).toBe('name');
    });

    it('has no primary field for unknown content types', () => {
      const schema = createSchemaDefinition('unknown_type', {
        data: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields.every((f) => !f.isPrimary)).toBe(true);
      expect(result.primaryField).toBeUndefined();
    });
  });

  describe('field sorting', () => {
    it('sorts primary fields first', () => {
      const schema = createSchemaDefinition('message', {
        metadata: { type: 'string' },
        text: { type: 'string' },
        author: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.fields[0].name).toBe('text');
      expect(result.fields[0].isPrimary).toBe(true);
    });

    it('sorts required fields before optional fields', () => {
      const schema = createSchemaDefinition(
        'custom',
        {
          optional1: { type: 'string' },
          required1: { type: 'string' },
          optional2: { type: 'string' },
          required2: { type: 'string' },
        },
        ['required1', 'required2']
      );

      const result = parseJsonSchema(schema);
      const requiredFields = result.fields.filter((f) => f.required);
      const optionalFields = result.fields.filter((f) => !f.required);

      // All required fields should come before all optional fields
      const lastRequiredIndex = result.fields.findLastIndex((f) => f.required);
      const firstOptionalIndex = result.fields.findIndex((f) => !f.required);

      expect(requiredFields.length).toBe(2);
      expect(optionalFields.length).toBe(2);
      expect(lastRequiredIndex).toBeLessThan(firstOptionalIndex);
    });

    it('sorts primary > required > optional', () => {
      const schema = createSchemaDefinition(
        'message',
        {
          optional: { type: 'string' },
          required: { type: 'string' },
          text: { type: 'string' }, // primary for message type
        },
        ['required', 'text']
      );

      const result = parseJsonSchema(schema);

      expect(result.fields[0].name).toBe('text'); // primary and required
      expect(result.fields[1].name).toBe('required'); // required only
      expect(result.fields[2].name).toBe('optional'); // optional
    });
  });

  describe('placeholder generation', () => {
    it('generates placeholder for required fields', () => {
      const schema = createSchemaDefinition(
        'custom',
        { title: { type: 'string' } },
        ['title']
      );

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'title');

      expect(field?.placeholder).toBe('Enter title');
    });

    it('generates placeholder for optional fields', () => {
      const schema = createSchemaDefinition('custom', {
        description: { type: 'string' },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'description');

      expect(field?.placeholder).toBe('Description (optional)');
    });

    it('uses comma-separated placeholder for array fields', () => {
      const schema = createSchemaDefinition('custom', {
        tags: { type: 'array', items: { type: 'string' } },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'tags');

      expect(field?.placeholder).toBe('Comma-separated values');
    });

    it('converts snake_case field names to Title Case in labels and placeholders', () => {
      const schema = createSchemaDefinition(
        'custom',
        { first_name: { type: 'string' } },
        ['first_name']
      );

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'first_name');

      expect(field?.label).toBe('First Name');
      expect(field?.placeholder).toBe('Enter first name');
    });

    it('converts multi-word snake_case names', () => {
      const schema = createSchemaDefinition('custom', {
        last_updated_at: { type: 'string' },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'last_updated_at');

      expect(field?.label).toBe('Last Updated At');
    });
  });

  describe('schema metadata', () => {
    it('includes schema description when provided', () => {
      const schema = createSchemaDefinition(
        'custom',
        { data: { type: 'string' } },
        [],
        'A custom data schema'
      );

      const result = parseJsonSchema(schema);

      expect(result.description).toBe('A custom data schema');
    });

    it('handles missing description', () => {
      const schema = createSchemaDefinition('custom', {
        data: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.description).toBeUndefined();
    });

    it('preserves schema ID', () => {
      const schema = createSchemaDefinition('my_content', {
        field: { type: 'string' },
      });

      const result = parseJsonSchema(schema);

      expect(result.schemaId).toBe('schema-my_content-v1');
    });
  });

  describe('edge cases', () => {
    it('handles empty properties object', () => {
      const schema = createSchemaDefinition('empty', {});

      const result = parseJsonSchema(schema);

      expect(result.fields).toEqual([]);
      expect(result.contentType).toBe('empty');
    });

    it('handles missing properties and required in json_schema', () => {
      const schema: SchemaDefinition = {
        schema_id: 'minimal',
        content_type: 'minimal',
        version: 1,
        codec: 'json',
        compatibility: 'none',
        json_schema: {},
      };

      const result = parseJsonSchema(schema);

      expect(result.fields).toEqual([]);
    });

    it('handles property with no type specified', () => {
      const schema = createSchemaDefinition('custom', {
        unknown: {},
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'unknown');

      // Should default to string
      expect(field?.type).toBe('string');
    });

    it('ignores non-numeric min/max values', () => {
      const schema = createSchemaDefinition('custom', {
        value: { type: 'number', minimum: 'invalid', maximum: null },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'value');

      expect(field?.min).toBeUndefined();
      expect(field?.max).toBeUndefined();
    });

    it('ignores non-numeric minLength/maxLength values', () => {
      const schema = createSchemaDefinition('custom', {
        text: { type: 'string', minLength: 'invalid', maxLength: null },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'text');

      expect(field?.minLength).toBeUndefined();
      expect(field?.maxLength).toBeUndefined();
    });

    it('handles array items without type', () => {
      const schema = createSchemaDefinition('custom', {
        items: { type: 'array', items: {} },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'items');

      expect(field?.type).toBe('array');
      expect(field?.itemType).toBe('string'); // defaults to string
    });

    it('handles multiple enum values with only strings', () => {
      const schema = createSchemaDefinition('custom', {
        priority: { enum: ['low', 'medium', 'high'] },
      });

      const result = parseJsonSchema(schema);
      const field = result.fields.find((f) => f.name === 'priority');

      expect(field?.options).toEqual(['low', 'medium', 'high']);
    });
  });
});
