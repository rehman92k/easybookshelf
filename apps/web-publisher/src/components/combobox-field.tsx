'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { inputClassName } from '@easybookshelf/ui';
import { matchGeoOption } from '@/lib/geo';

type ComboboxFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export function ComboboxField({
  id,
  value,
  onChange,
  options,
  placeholder,
  required,
  disabled,
}: ComboboxFieldProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [...options];
    return options.filter((option) => option.toLowerCase().includes(trimmed));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function commitInput(next: string) {
    const match = matchGeoOption(options, next);
    if (match) {
      onChange(match);
      setQuery(match);
      return true;
    }

    const trimmed = next.trim().toLowerCase();
    if (trimmed) {
      const prefixMatches = options.filter((option) =>
        option.toLowerCase().startsWith(trimmed),
      );
      if (prefixMatches.length === 1) {
        onChange(prefixMatches[0]);
        setQuery(prefixMatches[0]);
        return true;
      }
    }

    setQuery(value);
    return false;
  }

  function selectOption(option: string) {
    onChange(option);
    setQuery(option);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          const match = matchGeoOption(options, event.target.value);
          if (match) onChange(match);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            commitInput(query);
          }, 120);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setQuery(value);
            return;
          }
          if (event.key === 'Enter' && open && filtered.length > 0) {
            event.preventDefault();
            selectOption(filtered[0]);
          }
        }}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`${inputClassName}${disabled ? ' cursor-not-allowed opacity-60' : ''}`}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-stone-300 bg-white py-1 text-sm shadow-lg dark:border-stone-600 dark:bg-stone-900"
        >
          {filtered.map((option) => (
            <li
              key={option}
              role="option"
              aria-selected={option === value}
              className={`cursor-pointer px-3 py-2 ${
                option === value
                  ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-500 shadow-lg dark:border-stone-600 dark:bg-stone-900 dark:text-stone-400">
          No matches. Choose from the list.
        </p>
      )}
    </div>
  );
}
