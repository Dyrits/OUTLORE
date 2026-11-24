import type { Request, ResultOf } from "@outlore/contracts";
import { useEffect, useState } from "react";
import { messageOf, type ServiceClient } from "./client";

/** Runs a query now and again after every committed change. */
export function useServiceQuery<R extends Request>(client: ServiceClient, request: R, key: string) {
  const [data, setData] = useState<ResultOf<R["_tag"]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the key identifies the request.
  useEffect(() => {
    let isCurrent = true;
    let isLoading = false;
    let needsRefresh = false;

    const load = async () => {
      if (isLoading) {
        needsRefresh = true;
        return;
      }
      isLoading = true;
      do {
        needsRefresh = false;
        try {
          const value = await client.request(request);
          if (isCurrent) {
            setData(value);
            setError(null);
          }
        } catch (reason) {
          if (isCurrent) setError(messageOf(reason));
        }
      } while (isCurrent && needsRefresh);
      isLoading = false;
    };

    const unsubscribe = client.subscribe(load);
    void load();
    return () => {
      isCurrent = false;
      unsubscribe();
    };
  }, [client, key]);

  return { data, error };
}
