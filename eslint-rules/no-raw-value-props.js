/**
 * ESLint Rule: no-raw-value-props
 *
 * Prevents React components from accepting raw number values as props.
 * Forces use of FDPValueBundle branded types.
 *
 * BANNED:
 * - value: number
 * - dynasty_value: number
 * - player_value: number
 * - ktc_value: number
 *
 * REQUIRED:
 * - fdp: FDPValueBundle
 * - fdpValues: FDPValueMap
 * - fdpBundle: FDPValueBundle
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow raw number value props in React components',
      category: 'FDP Policy',
      recommended: true,
    },
    messages: {
      rawValueProp:
        'Component prop "{{prop}}: number" is prohibited. Use "fdp: FDPValueBundle" instead. Raw numbers cannot represent player values.',
      suggestFDPBundle:
        'Replace with FDPValueBundle type from src/lib/fdp/types.ts',
    },
    schema: [],
  },

  create(context) {
    const BANNED_PROP_PATTERNS = [
      /^value$/i,
      /^dynasty_value$/i,
      /^player_value$/i,
      /^ktc_value$/i,
      /^base_value$/i,
      /^market_value$/i,
      /^adjusted_value$/i,
      /.*_value$/i, // Any prop ending in _value
    ];

    return {
      // Check TypeScript interfaces
      TSInterfaceDeclaration(node) {
        if (!node.id.name.includes('Props')) return;

        for (const member of node.body.body) {
          if (member.type !== 'TSPropertySignature') continue;
          if (!member.key || !member.typeAnnotation) continue;

          const propName = member.key.name || member.key.value;
          const typeAnnotation = member.typeAnnotation.typeAnnotation;

          if (
            BANNED_PROP_PATTERNS.some(pattern => pattern.test(propName)) &&
            typeAnnotation.type === 'TSNumberKeyword'
          ) {
            context.report({
              node: member,
              messageId: 'rawValueProp',
              data: { prop: propName },
            });
          }
        }
      },

      // Check TypeScript type literals
      TSTypeLiteral(node) {
        const parent = node.parent;
        if (
          !parent ||
          (parent.type !== 'TSTypeAliasDeclaration' &&
            parent.type !== 'TSTypeAnnotation')
        ) {
          return;
        }

        for (const member of node.members) {
          if (member.type !== 'TSPropertySignature') continue;
          if (!member.key || !member.typeAnnotation) continue;

          const propName = member.key.name || member.key.value;
          const typeAnnotation = member.typeAnnotation.typeAnnotation;

          if (
            BANNED_PROP_PATTERNS.some(pattern => pattern.test(propName)) &&
            typeAnnotation.type === 'TSNumberKeyword'
          ) {
            context.report({
              node: member,
              messageId: 'rawValueProp',
              data: { prop: propName },
            });
          }
        }
      },

      // Check function parameters (for React components)
      FunctionDeclaration(node) {
        if (
          !node.id ||
          !node.id.name.match(/^[A-Z]/) // React component starts with capital
        ) {
          return;
        }

        checkFunctionParams(node.params, context);
      },

      ArrowFunctionExpression(node) {
        const parent = node.parent;
        if (
          !parent ||
          parent.type !== 'VariableDeclarator' ||
          !parent.id ||
          !parent.id.name.match(/^[A-Z]/)
        ) {
          return;
        }

        checkFunctionParams(node.params, context);
      },
    };
  },
};

function checkFunctionParams(params, context) {
  for (const param of params) {
    if (param.type !== 'ObjectPattern') continue;
    if (!param.typeAnnotation) continue;

    const typeAnnotation = param.typeAnnotation.typeAnnotation;
    if (typeAnnotation.type === 'TSTypeLiteral') {
      for (const member of typeAnnotation.members) {
        if (member.type !== 'TSPropertySignature') continue;
        if (!member.key || !member.typeAnnotation) continue;

        const propName = member.key.name || member.key.value;
        const propType = member.typeAnnotation.typeAnnotation;

        if (
          /.*value$/i.test(propName) &&
          propType.type === 'TSNumberKeyword'
        ) {
          context.report({
            node: member,
            messageId: 'rawValueProp',
            data: { prop: propName },
          });
        }
      }
    }
  }
}
