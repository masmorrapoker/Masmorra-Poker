/**
 * O Supabase devolve no máximo 1.000 linhas por consulta (limite padrão da API).
 * Esta função busca em páginas até trazer tudo, para que relatórios e históricos
 * não fiquem silenciosamente incompletos quando o clube crescer.
 *
 * Uso: fetchAll((from, to) => supabase.from('x').select('*').eq(...).order('id').range(from, to))
 * A consulta deve ter uma ordenação estável (ex.: por id) para a paginação ser consistente.
 */
const PAGE_SIZE = 1000;

export async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return all;
}
