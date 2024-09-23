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
  Comment,
} from 'svelte/types/compiler/interfaces';
import { simple, ancestor } from 'acorn-walk';
import { Program, Node } from 'estree';
import { parse as parseJS } from 'acorn';
import { visit as visitRecast } from 'recast';
import { type ASTNode, type Visitor, type NodePath } from 'ast-types';
// type ANode = TemplateNode | undefined;

export interface SveltePath<T extends TemplateNode> {
  node: T;
  parent: SveltePath<T> | null;
  parentPath: SveltePath<T> | null;
  replace(node: T): void;
  prune(): void;
}

type SvelteVisitorContext = {
  traverse(path: SveltePath<TemplateNode>): void;
};

export interface SvelteVisitorMethods {
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
  visitSvelteAttribute(
    this: SvelteVisitorContext,
    path: SveltePath<Attribute>,
  ): false | void;
  visitSvelteSpreadAttribute(
    this: SvelteVisitorContext,
    path: SveltePath<SpreadAttribute>,
  ): false | void;
  visitSvelteDirective(
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
      null,
      visitor,
    );
  }
}

function visitSvelteTemplateNode<T extends TemplateNode>(
  path: SveltePath<T>,
  parent: SveltePath<T> | null,
  visitor: SvelteVisitor,
) {
  const context: SvelteVisitorContext = {
    traverse(path: SveltePath<TemplateNode>) {},
  };
  const method = getVisitorMethod(path.node, visitor);
  if (method) {
    let handledTraverse = false;
    const handledTraverseReturn =
      method.apply(
        {
          traverse: (path: SveltePath<TemplateNode>) => {
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

function getVisitorMethod(node: TemplateNode, visitor: SvelteVisitor) {
  // @ts-ignore
  return visitor[`visitSvelte${node.type}`];
}

function traverseAllChildren(
  path: SveltePath<TemplateNode>,
  visitor: SvelteVisitor,
) {
  switch (path.node.type) {
    case 'Fragment':
      traverseChildren(path.node.children, path, visitor);
      break;
    case 'Element':
      traverseChildren(path.node.children, path, visitor);
      traverseChildren(path.node.attributes, path, visitor);
      break;
    case 'Text':
    default:
      break;
  }
}

function traverseChildren(
  children: TemplateNode[] | undefined,
  parent: SveltePath<TemplateNode>,
  visitor: SvelteVisitor,
): TemplateNode[] | undefined {
  if (!children) {
    return;
  }

  const nodesToRemove: TemplateNode[] = [];

  children.forEach((child, i) => {
    visitSvelteTemplateNode(
      {
        node: child,
        parent: parent,
        parentPath: parent,
        replace: (node: TemplateNode) => {
          children[i] = node;
        },
        prune: () => {
          nodesToRemove.push(child);
        },
      },
      parent,
      visitor,
    );
  });

  const newNodes = children.filter((child) => !nodesToRemove.includes(child));
  return newNodes;
}
