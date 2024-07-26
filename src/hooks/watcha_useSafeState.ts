/*
Copyright 2022 Watcha

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { useEffect, useRef, useState } from "react";

// Hook to update the local state by ensuring that the component is still mounted
export default function  useSafeState<T>(initialState: T): [T, (value: T) => void] {
    const isMounted = useRef<boolean>();
    const [state, setState] = useState(initialState);
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);
    const _setState = (value: T) => {
        if (isMounted.current) {
            return setState(value);
        }
    };
    return [state, _setState];
}
