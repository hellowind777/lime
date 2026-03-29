import type { ComponentType } from "react";

export interface ReactComponentImplementation<
  TProps = Record<string, unknown>,
> {
  name: string;
  component: ComponentType<TProps>;
}

export function createReactComponent<TProps>(
  name: string,
  component: ComponentType<TProps>,
): ReactComponentImplementation<TProps> {
  return {
    name,
    component,
  };
}

export const createBinderlessComponent = createReactComponent;
