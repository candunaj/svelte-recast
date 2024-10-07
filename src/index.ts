import type {
  Ast,
  TemplateNode,
  Text as SvelteText,
  ConstTag,
  DebugTag,
  MustacheTag,
  Fragment,
  Element,
  Attribute,
  SpreadAttribute,
  Directive,
  Transition,
  BaseNode,
  BaseExpressionDirective,
  Comment,
} from 'svelte/types/compiler/interfaces';
import { simple, ancestor } from 'acorn-walk';
import { Program, Node } from 'estree';
import { parse as parseJS } from 'acorn';
import { visit as visitRecast } from 'recast';
import { type ASTNode, type Visitor, type NodePath } from 'ast-types';
// type ANode = TemplateNode | undefined;

export type SvelteNode = TemplateNode | IfBlock | ElseBlock;
export interface SveltePath<T extends SvelteNode> {
  node: T;
  parent: SveltePath<T> | null;
  parentPath: SveltePath<T> | null;
  replace(node: T): void;
  prune(): void;
}

type SvelteVisitorContext = {
  traverse(path: SveltePath<SvelteNode>): void;
};

export interface IfBlock {
  type: 'IfBlock';
  expression: ASTNode;
  children: SvelteNode[];
  else?: ElseBlock;
}
export interface ElseBlock {
  type: 'ElseBlock';
  children: SvelteNode[];
}

export interface SvelteVisitorMethods {
  visitSvelteSpread(
    this: SvelteVisitorContext,
    path: SveltePath<BaseNode>,
  ): false | void;
  visitSvelteTransition(
    this: SvelteVisitorContext,
    path: SveltePath<BaseExpressionDirective>,
  ): false | void;
  visitSvelteText(
    this: SvelteVisitorContext,
    path: SveltePath<SvelteText>,
  ): false | void;
  visitSvelteConstTag(
    this: SvelteVisitorContext,
    path: SveltePath<ConstTag>,
  ): false | void;
  visitSvelteDebugTag(
    this: SvelteVisitorContext,
    path: SveltePath<DebugTag>,
  ): false | void;
  visitSvelteMustacheTag(
    this: SvelteVisitorContext,
    path: SveltePath<MustacheTag>,
  ): false | void;
  visitSvelteFragment(
    this: SvelteVisitorContext,
    path: SveltePath<Fragment>,
  ): false | void;
  visitSvelteElement(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteInlineComponent(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteSlotTemplate(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteTitle(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteSlot(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteHead(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteOptions(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteWindow(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteDocument(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteBody(
    this: SvelteVisitorContext,
    path: SveltePath<Element>,
  ): false | void;
  visitSvelteAttribute(
    this: SvelteVisitorContext,
    path: SveltePath<Attribute>,
  ): false | void;
  visitSvelteSpreadAttribute(
    this: SvelteVisitorContext,
    path: SveltePath<SpreadAttribute>,
  ): false | void;
  visitSvelteAction(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteAnimation(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteBinding(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteClass(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteEventHandler(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteLet(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteRef(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteStyleDirective(
    this: SvelteVisitorContext,
    path: SveltePath<Directive>,
  ): false | void;
  visitSvelteTransition(
    this: SvelteVisitorContext,
    path: SveltePath<Transition>,
  ): false | void;
  visitSvelteComment(
    this: SvelteVisitorContext,
    path: SveltePath<Comment>,
  ): false | void;
  visitSvelteIfBlock(
    this: SvelteVisitorContext,
    path: SveltePath<IfBlock>,
  ): false | void;
  visitSvelteElseBlock(
    this: SvelteVisitorContext,
    path: SveltePath<ElseBlock>,
  ): false | void;
}

export interface SvelteVisitor extends Visitor, Partial<SvelteVisitorMethods> {}

export function visit(code: Ast, visitor: SvelteVisitor) {
  if (code.instance) {
    // visit script on top of svelte file
    visitRecast(code.instance.content, visitor);
  }

  if (code.html) {
    // visit html
    // visitRecast(code.html, visitor);
    visitSvelteTemplateNode(
      {
        node: code.html,
        parent: null,
        parentPath: null,
        replace: () => {
          throw new Error('replace is not supported');
        },
        prune: () => {
          throw new Error('prune is not supported');
        },
      },
      visitor,
    );
  }
}

function visitSvelteTemplateNode<T extends SvelteNode>(
  path: SveltePath<T>,
  visitor: SvelteVisitor,
) {
  const context: SvelteVisitorContext = {
    traverse(path: SveltePath<SvelteNode>) {},
  };
  const method = getVisitorMethod(path.node, visitor);
  if (method) {
    let handledTraverse = false;
    const handledTraverseReturn =
      method.apply(
        {
          traverse: (path: SveltePath<SvelteNode>) => {
            handledTraverse = true;
            traverseAllChildren(path, visitor);
          },
        },
        [path as SveltePath<Fragment>],
      ) === false;

    const correctTraverse =
      (handledTraverse && !handledTraverseReturn) ||
      (!handledTraverse && handledTraverseReturn);
    if (!correctTraverse) {
      throw new Error(
        'visitSvelte should return false or call this.traverse()',
      );
    }
  } else {
    traverseAllChildren(path, visitor);
  }
}

function getVisitorMethod(node: SvelteNode, visitor: SvelteVisitor) {
  // @ts-ignore
  return visitor[`visitSvelte${node.type}`];
}

function traverseAllChildren(
  path: SveltePath<SvelteNode>,
  visitor: SvelteVisitor,
) {
  if (path.node.children) {
    path.node.children = traverseChildren(path.node.children, path, visitor);
  }
  if ((path.node as IfBlock).else) {
    visitSvelteTemplateNode(
      {
        // @ts-ignore
        node: (path.node as IfBlock).else,
        parent: path,
        parentPath: path,
        replace: (node: ElseBlock) => {
          (path.node as IfBlock).else = node;
        },
        prune: () => {
          (path.node as IfBlock).else = undefined;
        },
      },
      visitor,
    );
  }

  // @ts-ignore
  if (path.node.attributes) {
    // @ts-ignore
    path.node.attributes = traverseChildren(
      // @ts-ignore
      path.node.attributes,
      path,
      visitor,
    );
  }
  // @ts-ignore
  if (path.node.expression) {
    const handler = {
      get(target: SvelteVisitor, propKey: string) {
        // @ts-ignore
        const originalMethod = target[propKey];

        // Check if the property is a function (method)
        if (typeof originalMethod === 'function') {
          return function (...args: any[]) {
            // Add your custom argument or modify args here
            // @ts-ignore
            const parentHandler = {
              get(target: SvelteVisitor, propKey: string) {
                if (
                  // @ts-ignore
                  (propKey === 'parent' && !target.parent) ||
                  // @ts-ignore
                  (propKey === 'parentPath' && !target.parentPath)
                ) {
                  return path;
                }
                // @ts-ignore
                return target[propKey];
              },
            };
            // @ts-ignore
            return originalMethod.apply(this, [
              new Proxy(args[0], parentHandler),
            ]);
          };
        }

        // If it's not a function, just return the property
        return originalMethod;
      },
    };

    // Create a Proxy for the object
    const proxyVisitor = new Proxy(visitor, handler);
    // inject parent and parentPath to visitor. It will be svelte parentPath
    // @ts-ignore
    visitRecast(path.node.expression, proxyVisitor);
  }
  // @ts-ignore
  if (path.node.identifiers) {
    // @ts-ignore
    path.node.identifiers = traverseChildren(
      // @ts-ignore
      path.node.identifiers,
      path,
      visitor,
    );
  }

  // @ts-ignore
  if (path.node.value && Array.isArray(path.node.value)) {
    // @ts-ignore
    path.node.value = traverseChildren(path.node.value, path, visitor);
  }
}

function traverseChildren(
  children: SvelteNode[] | undefined,
  parent: SveltePath<SvelteNode>,
  visitor: SvelteVisitor,
): SvelteNode[] | undefined {
  if (!children) {
    return;
  }

  const nodesToRemove: SvelteNode[] = [];

  children.forEach((child, i) => {
    visitSvelteTemplateNode(
      {
        node: child,
        parent: parent,
        parentPath: parent,
        replace: (node: SvelteNode) => {
          children[i] = node;
        },
        prune: () => {
          nodesToRemove.push(child);
        },
      },
      visitor,
    );
  });

  const newNodes = children.filter((child) => !nodesToRemove.includes(child));
  return newNodes;
}
