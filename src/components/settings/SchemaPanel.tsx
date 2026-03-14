import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import {
  FileJson, ChevronDown, ChevronRight, Plus, Check, X,
  AlertCircle, Loader2, RefreshCw, Play, Search, Filter, Shield
} from 'lucide-react';
import { getSchemas, getSchema, registerSchema, validateContent } from '../../api/schema';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Toggle } from '../ui/Toggle';
import { ValidationMessage } from '../ui/ValidationMessage';
import { clsx } from 'clsx';
import * as yaml from 'yaml';
import type { SchemaInfo } from '../../api/types';
import {
  parseJsonObject,
  validateContentType,
  validatePositiveInteger,
  validateSchemaDefinition,
} from './validation';

interface ConfigState {
  schema_strict: boolean;
  rawYaml: string;
}

export function SchemaPanel() {
  const queryClient = useQueryClient();
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showValidator, setShowValidator] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [configState, setConfigState] = useState<ConfigState>({ schema_strict: false, rawYaml: '' });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const content = await invoke<string>('read_config');
        const parsed = yaml.parse(content) || {};
        setConfigState({
          schema_strict: parsed.schema_strict ?? false,
          rawYaml: content,
        });
      } catch (err) {
        console.error('Failed to load config:', err);
      }
    }
    loadConfig();
  }, []);

  async function toggleStrictMode(enabled: boolean) {
    setIsSavingConfig(true);
    setConfigError(null);
    try {
      const parsed = yaml.parse(configState.rawYaml) || {};
      parsed.schema_strict = enabled;
      const newYaml = yaml.stringify(parsed);
      await invoke('write_config', { content: newYaml });
      setConfigState({ schema_strict: enabled, rawYaml: newYaml });
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingConfig(false);
    }
  }

  const { data: schemas, isLoading, refetch } = useQuery({
    queryKey: ['schemas'],
    queryFn: getSchemas,
  });

  const filteredSchemas = schemas?.filter((schema) => {
    if (!filterQuery.trim()) return true;
    const query = filterQuery.toLowerCase();
    return (
      schema.schema_id.toLowerCase().includes(query) ||
      schema.content_type.toLowerCase().includes(query) ||
      schema.description?.toLowerCase().includes(query) ||
      schema.codec.toLowerCase().includes(query)
    );
  });

  const isFiltering = filterQuery.trim().length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Schema Registry</h2>
          <p className="text-sm text-text-muted">
            Manage JSON schemas for message validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowValidator(!showValidator)}>
            <Play className="w-4 h-4 mr-1" />
            Validate
          </Button>
          <Button size="sm" onClick={() => setShowRegister(!showRegister)}>
            <Plus className="w-4 h-4 mr-1" />
            Register
          </Button>
        </div>
      </div>

      {/* Enforcement Settings */}
      <Card>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-accent" />
            <div>
              <div className="font-medium text-text">Strict Mode</div>
              <div className="text-sm text-text-muted">
                Reject messages with unknown content types or invalid schemas
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isSavingConfig && <Loader2 className="w-4 h-4 animate-spin text-text-muted" />}
            <Toggle
              checked={configState.schema_strict}
              onChange={toggleStrictMode}
              disabled={isSavingConfig}
            />
          </div>
        </div>
        {configState.schema_strict && (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 text-warning text-sm bg-warning/10 p-2 rounded">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Messages without registered schemas will be rejected. Restart node to apply.
            </div>
          </div>
        )}
        {configError && (
          <div className="px-4 pb-4">
            <div className="rounded-md border border-error/30 bg-error/10 p-3">
              <div className="flex items-center gap-2 text-sm text-error">
                <AlertCircle className="h-4 w-4" />
                {configError}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Validator */}
      {showValidator && (
        <SchemaValidator onClose={() => setShowValidator(false)} />
      )}

      {/* Register form */}
      {showRegister && (
        <RegisterSchemaForm
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            queryClient.invalidateQueries({ queryKey: ['schemas'] });
          }}
        />
      )}

      {/* Schema list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              Registered Schemas ({schemas?.length ?? 0})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter schemas..."
                className="pl-9 pr-8 py-1.5 text-sm rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent w-48"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-bg rounded"
                >
                  <X className="w-3.5 h-3.5 text-text-muted" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Filter active indicator */}
        {isFiltering && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-accent">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">
                Showing {filteredSchemas?.length ?? 0} of {schemas?.length ?? 0} schemas
              </span>
              <span className="text-xs text-accent/70">
                matching "{filterQuery}"
              </span>
            </div>
            <button
              onClick={() => setFilterQuery('')}
              className="text-xs text-accent hover:text-accent/80 underline"
            >
              Clear filter
            </button>
          </div>
        )}

        <div className="divide-y divide-border">
          {filteredSchemas?.map((schema) => (
            <SchemaRow
              key={schema.schema_id}
              schema={schema}
              isExpanded={expandedSchema === schema.schema_id}
              onToggle={() => setExpandedSchema(
                expandedSchema === schema.schema_id ? null : schema.schema_id
              )}
            />
          ))}
          {isFiltering && filteredSchemas?.length === 0 && (
            <div className="p-4 text-center text-text-muted">
              No schemas match "{filterQuery}"
            </div>
          )}
          {!isFiltering && (!schemas || schemas.length === 0) && (
            <div className="p-4 text-center text-text-muted">
              No schemas registered
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function SchemaRow({
  schema,
  isExpanded,
  onToggle,
}: {
  schema: SchemaInfo;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { data: fullSchema, isLoading } = useQuery({
    queryKey: ['schema', schema.schema_id],
    queryFn: () => getSchema(schema.schema_id),
    enabled: isExpanded,
  });

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-bg-tertiary/50 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-sm text-accent bg-accent/10 px-1.5 py-0.5 rounded">
              "type": "{schema.content_type}"
            </code>
            <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
              v{schema.version}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
              {schema.codec}
            </span>
          </div>
          {schema.description && (
            <div className="text-xs text-text-muted mt-0.5 truncate">
              {schema.description}
            </div>
          )}
        </div>
        <span className="text-xs text-text-faint">
          {schema.compatibility}
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pl-10">
          {isLoading ? (
            <div className="flex items-center gap-2 text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading schema...
            </div>
          ) : fullSchema ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-text-muted">JSON Schema:</div>
              <pre className="text-xs bg-bg-tertiary p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(fullSchema.json_schema, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="text-sm text-error">Failed to load schema</div>
          )}
        </div>
      )}
    </div>
  );
}

function RegisterSchemaForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [contentType, setContentType] = useState('');
  const [version, setVersion] = useState('1');
  const [description, setDescription] = useState('');
  const [jsonSchema, setJsonSchema] = useState('{\n  "type": "object",\n  "properties": {\n    "type": { "const": "" }\n  },\n  "required": ["type"]\n}');
  const [apiError, setApiError] = useState<string | null>(null);
  const contentTypeError = validateContentType(contentType);
  const versionError = validatePositiveInteger(version, 'Version');
  const schemaResult = validateSchemaDefinition(jsonSchema, contentType);
  const schemaError = schemaResult.error;
  const isInvalid = Boolean(contentTypeError || versionError || schemaError);

  const mutation = useMutation({
    mutationFn: registerSchema,
    onSuccess,
    onError: (err) => setApiError(err instanceof Error ? err.message : 'Failed to register'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isInvalid || !schemaResult.parsed) {
      return;
    }
    setApiError(null);
    mutation.mutate({
      content_type: contentType.trim(),
      version: Number.parseInt(version, 10),
      json_schema: schemaResult.parsed,
      description: description.trim() || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Register New Schema</CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="p-4 pt-0 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Content Type
            </label>
            <Input
              type="text"
              value={contentType}
              onChange={(e) => {
                setContentType(e.target.value);
                setApiError(null);
              }}
              placeholder="my_custom_type"
              error={Boolean(contentTypeError)}
              aria-invalid={Boolean(contentTypeError)}
            />
            <ValidationMessage message={contentTypeError} />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Version
            </label>
            <Input
              type="number"
              value={version}
              onChange={(e) => {
                setVersion(e.target.value);
                setApiError(null);
              }}
              min="1"
              error={Boolean(versionError)}
              aria-invalid={Boolean(versionError)}
            />
            <ValidationMessage message={versionError} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Description
          </label>
          <Input
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setApiError(null);
            }}
            placeholder="Optional description"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            JSON Schema
          </label>
          <textarea
            value={jsonSchema}
            onChange={(e) => {
              setJsonSchema(e.target.value);
              setApiError(null);
            }}
            rows={10}
            className={clsx(
              'w-full rounded-md bg-bg-tertiary px-3 py-2 font-mono text-sm text-text border focus:outline-none focus:ring-2 focus:ring-accent',
              schemaError ? 'border-error' : 'border-border'
            )}
            aria-invalid={Boolean(schemaError)}
          />
          <ValidationMessage message={schemaError} />
        </div>
        {apiError && (
          <div className="rounded-md border border-error/30 bg-error/10 p-3">
            <div className="flex items-center gap-2 text-error text-sm">
              <AlertCircle className="w-4 h-4" />
              {apiError}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || isInvalid}>
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Plus className="w-4 h-4 mr-1" />
            )}
            Register
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SchemaValidator({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState('{\n  "type": "insight",\n  "title": "Test",\n  "observation": "Test observation"\n}');
  const [schemaId, setSchemaId] = useState('');
  const [result, setResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const contentResult = parseJsonObject(content);
  const contentError = contentResult.error;

  const { data: schemas } = useQuery({
    queryKey: ['schemas'],
    queryFn: getSchemas,
  });

  const mutation = useMutation({
    mutationFn: validateContent,
    onSuccess: (data) => {
      setResult(data);
      setApiError(null);
    },
    onError: (err) => {
      setApiError(err instanceof Error ? err.message : 'Validation failed');
      setResult(null);
    },
  });

  function handleValidate() {
    if (contentError || !contentResult.parsed) {
      return;
    }
    setApiError(null);
    setResult(null);
    mutation.mutate({
      content: contentResult.parsed,
      schema_id: schemaId || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Validate Content</CardTitle>
          <button onClick={onClose} className="p-1 hover:bg-bg-tertiary rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <div className="p-4 pt-0 space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Schema (optional - auto-inferred from type field)
          </label>
          <select
            value={schemaId}
            onChange={(e) => setSchemaId(e.target.value)}
            className="w-full px-3 py-2 rounded-md bg-bg-tertiary text-text border border-border focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Auto-detect from content type</option>
            {schemas?.map((s) => (
              <option key={s.schema_id} value={s.schema_id}>
                {s.schema_id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Content JSON
          </label>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setApiError(null);
              setResult(null);
            }}
            rows={8}
            className={clsx(
              'w-full rounded-md bg-bg-tertiary px-3 py-2 font-mono text-sm text-text border focus:outline-none focus:ring-2 focus:ring-accent',
              contentError ? 'border-error' : 'border-border'
            )}
            aria-invalid={Boolean(contentError)}
          />
          <ValidationMessage message={contentError} />
        </div>

        {result && (
          <div className={clsx(
            'flex items-center gap-2 p-3 rounded-md',
            result.valid ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
          )}>
            {result.valid ? (
              <>
                <Check className="w-5 h-5" />
                <span>Valid</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5" />
                <span>{result.error || 'Invalid'}</span>
              </>
            )}
          </div>
        )}

        {apiError && (
          <div className="rounded-md border border-error/30 bg-error/10 p-3">
            <div className="flex items-center gap-2 text-error text-sm">
              <AlertCircle className="w-4 h-4" />
              {apiError}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleValidate} disabled={mutation.isPending || Boolean(contentError)}>
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            Validate
          </Button>
        </div>
      </div>
    </Card>
  );
}
