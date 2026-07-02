/**
 * Workaround for browser auto-translation (Chrome, etc.) mutating the DOM and
 * breaking React reconciliation. Recommended by the React team:
 * https://github.com/facebook/react/issues/11538#issuecomment-417504026
 */
export function applyGoogleTranslateDomPatch() {
  if (typeof Node !== "function" || !Node.prototype) return;
  if ((Node.prototype as { __translatePatch?: boolean }).__translatePatch) return;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };

  (Node.prototype as { __translatePatch?: boolean }).__translatePatch = true;
}
