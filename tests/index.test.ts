import { SvelteVisitor, visit } from '@src/index';
import { parse } from 'svelte/compiler';
import { print } from 'recast';

describe('parseSvelte function', () => {
  it('should return the ast', () => {
    const ast = parse(`
      <script>
        const b = 1;
      </script>
      <!-- This is a comment -->
      some text
      {#if true}
      <span>{a+b}</span>
      {:else}
      <span>{hura}</span>
      {/if}
      <MyComponent first="123" second use:aaa {bbb} />
      `);

    const visitor: SvelteVisitor = {
      visitSvelteFragment(path) {
        this.traverse(path);
        // return false;
      },
      visitSvelteMustacheTag(path) {
        this.traverse(path);
        // console.log('text', path.node);
        // return false;
      },
      visitSvelteElseBlock(path) {
        path.prune();
        return false;
        // this.traverse(path);
      },
      visitIdentifier(path) {
        this.traverse(path);
      },
      visitLiteral(path) {
        // path.node.value = path.node.value + '_post';
        this.traverse(path);
      },

      visitSvelteAttribute(path) {
        path.prune();
        this.traverse(path);
      },
    };

    visit(ast, visitor);

    if (ast.instance) {
      const result = print(ast.instance.content).code;
      console.log('printed', result);
    }
  });
});
