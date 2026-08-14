import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, X, Check } from 'lucide-react';

interface EntityAutocompleteProps<T> {
  placeholder?: string;
  fetchResults: (query: string) => Promise<T[]>;
  renderItem: (item: T) => React.ReactNode;
  onSelect: (item: T | null) => void;
  selectedItem?: T | null;
  renderSelected?: (item: T) => React.ReactNode;
  emptyMessage?: string;
}

export function EntityAutocomplete<T extends { id: string }>({
  placeholder = 'Buscar...',
  fetchResults,
  renderItem,
  onSelect,
  selectedItem,
  renderSelected,
  emptyMessage = 'No se encontraron resultados.',
}: EntityAutocompleteProps<T>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchResults(query);
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        console.error('Error fetching results:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, fetchResults]);

  if (selectedItem) {
    return (
      <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shrink-0">
            <Check size={16} strokeWidth={3} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-0.5">Seleccionado</p>
            <div className="text-sm font-semibold text-slate-800 truncate">
              {renderSelected ? renderSelected(selectedItem) : renderItem(selectedItem)}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="text-slate-400 hover:text-red-500 bg-white hover:bg-red-50 p-2 rounded-lg border border-slate-200 transition-colors cursor-pointer shrink-0"
          title="Quitar selección"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 size={18} className="text-indigo-500 animate-spin" />
          ) : (
            <Search size={18} className="text-slate-400" />
          )}
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-slate-800 placeholder-slate-400 transition shadow-sm"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim() && results.length > 0) setIsOpen(true);
          }}
        />
        {query && !loading && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-popIn">
          {results.length > 0 ? (
            <ul className="max-h-60 overflow-auto divide-y divide-slate-100">
              {results.map((item) => (
                <li
                  key={item.id}
                  className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => {
                    onSelect(item);
                    setQuery('');
                    setIsOpen(false);
                  }}
                >
                  {renderItem(item)}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
