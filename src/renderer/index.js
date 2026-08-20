// Renderer facade — the ONLY thing the graph view knows about 2D vs 3D.
//
// A renderer instance implements:
//   mode           '2d' | '3d'
//   setData(g)     g = { nodes, links } (plain ids on links)
//   refresh()      re-read the shared styling accessors (colour/size changed)
//   focus(node)    fly/pan the camera to a node
//   zoomToFit(ms)
//   setForces(f)   f = state.forces
//   setBackground(css)
//   resize()
//   destroy()      tear down DOM + listeners
//   getData()      current { nodes, links } with live positions
//
// Handlers passed to createRenderer: { onNodeHover, onNodeClick, onBackgroundClick }

export async function createRenderer(mode, container, handlers) {
  if (mode === '2d') {
    const { create2dRenderer } = await import('./canvas.js');
    return create2dRenderer(container, handlers);
  }
  const { create3dRenderer } = await import('./three.js');
  return create3dRenderer(container, handlers);
}
