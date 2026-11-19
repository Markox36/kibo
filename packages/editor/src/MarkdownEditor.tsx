import { forwardRef, useState } from 'react';
import { MarkdownView } from './MarkdownView.js';

export interface MarkdownEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  textareaClassName?: string;
  name?: string;
  id?: string;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
}

type Tab = 'edit' | 'preview';

export const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChange,
      placeholder,
      rows = 4,
      disabled = false,
      className,
      textareaClassName,
      name,
      id,
      onBlur,
    },
    ref,
  ) {
    const [tab, setTab] = useState<Tab>('edit');
    const isEmpty = value.trim().length === 0;

    return (
      <div className={`kibo-md-editor ${className ?? ''}`}>
        <div className="kibo-md-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'edit'}
            className={'kibo-md-tab ' + (tab === 'edit' ? 'is-active' : '')}
            onClick={() => setTab('edit')}
          >
            Editar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={'kibo-md-tab ' + (tab === 'preview' ? 'is-active' : '')}
            onClick={() => setTab('preview')}
            disabled={isEmpty}
            title={isEmpty ? 'Nada que previsualizar' : undefined}
          >
            Vista previa
          </button>
          <span className="kibo-md-hint">Markdown</span>
        </div>
        {tab === 'edit' ? (
          <textarea
            ref={ref}
            id={id}
            name={name}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className={textareaClassName}
          />
        ) : (
          <div className="kibo-md-preview">
            {isEmpty ? (
              <p className="kibo-md-empty">Nada que previsualizar.</p>
            ) : (
              <MarkdownView source={value} />
            )}
          </div>
        )}
      </div>
    );
  },
);
