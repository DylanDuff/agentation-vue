// Optional drawing capture adapter; the core bundle does not import this module.
// Keep its narrow internal contract available when the optional adapter is absent.
declare module "modern-screenshot" {
  export function domToCanvas(
    node: Node,
    options?: Record<string, unknown>,
  ): Promise<HTMLCanvasElement>;
}
