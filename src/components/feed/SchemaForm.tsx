import { useState, useEffect } from 'react';
import { Hash, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { ParsedSchema, SchemaField } from '../../hooks/useSchemas';

interface SchemaFormProps {
  schema: ParsedSchema;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  topic: string;
  onTopicChange: (topic: string) => void;
  disabled?: boolean;
  onSubmit?: () => void;
}

interface FieldInputProps {
  field: SchemaField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

function FieldInput({ field, value, onChange, disabled, onKeyDown }: FieldInputProps) {
  const baseClasses = clsx(
    'w-full px-3 py-2 rounded-md text-sm',
    'bg-bg-tertiary text-text border border-border',
    'focus:outline-none focus:ring-2 focus:ring-accent',
    'placeholder:text-text-faint',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  // Handle array fields (comma-separated input)
  if (field.type === 'array') {
    const arrayValue = Array.isArray(value) ? value.join(', ') : '';
    return (
      <input
        type="text"
        value={arrayValue}
        onChange={(e) => {
          const items = e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(items.length > 0 ? items : undefined);
        }}
        placeholder={field.placeholder}
        disabled={disabled}
        onKeyDown={onKeyDown}
        className={baseClasses}
      />
    );
  }

  // Handle enum fields (select)
  if (field.type === 'enum' && field.options) {
    return (
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
        className={baseClasses}
      >
        <option value="">Select {field.label.toLowerCase()}...</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    );
  }

  // Handle number fields
  if (field.type === 'number') {
    return (
      <input
        type="number"
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          onChange(isNaN(num) ? undefined : num);
        }}
        min={field.min}
        max={field.max}
        step={field.max !== undefined && field.max <= 1 ? 0.01 : 1}
        placeholder={field.placeholder}
        disabled={disabled}
        onKeyDown={onKeyDown}
        className={clsx(baseClasses, 'w-32')}
      />
    );
  }

  // Handle boolean fields
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked || undefined)}
          disabled={disabled}
          className="w-4 h-4 rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
        />
        <span className="text-sm text-text">{field.label}</span>
      </label>
    );
  }

  // Handle primary string fields (textarea)
  if (field.isPrimary) {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={field.placeholder}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onKeyDown?.(e);
          }
        }}
        rows={2}
        className={clsx(
          baseClasses,
          'resize-none min-h-[60px] max-h-[120px]'
        )}
        style={{
          height: 'auto',
          overflow: 'hidden',
        }}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = Math.min(target.scrollHeight, 120) + 'px';
        }}
      />
    );
  }

  // Default: text input
  return (
    <input
      type="text"
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder={field.placeholder}
      disabled={disabled}
      onKeyDown={onKeyDown}
      className={baseClasses}
    />
  );
}

export function SchemaForm({
  schema,
  values,
  onChange,
  topic,
  onTopicChange,
  disabled,
  onSubmit,
}: SchemaFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Split fields into primary and optional
  const primaryField = schema.fields.find((f) => f.isPrimary);
  const requiredFields = schema.fields.filter((f) => f.required && !f.isPrimary);
  const optionalFields = schema.fields.filter((f) => !f.required && !f.isPrimary);

  // Auto-show advanced if any required non-primary fields need values
  useEffect(() => {
    const hasUnfilledRequired = requiredFields.some(
      (f) => values[f.name] === undefined || values[f.name] === ''
    );
    if (hasUnfilledRequired && !showAdvanced) {
      setShowAdvanced(true);
    }
  }, [schema.contentType]); // Only on type change

  const updateField = (name: string, value: unknown) => {
    const newValues = { ...values };
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete newValues[name];
    } else {
      newValues[name] = value;
    }
    onChange(newValues);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const hasOptionalFields = optionalFields.length > 0 || requiredFields.length > 0;

  return (
    <div className="space-y-2">
      {/* Topic row */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1">
          <Hash className="w-3 h-3 text-text-faint" />
          <input
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="topic (optional)"
            disabled={disabled}
            className={clsx(
              'flex-1 px-2 py-1 rounded text-xs',
              'bg-bg-tertiary text-text border border-border',
              'focus:outline-none focus:ring-1 focus:ring-accent',
              'placeholder:text-text-faint',
              'disabled:opacity-50'
            )}
          />
        </div>

        {hasOptionalFields && (
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text"
          >
            {showAdvanced ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {showAdvanced ? 'Less' : 'More'}
          </button>
        )}
      </div>

      {/* Required non-primary fields (always shown when advanced is open) */}
      {showAdvanced && requiredFields.length > 0 && (
        <div className="space-y-2 pl-4 border-l-2 border-accent/30">
          {requiredFields.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="text-xs text-text-muted">
                {field.label}
                <span className="text-error ml-1">*</span>
              </label>
              <FieldInput
                field={field}
                value={values[field.name]}
                onChange={(v) => updateField(field.name, v)}
                disabled={disabled}
                onKeyDown={handleKeyDown}
              />
            </div>
          ))}
        </div>
      )}

      {/* Optional fields */}
      {showAdvanced && optionalFields.length > 0 && (
        <div className="space-y-2 pl-4 border-l-2 border-border">
          {optionalFields.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="text-xs text-text-muted">{field.label}</label>
              <FieldInput
                field={field}
                value={values[field.name]}
                onChange={(v) => updateField(field.name, v)}
                disabled={disabled}
                onKeyDown={handleKeyDown}
              />
            </div>
          ))}
        </div>
      )}

      {/* Primary content field (main textarea) */}
      {primaryField && (
        <FieldInput
          field={primaryField}
          value={values[primaryField.name]}
          onChange={(v) => updateField(primaryField.name, v)}
          disabled={disabled}
          onKeyDown={handleKeyDown}
        />
      )}
    </div>
  );
}
