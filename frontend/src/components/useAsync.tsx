import { useState } from "react";

interface State<Response> {
    pending: boolean;
    error: Error | null;
    data: Response | null;
}

interface CallResponse<Response> {
    data?: Response;
    error?: Error;
}

interface UseAsync<Params, Response> extends State<Response> {
    call: (params: Params) => Promise<CallResponse<Response>>;
}

function useAsync<Params, Response>(
    req: (params: Params) => Promise<Response>
): UseAsync<Params, Response> {
    const [state, setState] = useState<State<Response>>({
        pending: false,
        error: null,
        data: null,
    });

    async function call(params: Params): Promise<CallResponse<Response>> {
        setState((state) => ({
            ...state,
            pending: true,
            data: null,
            error: null as Error | null,
        }));

        try {
            const data = await req(params);

            setState((state) => ({
                ...state,
                pending: false,
                data,
                error: null,
            }));

            return { data };
        } catch (error) {
            const err = error as Error;
            setState((state) => ({
                ...state,
                pending: false,
                error: err,
            }));

            return { error: err };
        }
    }

    return {
        ...state,
        call,
    };
}

export default useAsync;