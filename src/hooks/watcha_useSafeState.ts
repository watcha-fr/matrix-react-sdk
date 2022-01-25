import { useEffect, useRef, useState } from "react";

// Hook to update the local state by ensuring that the component is still mounted
export default function useSafeState<T>(initialState) {
    const isMounted = useRef<boolean>();
    const [state, setState] = useState(initialState);
    useEffect(() => {
        isMounted.current = true;
        return () => (isMounted.current = false);
    }, []);
    const _setState = value => {
        if (isMounted.current) {
            return setState(value);
        }
    };
    return [state, _setState];
}
