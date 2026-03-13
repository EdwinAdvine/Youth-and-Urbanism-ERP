/**
 * Optimistic update helper for TanStack Query mutations.
 *
 * Provides instant UI feedback by updating the cache before the server
 * responds, then rolling back on error. This makes creates/updates/deletes
 * feel instantaneous — critical for the "instant ERP" goal.
 *
 * Usage (list update):
 *   const update = useUpdateInvoice()
 *   const mutation = useMutation({
 *     mutationFn: update,
 *     ...optimisticListUpdate(
 *       queryClient,
 *       ['finance', 'invoices'],
 *       (old, newItem) => old.map(i => i.id === newItem.id ? { ...i, ...newItem } : i)
 *     ),
 *   })
 *
 * Usage (single item update):
 *   useMutation({
 *     mutationFn: updateInvoice,
 *     ...optimisticDetailUpdate(queryClient, ['finance', 'invoice', id]),
 *   })
 */

import { QueryClient, QueryKey } from '@tanstack/react-query'

/** Optimistically update a list query.
 *  @param queryClient - The TanStack QueryClient instance
 *  @param queryKey    - The query key for the list to update
 *  @param updater     - Function that receives (oldList, newItem) and returns new list
 */
export function optimisticListUpdate<TList, TItem>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (oldData: TList, newItem: TItem) => TList,
) {
  return {
    onMutate: async (newItem: TItem) => {
      // Cancel in-flight refetches to prevent overwriting optimistic data
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current value for rollback
      const previousData = queryClient.getQueryData<TList>(queryKey)

      // Apply optimistic update
      if (previousData !== undefined) {
        queryClient.setQueryData<TList>(queryKey, (old) =>
          old !== undefined ? updater(old, newItem) : old,
        )
      }

      return { previousData }
    },

    onError: (_error: unknown, _newItem: TItem, context: { previousData: TList | undefined } | undefined) => {
      // Roll back to snapshot on failure
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
    },

    onSettled: () => {
      // Always refetch after success or failure to ensure consistency
      queryClient.invalidateQueries({ queryKey })
    },
  }
}

/** Optimistically update a single-item detail query.
 *  @param queryClient - The TanStack QueryClient instance
 *  @param queryKey    - The query key for the single item
 */
export function optimisticDetailUpdate<TItem>(
  queryClient: QueryClient,
  queryKey: QueryKey,
) {
  return {
    onMutate: async (updates: Partial<TItem>) => {
      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<TItem>(queryKey)

      if (previousData !== undefined) {
        queryClient.setQueryData<TItem>(queryKey, (old) =>
          old !== undefined ? { ...old, ...updates } : old,
        )
      }

      return { previousData }
    },

    onError: (_error: unknown, _updates: Partial<TItem>, context: { previousData: TItem | undefined } | undefined) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  }
}

/** Optimistically remove an item from a list query.
 *  @param queryClient - The TanStack QueryClient instance
 *  @param queryKey    - The query key for the list
 *  @param getId       - Function that extracts the ID from a list item
 */
export function optimisticDelete<TList extends TItem[], TItem extends { id: string | number }>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  getId: (item: TItem) => string | number = (item) => item.id,
) {
  return {
    onMutate: async (deletedId: string | number) => {
      await queryClient.cancelQueries({ queryKey })

      const previousData = queryClient.getQueryData<TList>(queryKey)

      if (previousData !== undefined) {
        queryClient.setQueryData<TList>(queryKey, (old) =>
          old !== undefined
            ? (old.filter((item) => getId(item) !== deletedId) as TList)
            : old,
        )
      }

      return { previousData }
    },

    onError: (_error: unknown, _id: string | number, context: { previousData: TList | undefined } | undefined) => {
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  }
}
